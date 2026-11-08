import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticated, failure } from "@/server/http";
import { database, requireAdmin } from "@/server/supabase";
export async function POST(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    if (Number(req.headers.get("content-length") ?? 0) > 21 * 1024 * 1024)
      throw new Error("Fichier trop volumineux.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Fichier absent.");
    const types: Record<string, { ext: string; bucket: string; max: number }> =
      {
        "audio/wav": { ext: "wav", bucket: "audio", max: 20 },
        "audio/mpeg": { ext: "mp3", bucket: "audio", max: 20 },
        "audio/ogg": { ext: "ogg", bucket: "audio", max: 20 },
        "image/png": { ext: "png", bucket: "images", max: 5 },
        "image/jpeg": { ext: "jpg", bucket: "images", max: 5 },
        "image/webp": { ext: "webp", bucket: "images", max: 5 },
      };
    const type = types[file.type];
    if (!type || file.size > type.max * 1024 * 1024 || file.size < 12)
      throw new Error("Type ou taille de fichier non autorisé.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = String.fromCharCode(...bytes.slice(0, 12));
    const valid =
      type.ext === "wav"
        ? head.startsWith("RIFF") && head.endsWith("WAVE")
        : type.ext === "ogg"
          ? head.startsWith("OggS")
          : type.ext === "mp3"
            ? head.startsWith("ID3") ||
              (bytes[0] === 255 && (bytes[1] & 224) === 224)
            : type.ext === "png"
              ? bytes[0] === 137 && head.slice(1, 4) === "PNG"
              : type.ext === "jpg"
                ? bytes[0] === 255 && bytes[1] === 216
                : head.startsWith("RIFF") && head.endsWith("WEBP");
    if (!valid)
      throw new Error("Le contenu ne correspond pas au type déclaré.");
    const path = randomUUID() + "." + type.ext;
    const db = database();
    const { error } = await db.storage
      .from(type.bucket)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw error;
    const url =
      type.bucket === "images"
        ? db.storage.from("images").getPublicUrl(path).data.publicUrl
        : null;
    return NextResponse.json({ path, url });
  } catch (e) {
    return failure(e);
  }
}
