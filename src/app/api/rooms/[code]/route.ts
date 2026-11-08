import { NextResponse } from "next/server";
import { authenticated, failure } from "@/server/http";
import { command, snapshot } from "@/server/rooms";
type Context = { params: Promise<{ code: string }> };
export async function GET(req: Request, { params }: Context) {
  try {
    const u = await authenticated(req);
    const { code } = await params;
    return NextResponse.json(await snapshot(code.toUpperCase(), u.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, { params }: Context) {
  try {
    const u = await authenticated(req);
    const { code } = await params;
    const action = await req.json();
    await command(code.toUpperCase(), u.id, action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
