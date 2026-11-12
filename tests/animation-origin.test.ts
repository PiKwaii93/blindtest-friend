import { describe, expect, it } from "vitest";
import originData from "../catalogue/origines-animation.json";
import { animationOrigins } from "../src/domain/catalogue-filters";
import {
  defaultSettings,
  matchesRoomSettings,
  settingsSchema,
} from "../src/domain/settings";
import { selectClips } from "../src/domain/selection";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

describe("origine de l’animation", () => {
  it("garde les deux origines dans les anciennes règles", () => {
    expect(settingsSchema.parse(defaultSettings)).toEqual(defaultSettings);
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        animationOrigin: "language-fr",
      }).success,
    ).toBe(false);
    for (const animationOrigin of ["all", ...animationOrigins])
      expect(
        settingsSchema.safeParse({ ...defaultSettings, animationOrigin })
          .success,
      ).toBe(true);
  });
  it("classe Pokémon comme animé japonais indépendamment de son générique français", () => {
    expect(originData.origins["da-167"]).toBe("japanese");
    expect(originData.origins["da-047"]).toBe("western");
    expect(originData.origins["da-055"]).toBe("western");
    expect(
      Object.values(originData.origins).every((v) =>
        animationOrigins.includes(v as "western" | "japanese"),
      ),
    ).toBe(true);
  });
  it("applique le même filtre aux compteurs et au tirage, sans dupliquer une œuvre", () => {
    const base = createPilotRound(youtubePilots[0]).playlist[0];
    const western = { ...base, animationOrigin: "western" as const };
    const japanese = {
      ...base,
      id: "jp",
      workId: "jp",
      animationOrigin: "japanese" as const,
      french: true,
    };
    const settings = {
      ...defaultSettings,
      categories: base.categories,
      rounds: 2,
    };
    const clips = [
      western,
      { ...western, id: "another-difficulty", difficulty: "hard" as const },
      japanese,
    ];
    for (const origin of animationOrigins) {
      const rules = { ...settings, animationOrigin: origin, rounds: 1 };
      const eligible = new Set(
        clips.filter((c) => matchesRoomSettings(c, rules)).map((c) => c.workId),
      );
      expect(eligible.size).toBe(1);
      expect(selectClips(clips, rules, [])[0].clip.animationOrigin).toBe(
        origin,
      );
    }
    expect(
      new Set(
        selectClips(clips, { ...settings, animationOrigin: "all" }, []).map(
          (x) => x.clip.workId,
        ),
      ).size,
    ).toBe(2);
  });
  it("préserve les autres univers et réserve les origines inconnues au choix Les deux", () => {
    const base = createPilotRound(youtubePilots[0]).playlist[0];
    const rules = {
      ...defaultSettings,
      categories: base.categories,
      animationOrigin: "japanese" as const,
    };
    expect(
      matchesRoomSettings({ ...base, animationOrigin: undefined }, rules),
    ).toBe(true);
    expect(matchesRoomSettings({ ...base, animationOrigin: null }, rules)).toBe(
      false,
    );
    expect(
      matchesRoomSettings(
        { ...base, animationOrigin: null },
        { ...rules, animationOrigin: "all" },
      ),
    ).toBe(true);
  });
});
