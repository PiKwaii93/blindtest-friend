import { describe, expect, it } from "vitest";
import {
  approvedDownloadUrl,
  manifestSchema,
  stageSql,
} from "../scripts/catalogue-media.mjs";

const source = {
  file: "fixture.wav",
  sha256: "0".repeat(64),
  source: "https://example.test/licence",
  license: "CC0-1.0",
  evidence: "Fichier de test créé pour Encore",
  credit: "Encore",
  permissions: { download: true, adapt: true, redistributeInEncore: true },
};
const work = {
  workId: "c9f42694-4464-4734-9051-50196297db3e",
  editorialId: "fixture",
  title: "Fixture",
  edition: "Source de test",
  audio: source,
  image: source,
  segments: [{ difficulty: "easy", startMs: 0, durationMs: 10000 }],
};

describe("Import de médias autorisés", () => {
  it("refuse les droits incomplets et les durées insuffisantes avant traitement", () => {
    expect(manifestSchema.safeParse({ works: [work] }).success).toBe(true);
    expect(
      manifestSchema.safeParse({
        works: [
          {
            ...work,
            audio: {
              ...source,
              permissions: { ...source.permissions, adapt: false },
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      manifestSchema.safeParse({
        works: [
          { ...work, segments: [{ ...work.segments[0], durationMs: 9999 }] },
        ],
      }).success,
    ).toBe(false);
  });
  it("refuse les plateformes de streaming et les hôtes non HTTPS", () => {
    for (const url of [
      "https://youtu.be/a",
      "https://r1.googlevideo.com/a",
      "https://open.spotify.com/a",
      "http://example.test/a",
    ])
      expect(() => approvedDownloadUrl(url)).toThrow();
  });
  it("refuse deux extraits de même difficulté ou deux fois la même fiche", () => {
    expect(manifestSchema.safeParse({ works: [work, work] }).success).toBe(
      false,
    );
    expect(
      manifestSchema.safeParse({
        works: [{ ...work, segments: [...work.segments, ...work.segments] }],
      }).success,
    ).toBe(false);
  });
  it("intègre les métadonnées dans une transaction additive sans injecter les textes dans le SQL", () => {
    const sql = stageSql({ ...work, title: "$encore$'; select 999;" });
    expect(sql).not.toContain("select 999");
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).toContain("false,'authorized'");
  });
});
