export const clipReportLabels = {
  version: "Mauvaise version",
  timing: "Départ mal calé",
  volume: "Problème de volume",
  media: "Problème d’image ou de lecture",
} as const;
export type ClipReportReason = keyof typeof clipReportLabels;
