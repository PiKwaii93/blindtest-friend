import { describe, expect, it } from "vitest";
import { cartoonActivationError, workSchema } from "../src/domain/catalogue";
import { associateDraftMedia } from "../src/domain/catalogue-batch";

const draft = {
  title: "Ulysse 31",
  categories: ["75217503-9931-4dbf-b5d3-28e264622073"],
  rights_source: "Droits à vérifier",
  is_active: false,
};

describe("Catalogue dessins animés", () => {
  it("accepte les brouillons sans clip et refuse leur activation", () => {
    expect(workSchema.parse(draft).clips).toEqual([]);
    expect(workSchema.safeParse({ ...draft, is_active: true }).success).toBe(
      false,
    );
  });
  it("associe les médias à la bonne fiche sans autoriser le clip ni écraser un doublon", () => {
    const { drafts, results } = associateDraftMedia(
      [
        { editorial_id: "da-012", is_active: false },
        { editorial_id: "da-013", is_active: false },
      ],
      [
        { name: "da-012.easy.wav", path: "first.wav" },
        { name: "da-012.easy.mp3", path: "other.mp3" },
        { name: "da-013.webp", path: "https://example.test/image.webp" },
      ],
    );
    if (!Array.isArray(drafts)) throw new Error("Expected a batch");
    expect(drafts[0].clips).toEqual([
      expect.objectContaining({
        audio_path: "first.wav",
        rights_status: "pending",
        is_active: false,
      }),
    ]);
    expect(drafts[1].image_path).toBe("https://example.test/image.webp");
    expect(results[1]).toContain("déjà renseignée");
  });
  it("exige licence, aperçu et dix secondes pour rendre la fiche jouable", () => {
    const work = workSchema.parse({
      ...draft,
      is_active: true,
      image_path: "https://example.test/cover.png",
      image_license: "Illustration originale autorisée",
      clips: [
        {
          audio_path: "demo.wav",
          difficulty: "normal",
          start_ms: 0,
          usable_duration_ms: 10000,
          rights_status: "authorized",
        },
      ],
    });
    expect(cartoonActivationError(work)).toContain("aperçu");
    work.clips[0].license_reference = "Autorisation écrite de diffusion";
    work.clips[0].previewed = true;
    expect(cartoonActivationError(work)).toBeNull();
    work.clips[0].audio_path = "sandbox-video/da-012/short.mp4";
    work.clips[0].usable_duration_ms = 9900;
    expect(cartoonActivationError(work)).toContain("dix secondes");
    expect(cartoonActivationError(work, work.clips[0].audio_path)).toBeNull();
  });
});
