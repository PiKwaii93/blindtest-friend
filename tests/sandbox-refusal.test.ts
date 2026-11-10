import { describe, expect, it } from "vitest";
import { assessAnswer, validateAnswer } from "../src/domain/answers";
import { publicGame, transition } from "../src/domain/game";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";

describe("retour sur une réponse refusée", () => {
  it("distingue les motifs sans bloquer les alias exacts", () => {
    expect(assessAnswer("Winx", ["Winx Club"], "normal")).toBe("short");
    expect(assessAnswer("Winx", ["Winx Club", "Winx"], "hard")).toBeNull();
    expect(assessAnswer("Ben 11", ["Ben 10"], "normal")).toBe("number");
    expect(
      assessAnswer("Tortues", ["Tortues Ninja"], "normal", ["Ninja"]),
    ).toBe("important");
    expect(assessAnswer("Tortues", ["Tortues Ninja"], "normal")).toBe(
      "incomplete",
    );
    expect(validateAnswer("Winx", ["Winx Club", "Winx"], "hard")).toBe(true);
  });

  it("réserve la réponse et son motif à son auteur à la révélation", () => {
    const initial = createPilotRound(youtubePilots[0]);
    initial.playlist[0].path = "sandbox-video/da-048/test.mp4";
    initial.phase = "PLAYING";
    initial.deadline = 10000;
    const buzz = transition(initial, { type: "buzz", playerId: "1" }, 1000);
    const wrong = transition(
      buzz,
      { type: "answer", playerId: "1", answer: "Test" },
      1100,
    );
    expect(publicGame(wrong, "1").refusal).toBeUndefined();
    expect(publicGame(wrong, "1").attempts[0]).not.toHaveProperty("answer");
    const revealed = transition(wrong, { type: "tick" }, wrong.deadline!);
    expect(publicGame(revealed, "1").refusal).toEqual({
      answer: "Test",
      reason: "short",
    });
    expect(publicGame(revealed, "2").refusal).toBeUndefined();
    expect(publicGame(revealed).refusal).toBeUndefined();
  });
});
