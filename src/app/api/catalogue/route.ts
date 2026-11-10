import { NextResponse } from "next/server";
import { authenticated, failure } from "@/server/http";
import { catalogue } from "@/server/rooms";
import { database } from "@/server/supabase";
export async function GET(req: Request) {
  try {
    await authenticated(req);
    const [clips, { data: categories }] = await Promise.all([
      catalogue(),
      database().from("categories").select("name").eq("is_active", true),
    ]);
    return NextResponse.json({
      categories: categories?.map((c) => c.name) ?? [],
      availability: clips.map((c) => ({
        workId: c.workId,
        categories: c.categories,
        difficulty: c.difficulty,
        durationMs: c.durationMs,
        freezeOnReveal: c.freezeOnReveal,
        french: c.french,
        firstFrenchBroadcastYear: c.firstFrenchBroadcastYear,
        generationYear: c.generationYear,
        popularity: c.popularity,
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
