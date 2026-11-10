import { z } from "zod";
export const clipPathPattern =
  /^(?:[a-zA-Z0-9_/-]+\.(?:wav|mp3|ogg)|sandbox-video\/[a-zA-Z0-9_/-]+\.mp4)$/;
export const workSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(2).max(180),
    aliases: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
    categories: z.array(z.string().uuid()).min(1).max(20),
    important_words: z.array(z.string().min(1).max(50)).max(20).default([]),
    rights_source: z.string().trim().min(5).max(2000),
    image_path: z.string().url().nullable().default(null),
    image_license: z.string().trim().max(2000).nullable().default(null),
    image_attribution: z.string().trim().max(300).nullable().default(null),
    release_year: z.number().int().min(1500).max(2200).nullable().default(null),
    is_active: z.boolean().default(true),
    clips: z
      .array(
        z.object({
          audio_path: z.string().regex(clipPathPattern),
          difficulty: z.enum(["easy", "normal", "hard"]),
          start_ms: z.number().int().min(0),
          usable_duration_ms: z.number().int().min(5000).max(600000),
          is_active: z.boolean().default(true),
          rights_status: z.enum(["authorized", "pending", "denied"]),
          license_reference: z
            .string()
            .trim()
            .max(2000)
            .nullable()
            .default(null),
          previewed: z.boolean().default(false),
        }),
      )
      .max(30)
      .default([]),
  })
  .refine(
    (work) =>
      !work.is_active ||
      work.clips.some(
        (clip) => clip.is_active && clip.rights_status === "authorized",
      ),
    {
      path: ["clips"],
      message: "Une œuvre active exige au moins un extrait actif et autorisé.",
    },
  );

export function cartoonActivationError(
  work: z.infer<typeof workSchema>,
  freezeOnRevealPath?: string,
) {
  if (!work.is_active) return null;
  if (!work.image_path || !work.image_license)
    return "Ajoutez une illustration et documentez sa licence et son attribution.";
  const clips = work.clips.filter((clip) => clip.is_active);
  if (
    clips.length > 3 ||
    new Set(clips.map((clip) => clip.difficulty)).size !== clips.length
  )
    return "Prévoyez un seul extrait actif par difficulté, avec trois extraits maximum.";
  if (
    clips.some(
      (clip) =>
        clip.rights_status !== "authorized" ||
        !clip.license_reference ||
        !clip.previewed ||
        (clip.usable_duration_ms < 10000 &&
          !(
            clip.audio_path === freezeOnRevealPath &&
            clip.audio_path.startsWith("sandbox-video/") &&
            clip.audio_path.endsWith(".mp4") &&
            clip.usable_duration_ms > 9000
          )),
    )
  )
    return "Chaque extrait actif exige dix secondes jouables, une autorisation documentée et un aperçu validé.";
  return null;
}
