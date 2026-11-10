import { describe, expect, it } from "vitest";
import { selectClips } from "../src/domain/selection";
import { defaultSettings, launchBlockers } from "../src/domain/settings";
import { hasConfirmedFrench } from "../src/domain/sandbox-review";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

describe("filtre VF du salon", () => {
  const base = createPilotRound(youtubePilots[0]).playlist[0];
  const path = "sandbox-video/da-048/test.mp4";
  const review = { path, startMs: 0, french: true };
  const clips = [
    { ...base, workId: "confirmed", french: hasConfirmedFrench(path, review) },
    {
      ...base,
      workId: "replaced",
      french: hasConfirmedFrench("replacement.mp4", review),
    },
    { ...base, workId: "legacy" },
  ];
  it("exclut les anciennes confirmations et les clips non contrôlés uniquement quand le filtre est actif", () => {
    const settings = { ...defaultSettings, rounds: 1, vfOnly: true };
    expect(selectClips(clips, settings, [])[0].clip.workId).toBe("confirmed");
    expect(() => selectClips(clips, { ...settings, rounds: 2 }, [])).toThrow(
      /1 œuvres disponibles/,
    );
    expect(
      selectClips(clips, { ...defaultSettings, rounds: 3 }, []),
    ).toHaveLength(3);
  });
  it("explique l’absence de résultats avec le filtre actif", () => {
    expect(
      launchBlockers({ ...defaultSettings, vfOnly: true }, 0, false, [
        { ready: true, team: null },
      ]),
    ).toContain("Aucune œuvre avec VF confirmée ne correspond à ces règles.");
  });
});
