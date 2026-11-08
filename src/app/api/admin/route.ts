import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, database } from "@/server/supabase";
import { authenticated, failure } from "@/server/http";
import { workSchema } from "@/domain/catalogue";
import { normalize } from "@/domain/answers";
export async function GET(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const db = database();
    const [works, categories] = await Promise.all([
      db
        .from("works")
        .select(
          "*,work_aliases(alias),audio_clips(*),work_categories(category_id)",
        )
        .order("title"),
      db.from("categories").select("*").order("name"),
    ]);
    if (works.error) throw works.error;
    if (categories.error) throw categories.error;
    return NextResponse.json({
      works: works.data,
      categories: categories.data,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const body = await req.json();
    const db = database();
    if (body.type === "category") {
      const category = z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(2).max(50),
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(50),
          is_active: z.boolean(),
        })
        .parse(body.category);
      const { error } = await db.from("categories").upsert(category);
      if (error) throw error;
    } else {
      const works = z.array(workSchema).min(1).max(100).parse(body.works);
      const { error } = await db.rpc("save_works", {
        p_works: works.map((w) => ({
          ...w,
          aliases: w.aliases.map((alias) => ({
            alias,
            normalized_alias: normalize(alias),
          })),
        })),
      });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
