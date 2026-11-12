import { describe, expect, it } from "vitest";
import extension from "../catalogue/dessins-animes-400-extension.json";
import origins from "../catalogue/origines-animation.json";
import dates from "../catalogue/dessins-animes-diffusions-france.json";
import popularity from "../catalogue/popularite.json";
import { normalizeAnswer, validateAnswer } from "../src/domain/answers";

describe("extension de 100 génériques diffusés en France", () => {
  it("ajoute exactement cent identifiants et sources distincts, sans réutiliser les 300 premiers", () => {
    expect(extension).toHaveLength(100);
    expect(new Set(extension.map((r) => r.editorialId)).size).toBe(100);
    expect(new Set(extension.map((r) => normalizeAnswer(r.title))).size).toBe(
      100,
    );
    expect(new Set(extension.map((r) => r.videoId)).size).toBe(100);
    for (const [i, row] of extension.entries()) {
      expect(row.editorialId).toBe(`da-${301 + i}`);
      expect(row.source).toBe(`https://www.youtube.com/watch?v=${row.videoId}`);
      expect(row.videoId).toMatch(/^[\w-]{11}$/);
    }
  });
  it("documente les générations en France de 1995 à 2020 et les deux origines", () => {
    expect(extension.filter((r) => r.origin === "japanese")).toHaveLength(25);
    expect(extension.filter((r) => r.origin === "western")).toHaveLength(75);
    for (const row of extension) {
      expect(row.firstFrance.year).toBeGreaterThanOrEqual(1995);
      expect(row.firstFrance.year).toBeLessThanOrEqual(2020);
      expect(new URL(row.firstFrance.source).protocol).toBe("https:");
      expect((origins.origins as Record<string, string>)[row.editorialId]).toBe(
        row.origin,
      );
      expect(
        (dates as Record<string, { year: number }>)[row.editorialId].year,
      ).toBe(row.firstFrance.year);
      expect(
        (popularity.ratings as Record<string, string>)[row.editorialId],
      ).toBe(row.popularity);
      expect(row.review.fullListening).toBe("pending");
    }
  });
  it("accepte tous les titres et alias explicites avec les seuils actuels", () => {
    for (const row of extension)
      for (const difficulty of ["easy", "normal", "hard"] as const)
        for (const answer of [row.title, ...row.aliases])
          expect(
            validateAnswer(answer, [row.title, ...row.aliases], difficulty),
            `${row.title}: ${answer}`,
          ).toBe(true);
  });
});
