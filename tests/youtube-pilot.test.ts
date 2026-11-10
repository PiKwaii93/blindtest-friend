import { describe, expect, it } from "vitest";
import { publicGame } from "../src/domain/game";
import {
  createPilotRound,
  stepPilot,
  youtubePilots,
  type RoundClock,
} from "../src/domain/youtube-pilot";

function listening(): RoundClock {
  const initial = {
    game: createPilotRound(youtubePilots[0]),
    now: 0,
    wall: 0,
    media: null,
  };
  const one = stepPilot(initial, 0, null, { type: "loaded", playerId: "1" });
  const two = stepPilot(one, 0, null, { type: "loaded", playerId: "2" });
  return stepPilot(two, 3000, null);
}

describe("régie YouTube", () => {
  it("gèle l’écoute pendant une interruption et révèle à 10 secondes cumulées", () => {
    let clock = listening();
    clock = stepPilot(clock, 3100, 0);
    for (let i = 1; i <= 20; i++)
      clock = stepPilot(clock, 3100 + 100 * i, i / 10);
    clock = stepPilot(clock, 8100, null);
    clock = stepPilot(clock, 8200, 2);
    for (let i = 1; i <= 81; i++)
      clock = stepPilot(clock, 8200 + 100 * i, 2 + i / 10);
    expect(clock.game.phase).toBe("REVEAL");
    expect(clock.game.consumedMs).toBe(10000);
  });

  it("réutilise le buzz, les réponses et la reprise sans divulguer le média", () => {
    let clock = stepPilot(listening(), 3100, 0);
    clock = stepPilot(clock, 3300, 0.2, { type: "buzz", playerId: "1" });
    expect(clock.game.phase).toBe("ANSWERING");
    expect(clock.game.consumedMs).toBeCloseTo(200);
    clock = stepPilot(clock, 6000, null, {
      type: "answer",
      playerId: "1",
      answer: "Erreur",
    });
    clock = stepPilot(clock, 6500, null);
    expect(clock.game.excluded).toEqual(["1"]);
    expect(publicGame(clock.game).reveal).toBeNull();
    expect(JSON.stringify(publicGame(clock.game))).not.toContain(
      youtubePilots[0].source.videoId,
    );
    clock = stepPilot(clock, 6600, 0.2);
    clock = stepPilot(clock, 6700, 0.3, { type: "buzz", playerId: "2" });
    clock = stepPilot(clock, 7000, null, {
      type: "answer",
      playerId: "2",
      answer: "Code Lyoko",
    });
    expect(clock.game.winner).toBe("2");
    expect(publicGame(clock.game).reveal?.title).toBe("Code Lyoko");
  });

  it("écarte un saut dans la vidéo", () => {
    const clock = stepPilot(listening(), 3100, 0);
    expect(stepPilot(clock, 3200, 20).now).toBe(clock.now);
  });
});
