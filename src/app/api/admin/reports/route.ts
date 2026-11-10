import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/server/http";
import { database, requireAdmin } from "@/server/supabase";
import { videoSandboxEnabled } from "@/server/video-sandbox";

export async function GET(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    if (!videoSandboxEnabled()) return new Response(null, { status: 404 });
    const workId = z
      .string()
      .uuid()
      .parse(new URL(req.url).searchParams.get("workId"));
    const { data, error } = await database()
      .from("sandbox_clip_reports")
      .select("game_id,round,clip_id,media_path,reason,created_at")
      .eq("work_id", workId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ reports: data });
  } catch (error) {
    return failure(error);
  }
}
