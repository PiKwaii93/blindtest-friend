import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import audit from "../catalogue/legacy-400-aliases-controle.json";
import oldAliases from "../catalogue/dessins-animes-300-aliases.json";
import {
  normalize,
  normalizeAnswer,
  validateAnswer,
} from "../src/domain/answers";
const gameAliases = readFileSync(
  new URL("../catalogue/jeux-video-100.selection.tsv", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .map((line) => (line.split("\t")[3] ?? "").split("|"));
function accepted(id: string) {
  const row = audit.find((w) => w.editorialId === id)!;
  return [
    row.title,
    ...row.accepted,
    ...(id.startsWith("da-")
      ? ((oldAliases as Record<string, string[]>)[id] ?? [])
      : gameAliases[Number(id.slice(3)) - 1]),
  ];
}
describe("audit des 300 anciens dessins animés et 100 jeux", () => {
  it("couvre exactement les 400 identifiants demandés et limite les variantes à des clés distinctes", () => {
    expect(audit).toHaveLength(400);
    expect(new Set(audit.map((w) => w.editorialId)).size).toBe(400);
    for (const [prefix, count] of [
      ["da", 300],
      ["vg", 100],
    ] as const)
      for (let i = 1; i <= count; i++)
        expect(
          audit.some(
            (w) => w.editorialId === `${prefix}-${String(i).padStart(3, "0")}`,
          ),
        ).toBe(true);
    const indexed = new Map<string, string>();
    for (const row of audit) {
      expect(new Set(row.accepted.map(normalize)).size).toBe(
        row.accepted.length,
      );
      for (const alias of row.accepted) {
        const key = normalizeAnswer(alias);
        expect(indexed.get(key) ?? row.editorialId, alias).toBe(
          row.editorialId,
        );
        indexed.set(key, row.editorialId);
      }
    }
  });
  it.each(["easy", "normal", "hard"] as const)(
    "accepte les variantes naturelles sans changer le seuil %s",
    (difficulty) => {
      for (const [id, answer] of [
        ["da-001", "ScoobyDoo"],
        ["da-039", "La Cour de récréation"],
        ["da-046", "Sponge Bob"],
        ["da-065", "Ben10"],
        ["da-086", "PawPatrol"],
        ["da-089", "Lego Ninjago"],
        ["da-111", "Les 3 Mousquetaires"],
        ["da-198", "BTAS"],
        ["da-202", "Teen Titans"],
        ["da-227", "T'choupi"],
        ["da-256", "Brandy et Mr Moustache"],
        ["da-258", "Hercule"],
        ["da-272", "Raiponce"],
        ["vg-001", "SMB"],
        ["vg-003", "SM 64"],
        ["vg-008", "MK 8"],
        ["vg-010", "ALTTP"],
        ["vg-011", "OOT"],
        ["vg-015", "Pokemon Version Bleue"],
        ["vg-048", "FF 7"],
        ["vg-049", "FF VIII"],
        ["vg-068", "TES V"],
        ["vg-072", "Doom2016"],
        ["vg-074", "Portal2"],
        ["vg-081", "GTAV"],
        ["vg-096", "RE 2"],
        ["vg-100", "Drakes Fortune"],
      ])
        expect(
          validateAnswer(answer, accepted(id), difficulty),
          `${id}: ${answer}`,
        ).toBe(true);
    },
  );
  it.each(["easy", "normal", "hard"] as const)(
    "préserve les séries et numéros différents en %s",
    (difficulty) => {
      for (const [id, answer] of [
        ["da-065", "Ben11"],
        ["da-081", "Teen Titans"],
        ["da-102", "Albator"],
        ["da-103", "Albator"],
        ["da-197", "Batman"],
        ["da-199", "Batman"],
        ["da-205", "Xmen"],
        ["da-207", "Spiderman"],
        ["da-273", "Picsou"],
        ["da-296", "Tortues Ninja"],
        ["da-297", "Tortues Ninja"],
        ["vg-006", "MarioKart8"],
        ["vg-015", "Pokemon Or"],
        ["vg-016", "Pokemon Bleu"],
        ["vg-037", "Sonic2"],
        ["vg-048", "FF 8"],
        ["vg-049", "FF 7"],
        ["vg-050", "FF 8"],
        ["vg-071", "Doom2016"],
        ["vg-072", "Doom"],
        ["vg-074", "Portal3"],
        ["vg-081", "GTA4"],
      ])
        expect(
          validateAnswer(answer, accepted(id), difficulty),
          `${answer} ne doit pas valider ${id}`,
        ).toBe(false);
    },
  );
});
