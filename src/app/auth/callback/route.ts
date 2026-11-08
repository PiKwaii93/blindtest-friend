import { NextResponse } from "next/server";
import { sessionClient } from "@/server/supabase";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await sessionClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "/password"
            ? "/password"
            : "/profile",
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL("/login", url.origin));
}
