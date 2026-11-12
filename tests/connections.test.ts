import { describe, expect, it } from "vitest";
import {
  connectionGraceMs,
  disconnectedPlayers,
  synchronizeConnections,
} from "../src/domain/connections";
import { start, transition, type Clip } from "../src/domain/game";
import { defaultSettings } from "../src/domain/settings";

const players = ["a", "b"].map((id) => ({
  id,
  name: id,
  ready: true,
  team: null,
  score: 0,
  correct: 0,
  winningMs: 0,
}));
const clip: Clip = {
  id: "clip",
  workId: "work",
  title: "Zig et Sharko",
  aliases: [],
  important: [],
  categories: ["Dessins animés"],
  path: "sandbox-video/test.mp4",
  image: null,
  difficulty: "normal",
  startMs: 0,
  durationMs: 45000,
};
function playing() {
  let g = start(
    { ...defaultSettings, mode: "open", rounds: 1, listenSeconds: 30 },
    players,
    [clip],
    0,
  );
  for (const p of players)
    g = transition(g, { type: "loaded", playerId: p.id }, 0);
  return transition(g, { type: "tick" }, 3000);
}
const answer = (g: ReturnType<typeof playing>, id: string, now: number) =>
  transition(g, { type: "answer", playerId: id, answer: clip.title }, now);

describe("connexions en réponses libres", () => {
  it("tolère une coupure de moins de dix secondes", () => {
    const g = answer(playing(), "a", 4000);
    synchronizeConnections(g, { a: 13999, b: 4000 }, 13999);
    expect(connectionGraceMs).toBe(10000);
    expect(g.disconnected).toEqual([]);
    expect(g.phase).toBe("PLAYING");
  });
  it("révèle quand le seul joueur qui cherche est déconnecté, avec dix secondes et les scores conservés", () => {
    const g = answer(playing(), "a", 4000),
      score = g.players[0].score;
    synchronizeConnections(g, { a: 14000, b: 4000 }, 14000);
    expect(g.disconnected).toEqual(["b"]);
    expect(g.departed).toBeUndefined();
    expect(g.phase).toBe("REVEAL");
    expect(g.startedAt).toBe(14000);
    expect(g.consumedMs).toBe(11000);
    expect(g.deadline).toBe(24000);
    expect(g.players.map((p) => p.score)).toEqual([score, 0]);
  });
  it("attend toujours la bonne réponse d'un joueur encore connecté", () => {
    const g = playing();
    synchronizeConnections(g, { a: 15000, b: 4000 }, 15000);
    expect(g.phase).toBe("PLAYING");
    expect(g.winner).toBeNull();
    expect(answer(g, "a", 16000).phase).toBe("REVEAL");
  });
  it("permet une reconnexion pendant la manche sans exclure définitivement le joueur", () => {
    const g = playing();
    synchronizeConnections(g, { a: 15000, b: 4000 }, 15000);
    expect(g.disconnected).toEqual(["b"]);
    synchronizeConnections(g, { a: 16000, b: 16000 }, 16000);
    expect(g.disconnected).toEqual([]);
    const first = answer(g, "b", 17000);
    expect(first.phase).toBe("PLAYING");
    const both = answer(first, "a", 18000);
    expect(both.phase).toBe("REVEAL");
    expect(both.players.every((p) => p.score >= 100)).toBe(true);
  });
  it("n'annonce pas une révélation vide quand tout le monde est hors ligne", () => {
    const g = playing();
    synchronizeConnections(g, { a: 4000, b: 4000 }, 15000);
    expect(g.disconnected).toEqual(["a", "b"]);
    expect(g.phase).toBe("PLAYING");
  });
  it("laisse un délai initial aux participants dont aucun signal n'est encore enregistré", () => {
    const g = playing();
    expect(disconnectedPlayers(g, { a: 12999 }, 12999)).toEqual([]);
    expect(disconnectedPlayers(g, { a: 13000 }, 13000)).toEqual(["b"]);
  });
  it("ne bloque pas le préchargement de la manche suivante sur un joueur hors ligne", () => {
    const g = start(
      { ...defaultSettings, mode: "open", rounds: 1, listenSeconds: 30 },
      players,
      [clip],
      15000,
    );
    g.loaded = ["a"];
    synchronizeConnections(g, { a: 15000, b: 4000 }, 15000);
    expect(g.phase).toBe("COUNTDOWN");
    expect(g.deadline).toBe(18000);
    expect(g.loaded).toEqual(["a"]);
  });
  it("ne change pas le fonctionnement du mode classique", () => {
    const g = playing();
    g.settings.mode = "individual";
    const before = structuredClone(g);
    synchronizeConnections(g, { a: 4000, b: 4000 }, 15000);
    expect(g).toEqual(before);
  });
});
