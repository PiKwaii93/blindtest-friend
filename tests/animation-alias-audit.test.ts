import { describe, expect, it } from "vitest";
import extension from "../catalogue/dessins-animes-400-extension.json";
import audit from "../catalogue/dessins-animes-400-aliases-controle.json";
import {
  normalize,
  normalizeAnswer,
  validateAnswer,
} from "../src/domain/answers";

describe("alias des 100 nouveaux dessins animés", () => {
  it("couvre les 100 fiches et accepte les variantes relevées aux trois difficultés", () => {
    expect(audit).toHaveLength(100);
    expect(audit.map((r) => r.editorialId)).toEqual(
      extension.map((r) => r.editorialId),
    );
    for (const row of audit) {
      const work = extension.find((w) => w.editorialId === row.editorialId)!;
      expect(row.title).toBe(work.title);
      for (const answer of row.accepted)
        for (const difficulty of ["easy", "normal", "hard"] as const)
          expect(
            validateAnswer(answer, [work.title, ...work.aliases], difficulty),
            `${row.title}: ${answer} (${difficulty})`,
          ).toBe(true);
    }
  });
  it("ne crée pas de doublons d’alias ni d’ambiguïtés exactes entre les nouvelles fiches", () => {
    const indexed = new Map<string, string>();
    for (const work of extension) {
      expect(new Set(work.aliases.map(normalize)).size).toBe(
        work.aliases.length,
      );
      for (const answer of [work.title, ...work.aliases]) {
        const key = normalizeAnswer(answer);
        expect(indexed.get(key) ?? work.editorialId, answer).toBe(
          work.editorialId,
        );
        indexed.set(key, work.editorialId);
      }
    }
  });
  it.each(["easy", "normal", "hard"] as const)(
    "préserve les distinctions entre séries en %s",
    (difficulty) => {
      for (const [answer, id] of [
        ["Naruto", "da-367"],
        ["FMA", "da-372"],
        ["Batman", "da-324"],
        ["Batman", "da-325"],
        ["Iron Man", "da-328"],
        ["Avengers", "da-329"],
        ["Avengers", "da-330"],
        ["Sonic", "da-383"],
        ["Kangoo", "da-395"],
        ["Kangoo Juniors", "da-394"],
        ["Ligue des justiciers", "da-327"],
        ["Megaman", "da-384"],
        ["102 Dalmatiens", "da-337"],
        ["65 rue du zoo", "da-348"],
      ]) {
        const work = extension.find((w) => w.editorialId === id)!;
        expect(
          validateAnswer(answer, [work.title, ...work.aliases], difficulty),
          `${answer} ne doit pas désigner ${work.title}`,
        ).toBe(false);
      }
    },
  );
});
