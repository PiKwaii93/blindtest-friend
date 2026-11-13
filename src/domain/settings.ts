import { z } from "zod";
import {
  generationForYear,
  popularityLevels,
  animationOrigins,
  type AnimationOrigin,
  type Popularity,
  type Generation,
} from "./catalogue-filters";
export const difficulties = ["easy", "normal", "hard"] as const;
export const broadcastEras = [
  "before1960",
  "1960",
  "1970",
  "1980",
  "1990",
  "2000",
  "2010",
  "2020",
  "unknown",
] as const;
export type BroadcastEra = (typeof broadcastEras)[number];
export const broadcastEraLabels: Record<BroadcastEra, string> = {
  before1960: "Avant 1960",
  "1960": "Années 60",
  "1970": "Années 70",
  "1980": "Années 80",
  "1990": "Années 90",
  "2000": "Années 2000",
  "2010": "Années 2010",
  "2020": "Depuis 2020",
  unknown: "Époque inconnue",
};
export function broadcastEra(year?: number | null): BroadcastEra {
  if (year == null) return "unknown";
  if (year < 1960) return "before1960";
  if (year >= 2020) return "2020";
  return String(Math.floor(year / 10) * 10) as BroadcastEra;
}
const generationSchema = z.union([
  z.number().int().min(1500).max(2195).multipleOf(5),
  z.literal("unknown"),
]);
export const settingsSchema = z.object({
  categories: z.array(z.string().min(1)).min(1).max(100),
  difficulties: z.array(z.enum(difficulties)).min(1).max(3),
  rounds: z.number().int().min(1).max(50),
  listenSeconds: z.number().int().min(5).max(30),
  answerSeconds: z.number().int().min(5).max(30),
  mode: z.enum(["individual", "teams", "open"]),
  vfOnly: z.boolean().optional(),
  broadcastEra: z.enum(broadcastEras).optional(),
  generation: generationSchema.optional(),
  generations: z
    .array(generationSchema)
    .max(141)
    .refine((values) => new Set(values).size === values.length)
    .optional(),
  popularity: z.enum(popularityLevels).optional(),
  animationOrigin: z.enum(["all", ...animationOrigins]).optional(),
});
export type Settings = z.infer<typeof settingsSchema>;
export function selectedGenerations(
  settings: Settings,
  available: Generation[],
): Generation[] {
  if (settings.generations !== undefined) return settings.generations;
  if (settings.generation !== undefined) return [settings.generation];
  if (settings.broadcastEra)
    return available.filter(
      (g) => broadcastEra(g === "unknown" ? null : g) === settings.broadcastEra,
    );
  return available;
}
export function matchesRoomSettings(
  clip: {
    categories: string[];
    difficulty: Settings["difficulties"][number];
    durationMs: number;
    freezeOnReveal?: boolean;
    french?: boolean;
    firstFrenchBroadcastYear?: number | null;
    generationYear?: number | null;
    popularity?: Popularity | null;
    animationOrigin?: AnimationOrigin | null;
  },
  settings: Settings,
) {
  return (
    (!settings.animationOrigin ||
      settings.animationOrigin === "all" ||
      clip.animationOrigin === undefined ||
      clip.animationOrigin === settings.animationOrigin) &&
    (!settings.vfOnly || clip.french === true) &&
    (settings.generations !== undefined
      ? settings.generations.includes(generationForYear(clip.generationYear))
      : settings.generation === undefined ||
        generationForYear(clip.generationYear) === settings.generation) &&
    (!settings.popularity || clip.popularity === settings.popularity) &&
    (settings.generations !== undefined ||
      !settings.broadcastEra ||
      (clip.firstFrenchBroadcastYear !== undefined &&
        broadcastEra(clip.firstFrenchBroadcastYear) ===
          settings.broadcastEra)) &&
    settings.difficulties.includes(clip.difficulty) &&
    clip.categories.some((name) => settings.categories.includes(name)) &&
    Number.isFinite(clip.durationMs) &&
    clip.durationMs > 0
  );
}
export function launchBlockers(
  settings: Settings,
  eligible: number,
  unsaved: boolean,
  players: { ready: boolean; team: string | null }[],
) {
  const reasons: string[] = [];
  if (settings.generations?.length === 0)
    reasons.push("Cochez au moins une génération.");
  if (!settings.categories.length)
    reasons.push("Sélectionnez au moins une catégorie.");
  if (!settings.difficulties.length)
    reasons.push("Sélectionnez au moins une difficulté.");
  if (
    !settingsSchema.safeParse(settings).success &&
    settings.categories.length &&
    settings.difficulties.length
  )
    reasons.push(
      "Vérifiez les valeurs des règles : 1 à 50 manches et délais de 5 à 30 secondes.",
    );
  if (unsaved) reasons.push("Enregistrez les règles modifiées.");
  if (!players.length) reasons.push("Au moins un participant est nécessaire.");
  if (players.some((p) => !p.ready))
    reasons.push("Tous les participants doivent être prêts (son activé).");
  if (
    settings.mode === "teams" &&
    (players.some((p) => !p.team) ||
      new Set(players.map((p) => p.team)).size < 2)
  )
    reasons.push(
      "Formez au moins deux équipes non vides et attribuez une équipe à chaque joueur.",
    );
  if (!eligible)
    reasons.push(
      settings.vfOnly
        ? "Aucune œuvre avec VF confirmée ne correspond à ces règles."
        : "Aucune œuvre éligible avec ces filtres et cette durée d’écoute.",
    );
  else if (eligible < settings.rounds)
    reasons.push(
      `Seulement ${eligible} œuvres éligibles pour ${settings.rounds} manches.`,
    );
  return reasons;
}
export const categoryNames = [
  "Jeux vidéo",
  "Films",
  "Séries",
  "Dessins animés",
  "Animés japonais",
  "Musiques populaires",
  "Génériques TV",
];
export const defaultSettings: Settings = {
  categories: categoryNames,
  difficulties: [...difficulties],
  rounds: 20,
  listenSeconds: 15,
  answerSeconds: 15,
  mode: "individual",
};
