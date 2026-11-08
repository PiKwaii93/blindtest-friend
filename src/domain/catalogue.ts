import { z } from "zod";
export const workSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(180),
  aliases: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  categories: z.array(z.string().uuid()).min(1).max(20),
  important_words: z.array(z.string().min(1).max(50)).max(20).default([]),
  rights_source: z.string().trim().min(5).max(2000),
  image_path: z.string().url().nullable().default(null),
  release_year: z.number().int().min(1500).max(2200).nullable().default(null),
  is_active: z.boolean().default(true),
  clips: z
    .array(
      z.object({
        audio_path: z.string().regex(/^[a-zA-Z0-9_/-]+\.(wav|mp3|ogg)$/),
        difficulty: z.enum(["easy", "normal", "hard"]),
        start_ms: z.number().int().min(0),
        usable_duration_ms: z.number().int().min(5000).max(600000),
        is_active: z.boolean().default(true),
        rights_status: z.enum(["authorized", "pending", "denied"]),
      }),
    )
    .min(1)
    .max(30),
});
