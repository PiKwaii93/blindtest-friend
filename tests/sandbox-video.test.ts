import { describe, expect, it } from "vitest";
import { start, transition } from "../src/domain/game";
import { matchesRoomSettings } from "../src/domain/settings";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

function playing(video: boolean, short = false) {
  const seed = createPilotRound(youtubePilots[0]);
  const first = {
    ...seed.playlist[0],
    path: video ? "sandbox-video/da-048/test.mp4" : "demo/test.wav",
    ...(short ? { durationMs: 9900, freezeOnReveal: true } : {}),
  };
  const game = start(
    { ...seed.settings, rounds: 2 },
    seed.players,
    [first, { ...first, workId: "second", id: "second" }],
    0,
  );
  const one = transition(game, { type: "loaded", playerId: "1" }, 0);
  const two = transition(one, { type: "loaded", playerId: "2" }, 0);
  return transition(two, { type: "tick" }, 3000);
}
describe("révélation du bac à sable vidéo", () => {
  it("accepte 9,9 secondes en salon 10 s et conserve une révélation de 10 s", () => {
    const game = playing(true, true);
    const clip = game.playlist[0];
    expect(matchesRoomSettings(clip, game.settings)).toBe(true);
    expect(
      matchesRoomSettings({ ...clip, freezeOnReveal: false }, game.settings),
    ).toBe(false);
    expect(
      matchesRoomSettings(clip, { ...game.settings, listenSeconds: 11 }),
    ).toBe(false);
    expect(game.deadline).toBe(12900);
    const reveal = transition(game, { type: "tick" }, 12900);
    expect(reveal.phase).toBe("REVEAL");
    expect(reveal.consumedMs).toBe(9900);
    expect(reveal.deadline).toBe(22900);
  });
  it("conserve dix secondes après une bonne réponse", () => {
    const buzz = transition(
      playing(true),
      { type: "buzz", playerId: "1" },
      4500,
    );
    const reveal = transition(
      buzz,
      { type: "answer", playerId: "1", answer: "Code Lyoko" },
      4600,
    );
    expect(reveal.consumedMs).toBe(1500);
    expect(reveal.deadline).toBe(14600);
    expect(transition(reveal, { type: "tick" }, 14599).phase).toBe("REVEAL");
    const next = transition(reveal, { type: "tick" }, 14600);
    expect(next.phase).toBe("NEXT_ROUND");
    expect(next.deadline).toBe(15500);
    expect(transition(next, { type: "tick" }, 15500).phase).toBe("PREPARING");
  });

  it("donne la même durée après expiration et préserve les extraits audio", () => {
    expect(transition(playing(true), { type: "tick" }, 13000).deadline).toBe(
      23000,
    );
    expect(transition(playing(false), { type: "tick" }, 13000).deadline).toBe(
      18000,
    );
  });
});
