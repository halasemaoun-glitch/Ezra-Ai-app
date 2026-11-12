import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const profileSchema = z.object({
  display_name: z.string().trim().max(80).nullable(),
  nickname: z.string().trim().max(80).nullable(),
  profession: z.string().trim().max(200).nullable(),
  lifestyle: z.string().trim().max(500).nullable(),
  about: z.string().trim().max(1500).nullable(),
  instructions: z.string().trim().max(2000).nullable(),
  humor_level: z.number().int().min(0).max(10),
  affection_level: z.number().int().min(0).max(10),
  communication_style: z.enum(["balanced", "playful", "calm", "academic"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your profile");
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (data) return { ...data, email };
    const created = await supabase.from("profiles").insert({ id: userId }).select("*").single();
    if (created.error) throw new Error("Could not create your profile");
    return { ...created.data, email };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProfileInput) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        typeof value === "string" && !value ? null : value,
      ]),
    ) as ProfileInput;
    const { error } = await context.supabase
      .from("profiles")
      .update(clean)
      .eq("id", context.userId);
    if (error) throw new Error("Could not save your profile");
    return { ok: true };
  });