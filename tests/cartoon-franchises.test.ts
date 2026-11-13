import { describe, expect, it } from "vitest";
import catalogue from "../catalogue/cartoon-franchises.json";
import { assessAnswer, validateAnswer } from "../src/domain/answers";
import { publicGame, transition } from "../src/domain/game";
import { createPilotRound, youtubePilots } from "../src/domain/youtube-pilot";
function version(id: string) {
  return catalogue.groups
    .flatMap((g) => g.versions)
    .find((v) => v.editorialId === id)!;
}
describe("franchises de dessins animés", () => {
  it("accepte aussi le nom explicite de la bonne version sans espaces", () => {
    expect(
      validateAnswer(
        "JusticeLeagueAction",
        ["La Ligue des justiciers : Action", "Justice League Action"],
        "hard",
        [],
        "da-327",
      ),
    ).toBe(true);
    expect(
      validateAnswer(
        "JusticeLeagueAction",
        ["La Ligue des justiciers"],
        "hard",
        [],
        "da-201",
      ),
    ).toBe(false);
  });
  it("ne restaure pas un ancien alias supprimé des réponses acceptées par l’admin", () => {
    expect(
      validateAnswer(
        "JusticeLeague Action",
        ["Autre titre"],
        "hard",
        [],
        "da-327",
      ),
    ).toBe(false);
    expect(
      validateAnswer(
        "Justice League 2001",
        ["La Ligue des justiciers"],
        "hard",
        [],
        "da-201",
      ),
    ).toBe(true);
  });
  it("couvre exactement les 400 dessins animés, sans jeu vidéo", () => {
    const ids = catalogue.groups.flatMap((g) =>
      g.versions.map((v) => v.editorialId),
    );
    expect(ids).toHaveLength(400);
    expect(new Set(ids).size).toBe(400);
    for (let i = 1; i <= 400; i++)
      expect(ids).toContain("da-" + String(i).padStart(3, "0"));
  });
  it.each(["easy", "normal", "hard"] as const)(
    "accepte les noms de franchise et conserve les noms propres à chaque version en %s",
    (difficulty) => {
      for (const group of catalogue.groups)
        for (const v of group.versions) {
          for (const answer of [...group.franchiseAliases, ...v.names])
            expect(
              validateAnswer(answer, v.names, difficulty, [], v.editorialId),
              `${v.editorialId}: ${answer}`,
            ).toBe(true);
        }
    },
  );
  it.each(["easy", "normal", "hard"] as const)(
    "refuse une autre version explicitement nommée en %s",
    (difficulty) => {
      for (const [id, answer] of [
        ["da-201", "Justice League Action"],
        ["da-327", "Justice League 2001"],
        ["da-202", "Teen Titans Go"],
        ["da-081", "Teen Titans 2003"],
        ["da-019", "TMNT 2012"],
        ["da-296", "Tortues Ninja 1987"],
        ["da-297", "TMNT 2003"],
        ["da-298", "TMNT 2012"],
        ["da-163", "DragonballZ"],
        ["da-164", "DBGT"],
        ["da-165", "Dragon Ball Super"],
        ["da-166", "Dragon Ball Z"],
        ["da-163", "DragonbalZ"],
        ["da-366", "Naruto Shippuden"],
        ["da-371", "FMA Brotherhood"],
        ["da-372", "FMA 2003"],
        ["da-392", "Yu-Gi-Oh GX"],
        ["da-170", "Yu-Gi-Oh 5DS"],
        ["da-273", "Picsou 1987"],
        ["da-017", "Picsou 2017"],
        ["da-198", "Batman Beyond"],
        ["da-324", "Batman 1992"],
        ["da-209", "Iron Man Armored Adventures"],
        ["da-206", "Ultimate Spider-Man"],
        ["da-207", "Spider-Man 1994"],
        ["da-329", "Avengers Rassemblement"],
        ["da-091", "Dragons Par-delà les rives"],
        ["da-243", "Kung Fu Panda Les Pattes du destin"],
      ])
        expect(
          assessAnswer(answer, version(id).names, difficulty, [], id),
          `${id}: ${answer}`,
        ).toBe("version");
    },
  );
  it.each(["easy", "normal", "hard"] as const)(
    "garde les jeux précis et les seuils habituels en %s",
    (difficulty) => {
      expect(
        validateAnswer(
          "Final Fantasy",
          ["Final Fantasy VII", "FF7"],
          difficulty,
          [],
          "vg-048",
        ),
      ).toBe(false);
      expect(
        validateAnswer(
          "FF8",
          ["Final Fantasy VII", "FF7"],
          difficulty,
          [],
          "vg-048",
        ),
      ).toBe(false);
      expect(
        validateAnswer(
          "Sonic",
          ["Sonic Adventure 2", "SA2"],
          difficulty,
          [],
          "vg-039",
        ),
      ).toBe(false);
      expect(
        validateAnswer(
          "Mario",
          ["Super Mario Galaxy", "Mario Galaxy"],
          difficulty,
          [],
          "vg-004",
        ),
      ).toBe(false);
      expect(
        validateAnswer(
          "FF7",
          ["Final Fantasy VII", "FF7"],
          difficulty,
          [],
          "vg-048",
        ),
      ).toBe(true);
      expect(
        validateAnswer(
          "Ligues des justiciers",
          version("da-327").names,
          difficulty,
          [],
          "da-327",
        ),
      ).toBe(true);
      expect(
        validateAnswer(
          "Les justiciers",
          version("da-327").names,
          difficulty,
          [],
          "da-327",
        ),
      ).toBe(false);
    },
  );
  it.each(["individual", "open"] as const)(
    "utilise la règle dans le moteur en mode %s et ne divulgue pas le catalogue privé",
    (mode) => {
      let game = createPilotRound(youtubePilots[0]);
      game.settings.mode = mode;
      game.phase = "PLAYING";
      game.startedAt = 0;
      game.deadline = 10000;
      game.playlist[0] = {
        ...game.playlist[0],
        title: "La Ligue des justiciers : Action",
        aliases: ["Justice League Action"],
        cartoonId: "da-327",
      };
      expect(JSON.stringify(publicGame(game, "1"))).not.toContain("da-327");
      expect(JSON.stringify(publicGame(game, "1"))).not.toContain(
        "Justice League Action",
      );
      if (mode === "individual")
        game = transition(game, { type: "buzz", playerId: "1" }, 1000);
      game = transition(
        game,
        { type: "answer", playerId: "1", answer: "La Ligue des justiciers" },
        1100,
      );
      expect(game.attempts.at(-1)?.correct).toBe(true);
      expect(game.players[0].score).toBeGreaterThan(0);
    },
  );
});
