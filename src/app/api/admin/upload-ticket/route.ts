import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticated, failure } from "@/server/http";
import { database, requireAdmin } from "@/server/supabase";

const media = {
  "audio/wav": ["audio", "wav", 20],
  "audio/mpeg": ["audio", "mp3", 20],
  "audio/ogg": ["audio", "ogg", 20],
  "image/png": ["images", "png", 5],
  "image/jpeg": ["images", "jpg", 5],
  "image/webp": ["images", "webp", 5],
} as const;

export async function POST(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const { type, size } = z
      .object({
        type: z.enum(Object.keys(media) as [keyof typeof media]),
        size: z.number().int().min(12),
      })
      .parse(await req.json());
    const [bucket, extension, limit] = media[type];
    if (size > limit * 1024 * 1024)
      throw new Error(`Ce fichier dépasse ${limit} Mo.`);
    const storage = database().storage.from(bucket);
    const { data, error } = await storage.createSignedUploadUrl(
      `${randomUUID()}.${extension}`,
    );
    if (error) throw error;
    return Response.json({
      bucket,
      path: data.path,
      token: data.token,
      url:
        bucket === "images"
          ? storage.getPublicUrl(data.path).data.publicUrl
          : null,
    });
  } catch (error) {
    return failure(error);
  }
}
