import { describe, expect, it } from "vitest";
import { validateAnswer } from "../src/domain/answers";
import { sandboxTiming } from "../src/domain/sandbox-review";

describe("contrôle des génériques du bac à sable", () => {
  it("décale le départ tout en conservant la même fin utile", () => {
    expect(
      sandboxTiming("a.mp4", 500, 35000, {
        path: "a.mp4",
        startMs: 1500,
        french: true,
      }),
    ).toEqual({ startMs: 1500, usableMs: 34000 });
  });
  it("ignore un ancien contrôle quand le fichier a été remplacé", () => {
    expect(
      sandboxTiming("b.mp4", 500, 35000, {
        path: "a.mp4",
        startMs: 1500,
        french: true,
      }),
    ).toEqual({ startMs: 500, usableMs: 35000 });
  });
  it("accepte Winx comme alias exact même si la réponse compte quatre lettres", () => {
    expect(validateAnswer("Winx", ["Winx Club"], "normal")).toBe(false);
    expect(validateAnswer("Winx", ["Winx Club", "Winx"], "normal")).toBe(true);
  });
});
