import { z } from "zod";
export const difficulties = ["easy", "normal", "hard"] as const;
export const settingsSchema = z.object({
  categories: z.array(z.string().min(1)).min(1).max(100),
  difficulties: z.array(z.enum(difficulties)).min(1).max(3),
  rounds: z.number().int().min(1).max(50),
  listenSeconds: z.number().int().min(5).max(30),
  answerSeconds: z.number().int().min(5).max(30),
  mode: z.enum(["individual", "teams"]),
});
export type Settings = z.infer<typeof settingsSchema>;
export function launchBlockers(
  settings: Settings,
  eligible: number,
  unsaved: boolean,
  players: { ready: boolean; team: string | null }[],
) {
  const reasons: string[] = [];
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
      "Aucune œuvre éligible avec ces filtres et cette durée d’écoute.",
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
  listenSeconds: 10,
  answerSeconds: 10,
  mode: "individual",
};
