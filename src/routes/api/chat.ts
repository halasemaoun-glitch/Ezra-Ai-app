import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import {
  ATTACHMENT_BUCKET,
  DEFAULT_THREAD_TITLE,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  STORAGE_PREFIX,
  isAcceptedMediaType,
  titleFromText,
  type StoredPart,
} from "@/lib/chat-shared";
import { buildChatInstructions } from "@/lib/ezra-persona";

const partSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string().max(40_000) }),
  z.object({
    type: z.literal("file"),
    mediaType: z.string().max(120),
    url: z.string().startsWith("data:"),
    filename: z.string().max(200).optional(),
  }),
]);

const bodySchema = z.object({
  threadId: z.string().uuid(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z
      .array(z.unknown())
      .min(1)
      .max(MAX_ATTACHMENTS + 4),
  }),
});

const HISTORY_LIMIT = 40;
const ATTACHMENT_HISTORY = 8;

function decodeDataUrl(url: string): { bytes: Uint8Array; mediaType: string } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!match) throw new Error("Invalid attachment");
  const payload = match[3] ?? "";
  const bytes = match[2]
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { bytes, mediaType: match[1] ?? "application/octet-stream" };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function safeName(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80) || "file";
}

type InputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" }
  | { type: "input_file"; file_data: string; filename: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Server not configured", { status: 500 });
        if (token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });
        const { data: claimData, error: claimError } = await supabase.auth.getClaims(token);
        const userId = claimData?.claims?.sub;
        if (claimError || !userId) return new Response("Unauthorized", { status: 401 });

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const { data: thread, error: threadError } = await supabase
          .from("conversations")
          .select("id, title")
          .eq("id", body.threadId)
          .maybeSingle();
        if (threadError) return new Response("Could not load conversation", { status: 500 });
        if (!thread) return new Response("Conversation not found", { status: 404 });

        // Validate parts, upload attachments to private storage.
        const stored: StoredPart[] = [];
        const freshData = new Map<string, string>(); // storage url -> data url (current message)
        let fileCount = 0;
        for (const raw of body.message.parts) {
          const parsed = partSchema.safeParse(raw);
          if (!parsed.success) continue; // ignore non-content parts (e.g. step markers)
          const part = parsed.data;
          if (part.type === "text") {
            if (part.text.trim()) stored.push({ type: "text", text: part.text });
            continue;
          }
          fileCount++;
          if (fileCount > MAX_ATTACHMENTS)
            return new Response("Too many attachments", { status: 400 });
          if (!isAcceptedMediaType(part.mediaType))
            return new Response("Unsupported file type", { status: 415 });
          const { bytes } = decodeDataUrl(part.url);
          if (bytes.byteLength > MAX_ATTACHMENT_BYTES)
            return new Response("Attachment too large", { status: 413 });
          const filename = part.filename ?? "file";
          const path = `${userId}/${body.threadId}/${crypto.randomUUID()}-${safeName(filename)}`;
          const upload = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .upload(path, bytes, { contentType: part.mediaType, upsert: false });
          if (upload.error) {
            console.error("attachment upload failed", upload.error.message);
            return new Response("Could not save attachment", { status: 500 });
          }
          const storageUrl = `${STORAGE_PREFIX}${path}`;
          freshData.set(storageUrl, part.url);
          stored.push({ type: "file", mediaType: part.mediaType, url: storageUrl, filename });
        }
        if (!stored.length) return new Response("Empty message", { status: 400 });

        const insertUser = await supabase.from("messages").insert({
          conversation_id: body.threadId,
          user_id: userId,
          client_id: body.message.id,
          role: "user",
          parts: stored,
        });
        if (insertUser.error) {
          console.error("user message insert failed", insertUser.error.message);
          return new Response("Could not save your message", { status: 500 });
        }

        if (thread.title === DEFAULT_THREAD_TITLE) {
          const firstText = stored.find(
            (p): p is Extract<StoredPart, { type: "text" }> => p.type === "text",
          )?.text;
          const firstFile = stored.find(
            (p): p is Extract<StoredPart, { type: "file" }> => p.type === "file",
          )?.filename;
          await supabase
            .from("conversations")
            .update({ title: titleFromText(firstText ?? firstFile ?? DEFAULT_THREAD_TITLE) })
            .eq("id", body.threadId);
        } else {
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", body.threadId);
        }

        const [{ data: historyDesc, error: historyError }, { data: profile }] = await Promise.all([
          supabase
            .from("messages")
            .select("role, parts")
            .eq("conversation_id", body.threadId)
            .order("created_at", { ascending: false })
            .limit(HISTORY_LIMIT),
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        ]);
        if (historyError) return new Response("Could not load history", { status: 500 });
        const history = [...historyDesc].reverse();

        async function fileContent(
          part: Extract<StoredPart, { type: "file" }>,
          recent: boolean,
        ): Promise<InputContent> {
          const label = part.filename ?? "file";
          if (!recent || !part.url.startsWith(STORAGE_PREFIX)) {
            return {
              type: "input_text",
              text: `[Earlier attachment: ${label} (${part.mediaType})]`,
            };
          }
          let dataUrl = freshData.get(part.url);
          if (!dataUrl) {
            const { data: blob, error } = await supabase.storage
              .from(ATTACHMENT_BUCKET)
              .download(part.url.slice(STORAGE_PREFIX.length));
            if (error || !blob)
              return { type: "input_text", text: `[Attachment ${label} could not be loaded]` };
            dataUrl = `data:${part.mediaType};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
          }
          if (part.mediaType.startsWith("image/"))
            return { type: "input_image", image_url: dataUrl, detail: "auto" };
          if (part.mediaType === "application/pdf")
            return { type: "input_file", file_data: dataUrl, filename: label };
          const text = new TextDecoder().decode(decodeDataUrl(dataUrl).bytes).slice(0, 120_000);
          return { type: "input_text", text: `Attached file "${label}":\n${text}` };
        }

        const input = await Promise.all(
          history.map(async (row, index) => {
            const parts = row.parts as StoredPart[];
            const recent = index >= history.length - ATTACHMENT_HISTORY;
            if (row.role === "assistant") {
              const text = parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
              return { role: "assistant" as const, content: text || "…" };
            }
            const content: InputContent[] = await Promise.all(
              parts.map((p) =>
                p.type === "text"
                  ? Promise.resolve<InputContent>({ type: "input_text", text: p.text })
                  : fileContent(p, recent),
              ),
            );
            return { role: "user" as const, content };
          }),
        );

        const instructions = `${buildChatInstructions(profile)}\n\nCurrent date: ${new Date().toISOString().slice(0, 10)}.`;

        const stream = createUIMessageStream({
          onError: () => "عزرا ما قدرش يكمّل الرد. جرّب مرة أخرى.",
          execute: async ({ writer }) => {
            const { streamResponse, GatewayError, PaymentRequiredError, RateLimitError } =
              await import("@lovable.dev/ai-gateway");
            const textId = crypto.randomUUID();
            writer.write({ type: "start" });
            writer.write({ type: "text-start", id: textId });
            let answer = "";
            let failure: string | null = null;
            try {
              const response = await streamResponse(
                {
                  model: "openai/gpt-6-astra",
                  instructions,
                  input,
                  reasoning: { effort: "low" },
                },
                { signal: request.signal },
              );
              let completed = false;
              for await (const event of response) {
                if (event.type === "response.output_text.delta") {
                  answer += event.delta;
                  writer.write({ type: "text-delta", id: textId, delta: event.delta });
                } else if (event.type === "response.completed") {
                  completed = true;
                } else if (event.type === "response.incomplete") {
                  failure = "انقطع الرد قبل ما يكمل.";
                }
              }
              if (!completed && !failure) failure = "انقطع الرد قبل ما يكمل.";
            } catch (error) {
              if (error instanceof PaymentRequiredError)
                failure = "رصيد الذكاء الاصطناعي خلص. زيد الرصيد من إعدادات مساحة العمل.";
              else if (error instanceof RateLimitError)
                failure = "عزرا عندو ضغط كبير دابا. استنى شوية وعاود.";
              else if (error instanceof GatewayError) {
                console.error("gateway error", error.code, error.ids);
                failure = "صار مشكل في الاتصال مع عزرا. جرّب مرة أخرى.";
              } else if (request.signal.aborted) failure = null;
              else {
                console.error("chat failure", error);
                failure = "صار مشكل غير متوقع. جرّب مرة أخرى.";
              }
            }
            writer.write({ type: "text-end", id: textId });

            if (answer.trim()) {
              const saved = await supabase.from("messages").insert({
                conversation_id: body.threadId,
                user_id: userId,
                role: "assistant",
                parts: [{ type: "text", text: answer }],
              });
              if (saved.error) {
                console.error("assistant message insert failed", saved.error.message);
                failure ??= "الرد ما تحفظش في السجل.";
              }
            }
            if (failure) writer.write({ type: "error", errorText: failure });
            writer.write({ type: "finish" });
          },
        });
        return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});