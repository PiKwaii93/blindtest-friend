import Link from "next/link";
import { database, requireUser } from "@/server/supabase";
export const dynamic = "force-dynamic";
export default async function Page() {
  let entries: {
    game_id: string;
    score: number;
    correct: number;
    winning_ms: number;
  }[] = [];
  let error = "";
  try {
    const user = await requireUser();
    const { data, error: e } = await database()
      .from("game_players")
      .select("game_id,score,correct,winning_ms")
      .eq("user_id", user.id);
    if (e) throw e;
    entries = data ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Historique indisponible.";
  }
  return (
    <main>
      <div className="page-title">
        <span className="eyebrow">Vos meilleurs déclics</span>
        <h1>Historique</h1>
      </div>
      {error ? (
        <div className="notice">
          {error}{" "}
          <Link href="/login" className="link">
            Connexion
          </Link>
        </div>
      ) : (
        <>
          <div className="row">
            <div className="panel">
              <span className="score">{entries.length}</span>
              <div>Parties jouées</div>
            </div>
            <div className="panel">
              <span className="score">
                {entries.reduce((s, e) => s + e.correct, 0)}
              </span>
              <div>Bonnes réponses</div>
            </div>
            <div className="panel">
              <span className="score">
                {Math.max(0, ...entries.map((e) => e.score))}
              </span>
              <div>Meilleur score</div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 24 }}>
            {entries.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Partie</th>
                    <th>Score</th>
                    <th>Bonnes réponses</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.game_id}>
                      <td>
                        <Link
                          className="link"
                          href={`/games/${e.game_id}/results`}
                        >
                          Partie {i + 1}
                        </Link>
                      </td>
                      <td>{e.score}</td>
                      <td>{e.correct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">
                Votre première partie vous attend.{" "}
                <Link className="link" href="/rooms/create">
                  Créer un salon
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
