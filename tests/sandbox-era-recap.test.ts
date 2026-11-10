import { describe, expect, it } from "vitest";
import { roundRecap, start, transition } from "../src/domain/game";
import { selectClips } from "../src/domain/selection";
import { matchesRoomSettings } from "../src/domain/settings";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

const seed = createPilotRound(youtubePilots[0]);
const settings = { ...seed.settings, rounds: 1 };
const clip = { ...seed.playlist[0], path: "sandbox-video/test/clip.mp4" };

describe("époques et bilan du bac à sable", () => {
  it("applique le même filtre au compteur et au tirage", () => {
    const clips = [
      { ...clip, firstFrenchBroadcastYear: 1990 },
      { ...clip, id: "other", workId: "other", firstFrenchBroadcastYear: 2000 },
      {
        ...clip,
        id: "unknown",
        workId: "unknown",
        firstFrenchBroadcastYear: null,
      },
      { ...clip, id: "demo", workId: "demo" },
    ];
    for (const [era, id] of [
      ["1990", clip.id],
      ["unknown", "unknown"],
    ] as const) {
      const filtered = { ...settings, broadcastEra: era };
      expect(
        clips
          .filter((item) => matchesRoomSettings(item, filtered))
          .map((item) => item.id),
      ).toEqual([id]);
      expect(selectClips(clips, filtered, [])[0].clip.id).toBe(id);
    }
    expect(clips.every((item) => matchesRoomSettings(item, settings))).toBe(
      true,
    );
  });

  it("résume le premier buzz, le résultat et les signalements d’une manche courte", () => {
    const short = { ...clip, durationMs: 9900, freezeOnReveal: true };
    const game = start(settings, seed.players, [short], 0);
    const one = transition(game, { type: "loaded", playerId: "1" }, 0);
    const two = transition(one, { type: "loaded", playerId: "2" }, 0);
    const playing = transition(two, { type: "tick" }, 3000);
    const buzz = transition(playing, { type: "buzz", playerId: "1" }, 4300);
    const reveal = transition(
      buzz,
      { type: "answer", playerId: "1", answer: short.title },
      4500,
    );
    const complete = transition(reveal, { type: "tick" }, reveal.deadline!);
    expect(roundRecap(buzz, new Map())).toEqual([]);
    expect(roundRecap(complete, new Map([[0, 2]]))).toEqual([
      {
        number: 1,
        title: short.title,
        firstBuzzMs: 1300,
        found: true,
        reports: 2,
      },
    ]);
    const missed = transition(playing, { type: "tick" }, playing.deadline!);
    const missedComplete = transition(
      missed,
      { type: "tick" },
      missed.deadline!,
    );
    expect(roundRecap(missedComplete, new Map())).toEqual([
      {
        number: 1,
        title: short.title,
        firstBuzzMs: null,
        found: false,
        reports: 0,
      },
    ]);
  });
});
