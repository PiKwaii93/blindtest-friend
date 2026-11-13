import { describe, expect, it } from "vitest";
import { publicGame, transition } from "../src/domain/game";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";
import { defaultSettings, settingsSchema } from "../src/domain/settings";
import { validateAnswer, normalize } from "../src/domain/answers";

describe("propositions à la révélation et nouveaux réglages", () => {
  it("propose 15 secondes pour chaque durée tout en conservant les réglages enregistrés", () => {
    expect(defaultSettings.listenSeconds).toBe(15);
    expect(defaultSettings.answerSeconds).toBe(15);
    expect(
      settingsSchema.parse({
        ...defaultSettings,
        listenSeconds: 30,
        answerSeconds: 10,
      }),
    ).toMatchObject({ listenSeconds: 30, answerSeconds: 10 });
  });
  it.each(["individual", "teams"] as const)(
    "garde les réponses cachées jusqu’à la révélation en mode %s",
    (mode) => {
      let g = createPilotRound(youtubePilots[0]);
      g.settings = { ...g.settings, mode };
      g.playlist[0].path = "sandbox-video/test/clip.mp4";
      g.phase = "PLAYING";
      g.startedAt = 0;
      g.deadline = 10000;
      if (mode === "teams")
        g.players.forEach((p, i) => {
          p.team = String(i);
        });
      const bad = "Un grille-pain volant <script>test</script>";
      g = transition(g, { type: "buzz", playerId: "1" }, 1000);
      g = transition(g, { type: "answer", playerId: "1", answer: bad }, 1100);
      for (const viewer of ["1", "2", undefined])
        expect(JSON.stringify(publicGame(g, viewer))).not.toContain(bad);
      g = transition(g, { type: "buzz", playerId: "2" }, 1700);
      g = transition(
        g,
        { type: "answer", playerId: "2", answer: g.playlist[0].title },
        1800,
      );
      expect(g.phase).toBe("REVEAL");
      expect(g.deadline).toBe(11800);
      for (const viewer of ["1", "2", undefined]) {
        expect(publicGame(g, viewer).attempts.map((a) => a.answer)).toEqual([
          bad,
          g.playlist[0].title,
        ]);
        expect(publicGame(g, viewer).attempts.map((a) => a.correct)).toEqual([
          false,
          true,
        ]);
      }
    },
  );
  it("ne publie pas les tentatives du mode réponses libres", () => {
    const g = createPilotRound(youtubePilots[0]);
    g.settings.mode = "open";
    g.phase = "REVEAL";
    g.attempts = [
      {
        playerId: "1",
        answer: "Réponse privée",
        acceptedAt: 1,
        remainingMs: 10,
        correct: false,
      },
    ];
    expect(publicGame(g, "2").attempts[0]).not.toHaveProperty("answer");
  });
  it.each(["easy", "normal", "hard"] as const)(
    "reconnaît les nombres attachés et refuse les mauvais numéros en %s",
    (difficulty) => {
      for (const [answer, title, aliases] of [
        ["Ben10", "Ben 10", ["Ben Ten"]],
        ["Portal2", "Portal 2", ["Portal II"]],
        ["Ulysse31", "Ulysse 31", []],
        ["GTA5", "Grand Theft Auto V", ["GTA 5"]],
      ] as const)
        expect(validateAnswer(answer, [title, ...aliases], difficulty)).toBe(
          true,
        );
      for (const [answer, accepted] of [
        ["Ben11", ["Ben 10", "Ben Ten"]],
        ["Portal3", ["Portal 2", "Portal II"]],
        ["Ulysse32", ["Ulysse 31"]],
        ["GTA4", ["GTA 5", "GTA V"]],
      ] as const)
        expect(validateAnswer(answer, [...accepted], difficulty)).toBe(false);
      expect(normalize("Ben10")).toBe("ben10");
    },
  );
});
