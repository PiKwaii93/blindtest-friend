import { NextResponse } from "next/server";
import { authenticated, failure } from "@/server/http";
import { requireAdmin, database } from "@/server/supabase";
export async function GET(req: Request) {
  try {
    await authenticated(req);
    await requireAdmin();
    const path = new URL(req.url).searchParams.get("path");
    if (!path || !/^[a-zA-Z0-9_/-]+\.(wav|mp3|ogg)$/.test(path))
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
