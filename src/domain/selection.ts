import type { Clip } from "./game";
import type { Settings } from "./settings";
export type Seen = { workId: string; lastPlayed: number; count: number };
export function selectClips(
  clips: Clip[],
  settings: Settings,
  history: Seen[],
  random: () => number = Math.random,
) {
  const eligible = clips.filter(
    (c) =>
      settings.difficulties.includes(c.difficulty) &&
      c.categories.some((x) => settings.categories.includes(x)) &&
      c.durationMs >= settings.listenSeconds * 1000,
  );
  const works = new Map<string, Clip[]>();
  for (const c of eligible)
    works.set(c.workId, [...(works.get(c.workId) ?? []), c]);
  const weighted = [...works]
    .map(([workId, options]) => {
      const seen = history.filter((h) => h.workId === workId);
      const last = Math.max(0, ...seen.map((h) => h.lastPlayed));
      return {
        workId,
        options,
        last,
        random: random(),
        reason: seen.length ? "previously-played" : "unseen",
      };
    })
    .sort((a, b) => a.last - b.last || a.random - b.random);
  if (weighted.length < settings.rounds)
    throw new Error(
      `${weighted.length} œuvres disponibles pour ${settings.rounds} manches.`,
    );
  const counts = { easy: 0, normal: 0, hard: 0 };
  return weighted.slice(0, settings.rounds).map((w) => {
    const options = w.options
      .map((c) => ({ c, r: random() }))
      .sort(
        (a, b) => counts[a.c.difficulty] - counts[b.c.difficulty] || a.r - b.r,
      );
    const clip = options[0].c;
    counts[clip.difficulty]++;
    return {
      clip,
      metadata: { workId: w.workId, reason: w.reason, lastPlayed: w.last },
    };
  });
}
