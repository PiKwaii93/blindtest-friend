import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, verifiedRequestUser } from "@/server/http";
import { database } from "@/server/supabase";

const input = z.object({ round: z.number().int().min(0).max(49) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const started = performance.now();
    const user = await verifiedRequestUser(request);
    const verified = performance.now();
    const { code } = await params;
    const { round } = input.parse(await request.json());
    const dbStarted = performance.now();
    const { data, error } = await database().rpc("accept_room_buzz", {
      p_code: code.toUpperCase(),
      p_user: user.id,
      p_round: round,
    });
    if (error) throw error;
    if (data !== null) throw new Error(data);
    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Server-Timing": `auth;dur=${Math.round(verified - started)}, buzz-db;dur=${Math.round(performance.now() - dbStarted)}`,
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
