import { notFound } from "next/navigation";
import { YouTubePilot } from "./pilot";

export default async function YouTubeLab({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; session?: string }>;
}) {
  if (process.env.ENCORE_YOUTUBE_LAB !== "1") notFound();
  const params = await searchParams;
  return (
    <YouTubePilot
      screen={params.screen === "1" ? (params.session ?? "") : null}
    />
  );
}
