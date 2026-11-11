import { describe, expect, it } from "vitest";
import {
  assessAnswer,
  normalize,
  normalizeAnswer,
  validateAnswer,
} from "../src/domain/answers";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";
import { transition } from "../src/domain/game";

describe("conjonctions dans les réponses", () => {
  it("préserve les clés distinctes des alias lors d'une sauvegarde admin", () => {
    const aliases = ["Tom and Jerry", "Tom & Jerry", "Tom et Jerry"];
    expect(aliases.map(normalize)).toEqual([
      "tom and jerry",
      "tom jerry",
      "tom et jerry",
    ]);
    expect(new Set(aliases.map(normalize)).size).toBe(3);
    expect(new Set(aliases.map(normalizeAnswer)).size).toBe(1);
  });
  it.each(["&", "＆", "et", "and", "AND"])(
    "normalise %s sans perdre la conjonction",
    (conjunction) => {
      expect(normalizeAnswer(`Zig ${conjunction} Sharko`)).toBe(
        "zig et sharko",
      );
    },
  );

  it.each(["easy", "normal", "hard"] as const)(
    "accepte la faute Zigg avec une esperluette en %s",
    (difficulty) => {
      expect(
        assessAnswer("Zigg & Sharko", ["Zig et Sharko"], difficulty),
      ).toBeNull();
      expect(validateAnswer("Tom&Jerry", ["Tom et Jerry"], difficulty)).toBe(
        true,
      );
      expect(
        validateAnswer("Lilo et Stitch", ["Lilo & Stitch"], difficulty),
      ).toBe(true);
      expect(validateAnswer("Tic & Tac", ["Tic et Tac"], difficulty)).toBe(
        true,
      );
      expect(
        validateAnswer("Ratchet et Clank", ["Ratchet and Clank"], difficulty),
      ).toBe(true);
      expect(
        validateAnswer(
          "Brandy & M. Moustache",
          ["Brandy et M. Moustache"],
          difficulty,
        ),
      ).toBe(true);
      expect(assessAnswer("Zig Sharko", ["Zig et Sharko"], difficulty)).toBe(
        "incomplete",
      );
      expect(
        validateAnswer("Zig & Sharko 2", ["Zig et Sharko"], difficulty),
      ).toBe(false);
      expect(
        validateAnswer("Zig & Sharko", ["Zig et Sharko le film"], difficulty),
      ).toBe(false);
      expect(
        validateAnswer("Zigg & Sharko", ["Zig et Sharko"], difficulty, [
          "film",
        ]),
      ).toBe(false);
    },
  );

  it("ne modifie pas and à l'intérieur des mots", () => {
    expect(normalizeAnswer("Candyland Brandy Anderson")).toBe(
      "candyland brandy anderson",
    );
  });

  it("conserve les trois seuils de similitude", () => {
    // One substitution: 0.8 × 0.9 + 0.2 × 1 = 0.92.
    // Two substitutions: 0.8 × 0.8 + 0.2 × 1 = 0.84.
    // Three substitutions: 0.8 × 0.7 + 0.2 × 1 = 0.76.
    expect(
      ["easy", "normal", "hard"].map((d) =>
        validateAnswer(
          "abcdefghix",
          ["abcdefghij"],
          d as "easy" | "normal" | "hard",
        ),
      ),
    ).toEqual([true, true, true]);
    expect(
      ["easy", "normal", "hard"].map((d) =>
        validateAnswer(
          "abcdefghxx",
          ["abcdefghij"],
          d as "easy" | "normal" | "hard",
        ),
      ),
    ).toEqual([true, true, false]);
    expect(
      ["easy", "normal", "hard"].map((d) =>
        validateAnswer(
          "abcdefgxxx",
          ["abcdefghij"],
          d as "easy" | "normal" | "hard",
        ),
      ),
    ).toEqual([true, false, false]);
  });

  it("attribue les points pour Zigg & Sharko dans une vraie transition de manche", () => {
    const game = createPilotRound(youtubePilots[0]);
    game.playlist[0] = {
      ...game.playlist[0],
      title: "Zig et Sharko",
      aliases: [],
      important: [],
      difficulty: "hard",
    };
    game.phase = "PLAYING";
    game.deadline = 10000;
    const buzz = transition(game, { type: "buzz", playerId: "1" }, 1000);
    const answered = transition(
      buzz,
      { type: "answer", playerId: "1", answer: "Zigg & Sharko" },
      1100,
    );
    expect(answered.attempts.at(-1)?.correct).toBe(true);
    expect(answered.players.find((p) => p.id === "1")?.score).toBeGreaterThan(
      0,
    );
    expect(answered.phase).toBe("REVEAL");
  });
});
