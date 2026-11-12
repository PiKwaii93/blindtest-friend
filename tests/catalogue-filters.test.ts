import { describe, expect, it } from "vitest";
import ratings from "../catalogue/popularite.json";
import frenchBroadcasts from "../catalogue/dessins-animes-diffusions-france.json";
import {
  generationForYear,
  generationLabel,
  popularityLevels,
} from "../src/domain/catalogue-filters";
import {
  defaultSettings,
  matchesRoomSettings,
  settingsSchema,
} from "../src/domain/settings";
import { selectClips } from "../src/domain/selection";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

describe("filtres génération et popularité", () => {
  it("utilise les lancements français vérifiés, y compris avant la diffusion en clair", () => {
    expect(frenchBroadcasts["da-027"].year).toBe(1995);
    expect(frenchBroadcasts["da-258"].year).toBe(1998);
    expect(frenchBroadcasts["da-260"].year).toBe(2003);
    expect(frenchBroadcasts["da-246"].year).toBe(2014);
    expect(generationForYear(frenchBroadcasts["da-027"].year)).toBe(1995);
    expect(generationForYear(frenchBroadcasts["da-260"].year)).toBe(2000);
    for (const entry of Object.values(frenchBroadcasts)) {
      expect(Number.isInteger(entry.year)).toBe(true);
      expect(entry.source).toMatch(/^https:\/\//);
    }
  });
  it("sépare les tranches de cinq ans aux bonnes limites", () => {
    expect([1989, 1990, 1994, 1995].map(generationForYear)).toEqual([
      1985, 1990, 1990, 1995,
    ]);
    expect(generationLabel(1990)).toBe("1990–1994");
    expect(generationForYear(null)).toBe("unknown");
    expect(generationForYear(undefined)).toBe("unknown");
  });

  it("accepte les anciennes règles et refuse les nouvelles valeurs invalides", () => {
    expect(settingsSchema.parse(defaultSettings)).toEqual(defaultSettings);
    expect(
      settingsSchema.parse({ ...defaultSettings, broadcastEra: "1990" })
        .broadcastEra,
    ).toBe("1990");
    expect(
      settingsSchema.safeParse({ ...defaultSettings, generation: 1992 })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...defaultSettings, popularity: "viral" })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.parse({ ...defaultSettings, generation: "unknown" })
        .generation,
    ).toBe("unknown");
  });

  it("applique les deux filtres ensemble au compteur et au tirage sans doublon", () => {
    const base = createPilotRound(youtubePilots[0]).playlist[0];
    const clips = [
      {
        ...base,
        id: "a",
        workId: "a",
        generationYear: 1994,
        popularity: "iconic" as const,
      },
      {
        ...base,
        id: "a-hard",
        workId: "a",
        difficulty: "hard" as const,
        generationYear: 1994,
        popularity: "iconic" as const,
      },
      {
        ...base,
        id: "b",
        workId: "b",
        generationYear: 1995,
        popularity: "iconic" as const,
      },
      {
        ...base,
        id: "c",
        workId: "c",
        generationYear: 1994,
        popularity: "popular" as const,
      },
      {
        ...base,
        id: "d",
        workId: "d",
        generationYear: null,
        popularity: "enthusiast" as const,
      },
    ];
    const settings = {
      ...defaultSettings,
      rounds: 1,
      categories: base.categories,
      generation: 1990,
      popularity: "iconic" as const,
    };
    const matching = clips.filter((clip) =>
      matchesRoomSettings(clip, settings),
    );
    expect(new Set(matching.map((clip) => clip.workId)).size).toBe(1);
    expect(selectClips(clips, settings, [])[0].clip.workId).toBe("a");
    expect(() => selectClips(clips, { ...settings, rounds: 2 }, [])).toThrow(
      "1 œuvres disponibles",
    );
    expect(
      clips
        .filter((clip) =>
          matchesRoomSettings(clip, {
            ...settings,
            generation: "unknown",
            popularity: undefined,
          }),
        )
        .map((clip) => clip.workId),
    ).toEqual(["d"]);
    expect(
      clips.every((clip) =>
        matchesRoomSettings(clip, {
          ...defaultSettings,
          categories: base.categories,
        }),
      ),
    ).toBe(true);
  });

  it("classe les 400 dessins animés et les 100 jeux sans inventer de statistiques", () => {
    expect(Object.keys(ratings.ratings)).toHaveLength(500);
    const indexed: Record<string, string> = ratings.ratings;
    for (const [prefix, count] of [
      ["da", 400],
      ["vg", 100],
    ] as const)
      for (let index = 1; index <= count; index++)
        expect(popularityLevels).toContain(
          indexed[`${prefix}-${String(index).padStart(3, "0")}`],
        );
  });
});
