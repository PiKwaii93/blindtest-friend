import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  matchesRoomSettings,
  selectedGenerations,
  settingsSchema,
  launchBlockers,
} from "../src/domain/settings";
import { selectClips } from "../src/domain/selection";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";
describe("sélection de plusieurs générations", () => {
  it("conserve les anciennes sélections et donne la priorité au nouveau choix explicite", () => {
    expect(
      selectedGenerations(
        { ...defaultSettings, generation: 1995 },
        [1990, 1995, 2000],
      ),
    ).toEqual([1995]);
    expect(
      selectedGenerations({ ...defaultSettings, broadcastEra: "1990" }, [
        1985,
        1990,
        1995,
        2000,
        "unknown",
      ]),
    ).toEqual([1990, 1995]);
    expect(
      selectedGenerations(defaultSettings, [1990, 2000, "unknown"]),
    ).toEqual([1990, 2000, "unknown"]);
    expect(
      selectedGenerations(
        { ...defaultSettings, generation: 1990, generations: [] },
        [1990, 2000],
      ),
    ).toEqual([]);
  });
  it("valide les valeurs et refuse les doublons ou les années hors tranche", () => {
    for (const generations of [[], [1995, 2005], [2000, "unknown"]])
      expect(
        settingsSchema.safeParse({ ...defaultSettings, generations }).success,
      ).toBe(true);
    for (const generations of [[1992], [1995, 1995], ["2000"], [2200]])
      expect(
        settingsSchema.safeParse({ ...defaultSettings, generations }).success,
      ).toBe(false);
  });
  it("compte et tire l’union des tranches sans doublon d’œuvre, indépendamment des anciens filtres", () => {
    const base = createPilotRound(youtubePilots[0]).playlist[0];
    const a = { ...base, id: "a", workId: "a", generationYear: 1996 };
    const b = { ...base, id: "b", workId: "b", generationYear: 2007 };
    const clips = [
      a,
      { ...a, id: "a-hard", difficulty: "hard" as const },
      b,
      { ...base, id: "c", workId: "c", generationYear: 2002 },
      { ...base, id: "d", workId: "d", generationYear: null },
    ];
    const settings = {
      ...defaultSettings,
      categories: base.categories,
      rounds: 2,
      generation: 1980,
      broadcastEra: "1980" as const,
      generations: [1995, 2005],
    };
    expect(
      new Set(
        clips
          .filter((c) => matchesRoomSettings(c, settings))
          .map((c) => c.workId),
      ),
    ).toEqual(new Set(["a", "b"]));
    expect(
      new Set(selectClips(clips, settings, []).map((r) => r.clip.workId)),
    ).toEqual(new Set(["a", "b"]));
    expect(
      clips
        .filter((c) =>
          matchesRoomSettings(c, { ...settings, generations: ["unknown"] }),
        )
        .map((c) => c.workId),
    ).toEqual(["d"]);
  });
  it("ne lance pas une partie lorsqu’aucune génération n’est cochée", () => {
    const clip = {
      ...createPilotRound(youtubePilots[0]).playlist[0],
      generationYear: 2000,
    };
    const settings = {
      ...defaultSettings,
      categories: clip.categories,
      generations: [],
    };
    expect(matchesRoomSettings(clip, settings)).toBe(false);
    expect(launchBlockers(settings, 0, false, [])).toContain(
      "Cochez au moins une génération.",
    );
  });
});
