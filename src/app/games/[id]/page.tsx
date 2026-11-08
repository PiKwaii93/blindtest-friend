import { redirect, notFound } from "next/navigation";
import { database, requireUser } from "@/server/supabase";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const { data } = await database()
    .from("rooms")
    .select("code,state")
    .eq("state->>gameId", id)
    .maybeSingle();
  if (!data) notFound();
  if (!data.state.game?.players.some((p: { id: string }) => p.id === user.id))
    notFound();
  redirect("/rooms/" + data.code);
}
