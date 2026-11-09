import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, database } from "@/server/supabase";
import { authenticated, failure } from "@/server/http";
import { cartoonActivationError, workSchema } from "@/domain/catalogue";
import { normalize } from "@/domain/answers";
export async function GET(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const db = database();
    const categories = await db.from("categories").select("*").order("name");
    if (categories.error) throw categories.error;
    const works = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await db
        .from("works")
        .select(
          "*,work_aliases(alias),audio_clips(*),work_categories(category_id)",
        )
        .order("title")
        .order("id")
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      works.push(...data);
      if (data.length < batchSize) break;
    }
    return NextResponse.json({
      works,
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
      const ids = works.flatMap((work) => (work.id ? [work.id] : []));
      if (ids.length) {
        const { data, error } = await db
          .from("works")
          .select("id,editorial_id")
          .in("id", ids);
        if (error) throw error;
        const drafts = new Set(
          data.filter((work) => work.editorial_id).map((work) => work.id),
        );
        for (const work of works) {
          if (!work.id || !drafts.has(work.id) || !work.is_active) continue;
          const reason = cartoonActivationError(work);
          if (reason) throw new Error(`${work.title} — ${reason}`);
          const imageBase = db.storage.from("images").getPublicUrl("")
            .data.publicUrl;
          if (!work.image_path!.startsWith(imageBase))
            throw new Error(
              `${work.title} — téléversez l’illustration dans le catalogue.`,
            );
          const checks = await Promise.all([
            db.storage
              .from("images")
              .exists(work.image_path!.slice(imageBase.length)),
            ...work.clips
              .filter((clip) => clip.is_active)
              .map((clip) => db.storage.from("audio").exists(clip.audio_path)),
          ]);
          if (checks.some((check) => check.error || !check.data))
            throw new Error(
              `${work.title} — un média est introuvable dans le catalogue.`,
            );
        }
      }
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
