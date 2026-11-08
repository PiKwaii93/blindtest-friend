import { NextResponse } from "next/server";
import { database, requireUser } from "./supabase";
export async function authenticated(request: Request) {
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    throw new Error("Origine refusée.");
  const user = await requireUser();
  const { data, error } = await database().rpc("take_rate_limit", {
    p_user: user.id,
    p_limit: 180,
  });
  if (error) throw error;
  if (!data) throw new Error("Trop de requêtes. Patientez une minute.");
  return user;
}
export function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Opération impossible.";
  return NextResponse.json(
    { error: message },
    { status: message === "Connexion requise." ? 401 : 400 },
  );
}
