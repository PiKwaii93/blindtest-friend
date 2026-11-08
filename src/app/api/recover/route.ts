import { NextResponse } from "next/server";
import { database } from "@/server/supabase";
import { command } from "@/server/rooms";
export async function POST(req: Request) {
  if (
    !process.env.RECOVERY_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.RECOVERY_SECRET}`
  )
    return new Response(null, { status: 401 });
  const { data, error } = await database().rpc("expired_rooms");
  if (error)
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  const results = await Promise.allSettled(
    (data as { code: string }[]).map((r) =>
      command(r.code, "system", { type: "tick" }, true),
    ),
  );
  return NextResponse.json({
    processed: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  });
}
