import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ATTACHMENT_BUCKET,
  DEFAULT_THREAD_TITLE,
  STORAGE_PREFIX,
  type StoredPart,
} from "./chat-shared";

export type ChatMessageDTO = {
  id: string;
  role: "user" | "assistant";
  parts: Array<
    | { type: "text"; text: string }
    | { type: "file"; mediaType: string; url: string; filename?: string }
  >;
};

export type ThreadSummary = { id: string; title: string; updated_at: string };

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load conversations");
    return data;
  });

/** Returns an existing empty conversation or creates a new one. */
export const startThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: recent, error: recentError } = await supabase
      .from("conversations")
      .select("id, messages(count)")
      .eq("title", DEFAULT_THREAD_TITLE)
      .order("created_at", { ascending: false })
      .limit(5);
    if (recentError) throw new Error("Could not start a conversation");
    const empty = recent.find((row) => {
      const count = (row.messages as unknown as Array<{ count: number }>)[0]?.count ?? 0;
      return count === 0;
    });
    if (empty) return { id: empty.id };
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: DEFAULT_THREAD_TITLE })
      .select("id")
      .single();
    if (error) throw new Error("Could not start a conversation");
    return { id: data.id };
  });

/** Most recent conversation, or a fresh one when there is none. */
export const latestThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load conversations");
    if (data) return { id: data.id };
    const created = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: DEFAULT_THREAD_TITLE })
      .select("id")
      .single();
    if (created.error) throw new Error("Could not start a conversation");
    return { id: created.data.id };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: thread, error } = await supabase
      .from("conversations")
      .select("id, title")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error("Could not load the conversation");
    if (!thread) return null;
    const { data: rows, error: rowsError } = await supabase
      .from("messages")
      .select("id, client_id, role, parts, created_at")
      .eq("conversation_id", data.threadId)
      .order("created_at", { ascending: true });
    if (rowsError) throw new Error("Could not load messages");

    const paths = new Set<string>();
    for (const row of rows) {
      for (const part of row.parts as StoredPart[]) {
        if (part.type === "file" && part.url.startsWith(STORAGE_PREFIX))
          paths.add(part.url.slice(STORAGE_PREFIX.length));
      }
    }
    const signed = new Map<string, string>();
    if (paths.size) {
      const { data: urls } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrls([...paths], 60 * 60 * 6);
      for (const entry of urls ?? [])
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }

    const messages: ChatMessageDTO[] = rows.map((row) => ({
      id: row.client_id ?? row.id,
      role: row.role as "user" | "assistant",
      parts: (row.parts as StoredPart[]).map((part) =>
        part.type === "file"
          ? {
              type: "file" as const,
              mediaType: part.mediaType,
              url: part.url.startsWith(STORAGE_PREFIX)
                ? (signed.get(part.url.slice(STORAGE_PREFIX.length)) ?? "")
                : part.url,
              ...(part.filename ? { filename: part.filename } : {}),
            }
          : { type: "text" as const, text: part.text },
      ),
    }));
    return { id: thread.id, title: thread.title, messages };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: files } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .list(`${userId}/${data.threadId}`);
    if (files?.length) {
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(files.map((file) => `${userId}/${data.threadId}/${file.name}`));
    }
    const { error } = await supabase.from("conversations").delete().eq("id", data.threadId);
    if (error) throw new Error("Could not delete the conversation");
    return { ok: true };
  });