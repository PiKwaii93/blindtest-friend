import { describe, expect, it } from "vitest";
import {
  publicGame,
  roundRecap,
  start,
  transition,
  type Clip,
  type Game,
} from "../src/domain/game";
import { defaultSettings, settingsSchema } from "../src/domain/settings";

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
  aliases: ["Zig & Sharko"],
  important: [],
  categories: ["Dessins animés"],
  path: "sandbox-video/test.mp4",
  image: null,
  difficulty: "normal",
  startMs: 0,
  durationMs: 30000,
};
function playing() {
  let game = start(
    { ...defaultSettings, mode: "open", rounds: 1 },
    players,
    [clip],
    0,
  );
  for (const p of players)
    game = transition(game, { type: "loaded", playerId: p.id }, 0);
  return transition(game, { type: "tick" }, 3000);
}
function answer(game: Game, playerId: string, text: string, now: number) {
  return transition(game, { type: "answer", playerId, answer: text }, now);
}

describe("réponses libres", () => {
  it("ajoute un mode sans modifier les réglages par défaut", () => {
    expect(
      settingsSchema.parse({ ...defaultSettings, mode: "open" }).mode,
    ).toBe("open");
    expect(defaultSettings.mode).toBe("individual");
  });
  it("autorise les essais répétés sans exclusion, pause ni déplacement audio", () => {
    let g = playing();
    const { deadline, startedAt, consumedMs } = g;
    for (let i = 0; i < 20; i++)
      g = answer(g, "a", "Mauvaise réponse", 4000 + i * 10);
    expect(g.excluded).toEqual([]);
    expect(g.phase).toBe("PLAYING");
    expect([g.deadline, g.startedAt, g.consumedMs]).toEqual([
      deadline,
      startedAt,
      consumedMs,
    ]);
    expect(g.players[0].score).toBe(0);
    expect(answer(g, "a", "Zigg & Sharko", 6000).players[0].score).toBe(170);
  });
  it("laisse le second joueur marquer après la première bonne réponse", () => {
    let g = answer(playing(), "a", "Zig et Sharko", 4000);
    expect(g.phase).toBe("PLAYING");
    expect(g.deadline).toBe(13000);
    g = answer(g, "b", "Zig et Sharko", 12999);
    expect(g.players.map((p) => p.score)).toEqual([190, 100]);
    expect(g.players.map((p) => p.correct)).toEqual([1, 1]);
    expect(g.players.map((p) => p.winningMs)).toEqual([1000, 9999]);
    expect(g.winner).toBe("a");
    expect(g.phase).toBe("PLAYING");
    g = transition(g, { type: "tick" }, 13000);
    expect(g.phase).toBe("REVEAL");
    expect(g.deadline).toBe(23000);
  });
  it("accepte deux bonnes réponses au même instant et sans double attribution", () => {
    const g = answer(
      answer(playing(), "a", clip.title, 5000),
      "b",
      clip.title,
      5000,
    );
    expect(g.players.map((p) => p.score)).toEqual([180, 180]);
    expect(() => answer(g, "a", clip.title, 5001)).toThrow("déjà trouvé");
    expect(g.players[0].correct).toBe(1);
  });
  it("ferme les réponses à l'échéance serveur et après la révélation", () => {
    const g = answer(playing(), "b", clip.title, 13000);
    expect(g.phase).toBe("REVEAL");
    expect(g.players[1].score).toBe(0);
    expect(g.attempts).toEqual([]);
    expect(() => answer(g, "a", clip.title, 13001)).toThrow("fermées");
  });
  it("refuse le buzz, les inconnus et les participants partis", () => {
    const g = playing();
    expect(() => transition(g, { type: "buzz", playerId: "a" }, 4000)).toThrow(
      "Buzz indisponible",
    );
    expect(() => answer(g, "inconnu", clip.title, 4000)).toThrow(
      "Participant inconnu",
    );
    g.departed = ["b"];
    expect(() => answer(g, "b", clip.title, 4000)).toThrow("quitté");
  });
  it("ne divulgue ni titre ni réponses pendant l'écoute", () => {
    const g = answer(
      answer(playing(), "a", "Réponse privée", 4000),
      "b",
      clip.title,
      6000,
    );
    for (const id of ["a", "b", undefined]) {
      const json = JSON.stringify(publicGame(g, id));
      expect(json).not.toContain(clip.title);
      expect(json).not.toContain("Réponse privée");
      expect(json).not.toContain(clip.path);
      expect(publicGame(g, id).reveal).toBeNull();
    }
  });
  it("explique le dernier essai refusé uniquement à son auteur et sans afficher un refus après un succès", () => {
    let g = answer(
      answer(playing(), "a", "Premier refus", 4000),
      "a",
      "Dernier refus",
      5000,
    );
    g = transition(g, { type: "tick" }, 13000);
    expect(publicGame(g, "a").refusal?.answer).toBe("Dernier refus");
    expect(publicGame(g, "b").refusal).toBeUndefined();
    let solved = answer(
      answer(playing(), "a", "Refus", 4000),
      "a",
      clip.title,
      5000,
    );
    solved = transition(solved, { type: "tick" }, 13000);
    expect(publicGame(solved, "a").refusal).toBeUndefined();
  });
  it("enregistre tous les scores et mesure la première bonne réponse dans le bilan", () => {
    let g = answer(
      answer(answer(playing(), "a", "Refus", 4000), "a", clip.title, 6000),
      "b",
      clip.title,
      8000,
    );
    g = transition(g, { type: "tick" }, 13000);
    g = transition(g, { type: "tick" }, 23000);
    g = transition(g, { type: "tick" }, 23500);
    expect(g.phase).toBe("FINISHED");
    expect(g.completedRounds?.[0].attempts).toHaveLength(3);
    expect(roundRecap(g, new Map())[0]).toMatchObject({
      found: true,
      firstBuzzMs: 3000,
    });
    expect(g.players.map((p) => p.score)).toEqual([170, 150]);
  });
});
