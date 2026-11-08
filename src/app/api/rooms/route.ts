import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/server/http";
import { createRoom } from "@/server/rooms";
export async function POST(req: Request) {
  try {
    const u = await authenticated(req);
    const { name } = z
      .object({ name: z.string().trim().min(2).max(60) })
      .parse(await req.json());
    return NextResponse.json({ code: await createRoom(u.id, name) });
  } catch (e) {
    return failure(e);
  }
}
