import Link from "next/link";
import { notFound } from "next/navigation";
import { database, requireUser } from "@/server/supabase";
import { ranking, teams, rankPosition, type Game } from "@/domain/game";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { data } = await database()
    .from("games")
    .select("state")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const g = data.state as Game;
  if (!g.players.some((p) => p.id === user.id)) notFound();
  const scores =
    g.settings.mode === "teams" ? teams(g.players) : ranking(g.players);
  return (
    <main>
      <div className="page-title">
        <span className="eyebrow">Le dernier mot</span>
        <h1>Quel beau final.</h1>
      </div>
      {g.preparationError && <p className="error">{g.preparationError}</p>}
      <div className="podium">
        {scores.slice(0, 3).map((p, i) => (
          <div key={p.id} style={{ minHeight: 210 - i * 30 }}>
            <span className="eyebrow">#{rankPosition(scores, i)}</span>
            <h2>{p.name}</h2>
            <span className="score">{p.score} pts</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>
          {g.settings.mode === "teams"
            ? "Contributions individuelles"
            : "Classement final"}
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Points</th>
              <th>Bonnes réponses</th>
              <th>Buzz moyen gagnant</th>
            </tr>
          </thead>
          <tbody>
            {ranking(g.players).map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name}
                  {p.team ? " · " + p.team : ""}
                </td>
                <td>{p.score}</td>
                <td>{p.correct}</td>
                <td>
                  {p.correct
                    ? (p.winningMs / p.correct / 1000).toFixed(2) + " s"
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <Link className="button button-primary" href="/rooms/create">
          Créer une nouvelle partie
        </Link>
        <Link className="button button-outline" href="/profile/history">
          Mon historique
        </Link>
      </div>
    </main>
  );
}
