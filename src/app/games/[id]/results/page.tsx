import Link from "next/link";
import { notFound } from "next/navigation";
import { database, requireUser } from "@/server/supabase";
import {
  ranking,
  teams,
  rankPosition,
  roundRecap,
  type Game,
} from "@/domain/game";
import { videoSandboxEnabled } from "@/server/video-sandbox";
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
  const sandbox = videoSandboxEnabled();
  const reportCounts = new Map<number, number>();
  if (sandbox && g.completedRounds?.length) {
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data: reports, error } = await database()
        .from("sandbox_clip_reports")
        .select("round")
        .eq("game_id", id)
        .order("round")
        .order("reporter_id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const { round } of reports)
        reportCounts.set(round, (reportCounts.get(round) ?? 0) + 1);
      if (reports.length < pageSize) break;
    }
  }
  const recap = sandbox ? roundRecap(g, reportCounts) : [];
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
      {recap.length > 0 && (
        <section className="panel stack" style={{ marginTop: 24 }}>
          <h2>Bilan par générique</h2>
          <p className="muted">
            {recap.filter((round) => !round.found).length} manche(s) sans bonne
            réponse sur {recap.length}. Le temps de buzz correspond au temps
            d’écoute écoulé.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Manche</th>
                  <th scope="col">Générique</th>
                  <th scope="col">Premier buzz</th>
                  <th scope="col">Résultat</th>
                  <th scope="col">Signalements</th>
                </tr>
              </thead>
              <tbody>
                {recap.map((round) => (
                  <tr key={round.number}>
                    <td>{round.number}</td>
                    <th scope="row">{round.title}</th>
                    <td>
                      {round.firstBuzzMs === null
                        ? "Aucun buzz"
                        : `${(round.firstBuzzMs / 1000).toFixed(2).replace(".", ",")} s`}
                    </td>
                    <td>{round.found ? "Trouvé" : "Sans bonne réponse"}</td>
                    <td>{round.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
