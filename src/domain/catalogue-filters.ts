export const popularityLevels = ["iconic", "popular", "enthusiast"] as const;
export type Popularity = (typeof popularityLevels)[number];
export const popularityLabels: Record<Popularity, string> = {
  iconic: "Incontournables",
  popular: "Très connus",
  enthusiast: "Pour les fans",
};
export type Generation = number | "unknown";

export function generationForYear(year?: number | null): Generation {
  return year == null ? "unknown" : Math.floor(year / 5) * 5;
}

export function generationLabel(generation: Generation) {
  return generation === "unknown"
    ? "Année inconnue"
    : `${generation}–${generation + 4}`;
}
