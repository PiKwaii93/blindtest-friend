import { describe, expect, it } from "vitest";
import { defaultSettings, matchesRoomSettings } from "../src/domain/settings";
import { selectClips } from "../src/domain/selection";
import { start, transition, roundRecap, type Clip } from "../src/domain/game";

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
  startMs: 1200,
  durationMs: 10000,
};
const settings = {
  ...defaultSettings,
  mode: "open" as const,
  listenSeconds: 30,
  rounds: 1,
  categories: clip.categories,
};
function playing(durationMs = 10000, mode: "open" | "individual" = "open") {
  let g = start({ ...settings, mode }, players, [{ ...clip, durationMs }], 0);
  for (const p of players)
    g = transition(g, { type: "loaded", playerId: p.id }, 0);
  return transition(g, { type: "tick" }, 3000);
}
describe("durée maximale des manches", () => {
  it.each([5000, 9900, 10000, 20000, 30000, 45000])(
    "garde un extrait de %i ms dans un salon 30 secondes",
    (durationMs) => {
      expect(matchesRoomSettings({ ...clip, durationMs }, settings)).toBe(true);
      expect(playing(durationMs).deadline).toBe(
        3000 + Math.min(30000, durationMs),
      );
    },
  );
  it.each([0, -1, NaN, Infinity])(
    "écarte une durée inutilisable %s",
    (durationMs) => {
      expect(matchesRoomSettings({ ...clip, durationMs }, settings)).toBe(
        false,
      );
    },
  );
  it("garde les filtres et évite les doublons même avec des extraits courts", () => {
    const clips = [
      clip,
      { ...clip, id: "hard", difficulty: "hard" as const },
      { ...clip, id: "other", workId: "other", durationMs: 9900 },
    ];
    const chosen = selectClips(clips, { ...settings, rounds: 2 }, []);
    expect(new Set(chosen.map((c) => c.clip.workId)).size).toBe(2);
    expect(
      matchesRoomSettings(clip, { ...settings, categories: ["Films"] }),
    ).toBe(false);
    expect(
      matchesRoomSettings(clip, { ...settings, difficulties: ["hard"] }),
    ).toBe(false);
  });
  it("ferme une manche de dix secondes et conserve les dix secondes de révélation", () => {
    const g = playing();
    expect(transition(g, { type: "tick" }, 12999).phase).toBe("PLAYING");
    const revealed = transition(g, { type: "tick" }, 13000);
    expect(revealed.phase).toBe("REVEAL");
    expect(revealed.consumedMs).toBe(10000);
    expect(revealed.deadline).toBe(23000);
    expect(() =>
      transition(
        revealed,
        { type: "answer", playerId: "b", answer: clip.title },
        13001,
      ),
    ).toThrow("fermées");
  });
  it("calcule les points et le bilan sur la durée effective, sans attendre trente secondes", () => {
    let g = transition(
      playing(),
      { type: "answer", playerId: "a", answer: clip.title },
      8000,
    );
    expect(g.phase).toBe("PLAYING");
    expect(g.players[0].score).toBe(150);
    g = transition(
      g,
      { type: "answer", playerId: "b", answer: clip.title },
      9000,
    );
    expect(g.phase).toBe("REVEAL");
    expect(g.players[1].score).toBe(140);
    expect(g.consumedMs).toBe(6000);
    expect(g.deadline).toBe(19000);
    g = transition(g, { type: "tick" }, 19000);
    expect(roundRecap(g, new Map())[0].firstBuzzMs).toBe(5000);
  });
  it("adapte aussi le buzz et la reprise à la durée courte", () => {
    let g = transition(
      playing(10000, "individual"),
      { type: "buzz", playerId: "a" },
      8000,
    );
    expect(g.attempts[0].remainingMs).toBe(5000);
    g = transition(g, { type: "answer", playerId: "a", answer: "Faux" }, 8100);
    expect(g.phase).toBe("PLAYING");
    expect(g.deadline).toBe(13600);
  });
});
