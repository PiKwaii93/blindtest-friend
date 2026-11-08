import type { Settings } from "./settings";
export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])),
      );
    row = next;
  }
  return row[b.length];
}
const articles = new Set(["le", "la", "les", "l", "the", "a", "an"]);
const roman: Record<string, string> = {
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};
function tokens(s: string) {
  return normalize(s)
    .split(" ")
    .filter((t) => !articles.has(t))
    .map((t) => roman[t] ?? t);
}
export function validateAnswer(
  answer: string,
  accepted: string[],
  difficulty: Settings["difficulties"][number],
  important: string[] = [],
): boolean {
  const input = tokens(answer);
  const normalized = input.join(" ");
  if (!normalized || answer.length > 200) return false;
  const threshold = { easy: 0.75, normal: 0.82, hard: 0.9 }[difficulty];
  return accepted.some((alias) => {
    const target = tokens(alias);
    const title = target.join(" ");
    if (normalized === title) return true;
    if (Math.min(normalized.length, title.length) < 5) return false;
    if (
      input.filter((t) => /^\d+$/.test(t)).join() !==
      target.filter((t) => /^\d+$/.test(t)).join()
    )
      return false;
    if (important.some((word) => !input.includes(normalize(word))))
      return false;
    // Require every significant title token: a missing sequel subtitle is never a typo.
    if (
      target.some(
        (word) =>
          !input.some(
            (t) =>
              1 - distance(t, word) / Math.max(t.length, word.length) >= 0.6,
          ),
      )
    )
      return false;
    const edit =
      1 -
      distance(normalized, title) / Math.max(normalized.length, title.length);
    const tokenScore =
      target.filter((word) =>
        input.some(
          (t) => 1 - distance(t, word) / Math.max(t.length, word.length) >= 0.6,
        ),
      ).length / Math.max(input.length, target.length);
    return 0.8 * edit + 0.2 * tokenScore >= threshold;
  });
}
