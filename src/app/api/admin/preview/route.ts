import { NextResponse } from "next/server";
import { authenticated, failure } from "@/server/http";
import { requireAdmin, database } from "@/server/supabase";
import { clipPathPattern } from "@/domain/catalogue";
import { z } from "zod";
import { videoSandboxEnabled } from "@/server/video-sandbox";
import { isSandboxVideo } from "@/domain/game";
export async function GET(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const path = new URL(req.url).searchParams.get("path");
    if (!path || !clipPathPattern.test(path))
      throw new Error("Chemin invalide.");
    if (path.startsWith("demo/")) return NextResponse.json({ url: "/" + path });
    const { data, error } = await database()
      .storage.from("audio")
      .createSignedUrl(path, 120);
    if (error) throw error;
    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    return failure(e);
  }
}

const schema = z.object({
  workId: z.string().uuid(),
  path: z.string().regex(clipPathPattern).refine(isSandboxVideo),
  startMs: z.number().int().min(0),
  french: z.boolean(),
});
export async function PATCH(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    if (!videoSandboxEnabled()) return new Response(null, { status: 404 });
    const { workId, ...review } = schema.parse(await req.json());
    const db = database();
    const { data: work, error } = await db
      .from("works")
      .select(
        "research,audio_clips(audio_path,start_ms,usable_duration_ms,rights_status)",
      )
      .eq("id", workId)
      .eq("is_active", false)
      .single();
    if (error) throw error;
    const clip = work.audio_clips.find(
      (item) =>
        item.audio_path === review.path && item.rights_status === "pending",
    );
    if (
      !clip ||
      review.startMs > clip.start_ms + clip.usable_duration_ms - 10000
    )
      throw new Error(
        "Ce départ doit laisser au moins 5 s d’écoute et 10 s de révélation.",
      );
    const update = db
      .from("works")
      .update({
        research: { ...work.research, sandbox_review: review },
      })
      .eq("id", workId)
      .eq("is_active", false);
    const { data, error: writeError } = await (
      work.research === null
        ? update.is("research", null)
        : update.eq("research", JSON.stringify(work.research))
    )
      .select("id")
      .maybeSingle();
    if (writeError) throw writeError;
    if (!data)
      throw new Error("La fiche a changé. Rechargez-la puis réessayez.");
    return NextResponse.json({ review });
  } catch (error) {
    return failure(error);
  }
}
