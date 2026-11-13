import { describe, it, expect } from "vitest";
import { rankPosition } from "../src/domain/game";
import { normalize, validateAnswer } from "../src/domain/answers";
import {
  defaultSettings,
  settingsSchema,
  launchBlockers,
} from "../src/domain/settings";
import {
  start,
  transition,
  points,
  publicGame,
  ranking,
  teams,
  type Clip,
  type Player,
} from "../src/domain/game";
import { selectClips } from "../src/domain/selection";
const settings = {
  ...defaultSettings,
  rounds: 10,
  listenSeconds: 10,
  answerSeconds: 10,
};
const clips: Clip[] = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  workId: String(i),
  title: "Harry Potter",
  aliases: ["Hary Poter"],
  important: [],
  categories: ["Films"],
  image: null,
  path: "private.wav",
  difficulty: "normal",
  startMs: 0,
  durationMs: 30000,
}));
const players: Player[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  name: "Player " + i,
  ready: true,
  team: i % 2 ? "Bleus" : "Violets",
  score: 0,
  correct: 0,
  winningMs: 0,
}));
function playing() {
  let g = start(settings, players, clips.slice(0, 10), 0);
  for (const p of players)
    g = transition(g, { type: "loaded", playerId: p.id }, 0);
  return transition(g, { type: "tick" }, 3000);
}
describe("réponses", () => {
  it("normalise Unicode, ponctuation et accents", () =>
    expect(normalize("  POKÉMON—L’été! ")).toBe("pokemon l ete"));
  it.each([
    ["Pokemon", ["Pokémon"], true],
    ["Hary Poter", ["Harry Potter"], true],
    ["Mario Galaxy", ["Super Mario Galaxy", "Mario Galaxy"], true],
    ["Super Mario Odyssey", ["Super Mario Galaxy"], false],
    ["Naruto", ["Naruto Shippuden"], false],
    ["DBZ", ["Dragon Ball Z", "DBZ"], true],
    ["DBZ", ["Dragon Ball Z"], false],
    ["Le Roi Lion", ["Roi Lion"], true],
    ["Final Fantasy 7", ["Final Fantasy VII"], true],
    ["Final Fantasy 8", ["Final Fantasy VII"], false],
    ["Harry Potter", ["Harry Potter 2"], false],
  ])("%s → %j", (a, aliases, result) =>
    expect(validateAnswer(a, aliases, "normal")).toBe(result),
  );
  it("protège les mots importants et les titres courts", () => {
    expect(
      validateAnswer("Naruto Shippuden", ["Naruto Shippuden"], "normal", [
        "shippuden",
      ]),
    ).toBe(true);
    expect(
      validateAnswer("Narto", ["Naruto Shippuden"], "easy", ["shippuden"]),
    ).toBe(false);
    expect(validateAnswer("Upa", ["Up"], "easy")).toBe(false);
  });
});
describe("configuration et sélection", () => {
  it.each([1, 20, 50])("accepte %i manches", (rounds) =>
    expect(settingsSchema.safeParse({ ...settings, rounds }).success).toBe(
      true,
    ),
  );
  it("garde 20 manches par défaut", () =>
    expect(defaultSettings.rounds).toBe(20));
  it.each([["Films"], ["Films", "Jeux vidéo"]])(
    "enregistre les catégories choisies : %j",
    (...categories) => {
      expect(
        settingsSchema.safeParse({ ...settings, categories }).success,
      ).toBe(true);
    },
  );
  it("explique les blocages de lancement", () => {
    const reasons = launchBlockers(
      { ...settings, categories: [], difficulties: [], mode: "teams" },
      0,
      true,
      [{ ready: false, team: null }],
    );
    expect(reasons).toHaveLength(6);
    expect(
      launchBlockers({ ...settings, rounds: 1 }, 1, false, players),
    ).toEqual([]);
    expect(launchBlockers(settings, 3, false, players).join()).toContain(
      "3 œuvres",
    );
  });
  it("une manche utilise une seule œuvre malgré plusieurs extraits", () =>
    expect(
      selectClips([...clips, ...clips], { ...settings, rounds: 1 }, []),
    ).toHaveLength(1));
  it.each([0, 51])("refuse %i manches", (rounds) =>
    expect(settingsSchema.safeParse({ ...settings, rounds }).success).toBe(
      false,
    ),
  );
  it("exige catégories et difficultés", () => {
    expect(
      settingsSchema.safeParse({ ...settings, categories: [] }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...settings, difficulties: [] }).success,
    ).toBe(false);
  });
  it("aucune répétition malgré les extraits multiples", () => {
    const selected = selectClips([...clips, ...clips], settings, [], () => 0.5);
    expect(new Set(selected.map((s) => s.clip.workId)).size).toBe(10);
  });
  it("privilégie les œuvres inédites puis les plus anciennes", () => {
    const selected = selectClips(
      clips,
      settings,
      [{ workId: "0", lastPlayed: 10, count: 1 }],
      () => 0.5,
    );
    expect(selected.some((s) => s.clip.workId === "0")).toBe(false);
  });
  it("ne bloque pas un catalogue déjà joué", () =>
    expect(
      selectClips(
        clips,
        settings,
        clips.map((c) => ({ workId: c.workId, lastPlayed: 10, count: 2 })),
      ).length,
    ).toBe(10));
  it("refuse un catalogue insuffisant", () =>
    expect(() => selectClips(clips.slice(0, 9), settings, [])).toThrow());
  it("bornes des points", () => {
    expect(points(10000, 10000)).toBe(200);
    expect(points(0, 10000)).toBe(100);
    expect(points(5555, 10000)).toBe(155);
    expect(points(-1, 10000)).toBe(100);
  });
});
describe("moteur", () => {
  it("conserve un rang commun en cas d’égalité complète", () => {
    const tied = ranking(players.slice(0, 3));
    expect(tied.map((_, i) => rankPosition(tied, i))).toEqual([1, 1, 1]);
  });
  it("préchargement obligatoire et timeout explicite", () => {
    const g = start(settings, players, clips.slice(0, 10), 0);
    expect(g.phase).toBe("PREPARING");
    expect(
      transition(g, { type: "tick" }, 20000).preparationError,
    ).toBeTruthy();
  });
  it("un seul buzz, erreur exclut uniquement le joueur et préserve le budget", () => {
    let g = playing();
    g = transition(g, { type: "buzz", playerId: "0" }, 5000);
    expect(g.consumedMs).toBe(2000);
    expect(() =>
      transition(g, { type: "buzz", playerId: "1" }, 5001),
    ).toThrow();
    g = transition(g, { type: "answer", playerId: "0", answer: "Non" }, 9000);
    expect(g.phase).toBe("PLAYING");
    expect(g.deadline).toBe(17500);
    expect(g.excluded).toEqual(["0"]);
    expect(() =>
      transition(g, { type: "buzz", playerId: "0" }, 10000),
    ).toThrow();
    g = transition(g, { type: "buzz", playerId: "1" }, 10500);
    expect(g.consumedMs).toBe(3000);
    g = transition(
      g,
      { type: "answer", playerId: "1", answer: "Harry Potter" },
      11000,
    );
    expect(g.players[1].score).toBe(170);
    expect(g.phase).toBe("REVEAL");
  });
  it("réponse définitive, retard et timeout", () => {
    let g = transition(playing(), { type: "buzz", playerId: "0" }, 5000);
    g = transition(
      g,
      { type: "answer", playerId: "0", answer: "Harry Potter" },
      15000,
    );
    expect(g.players[0].score).toBe(0);
    expect(g.excluded).toContain("0");
    expect(() =>
      transition(
        g,
        { type: "answer", playerId: "0", answer: "Harry Potter" },
        15001,
      ),
    ).toThrow();
  });
  it("buzz juste avant expiration conserve son délai", () => {
    let g = transition(playing(), { type: "buzz", playerId: "0" }, 12999);
    g = transition(
      g,
      { type: "answer", playerId: "0", answer: "Harry Potter" },
      20000,
    );
    expect(g.winner).toBe("0");
    expect(g.players[0].score).toBe(100);
  });
  it("refuse un buzz à échéance", () =>
    expect(
      transition(playing(), { type: "buzz", playerId: "0" }, 13000).phase,
    ).toBe("REVEAL"));
  it("snapshot sans réponse ni chemins privés", () => {
    const safe = JSON.stringify(publicGame(playing()));
    expect(safe).not.toContain("Harry Potter");
    expect(safe).not.toContain("private.wav");
    expect(safe).not.toContain("workId");
  });
  it("scores d’équipes et départage", () => {
    const ps = players
      .slice(0, 3)
      .map((p, i) => ({ ...p, score: 100, correct: 1, winningMs: i * 100 }));
    expect(teams(ps)[0].score).toBe(200);
    expect(ranking(ps)[0].id).toBe("0");
  });
  it.each([1, 10, 50])("partie automatique de %i manches", (rounds) => {
    let now = 0;
    let g = start(
      { ...settings, rounds },
      players,
      clips.slice(0, rounds),
      now,
    );
    let steps = 0;
    while (g.phase !== "FINISHED" && steps++ < 400) {
      if (g.phase === "PREPARING") {
        for (const p of players)
          g = transition(g, { type: "loaded", playerId: p.id }, now);
      } else {
        now = g.deadline!;
        g = transition(g, { type: "tick" }, now);
      }
    }
    expect(g.phase).toBe("FINISHED");
    expect(g.round).toBe(rounds - 1);
    expect(g.preparationError).toBeUndefined();
  });
});
