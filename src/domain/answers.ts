import type { Settings } from "./settings";
import { cartoonFranchise } from "./cartoon-franchises";
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
export function normalizeAnswer(value: string): string {
  // Answer equivalence must not change the existing database alias keys.
  // NFKD also handles the full-width ampersand ＆ before punctuation is removed.
  return normalize(value.normalize("NFKD").replace(/&/g, " et ")).replace(
    /(^| )and(?= |$)/g,
    "$1et",
  );
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
  return (
    normalizeAnswer(s)
      // Keep edition numbers significant even when typed without a separating space.
      .replace(/(\p{L})(\p{N})/gu, "$1 $2")
      .replace(/(\p{N})(\p{L})/gu, "$1 $2")
      .split(" ")
      .filter((t) => !articles.has(t))
      .map((t) => roman[t] ?? t)
  );
}
const linkingWords = new Set([
  "et",
  "de",
  "du",
  "des",
  "au",
  "aux",
  "en",
  "ou",
]);
function repairLinkingWords(input: string[], target: string[]) {
  // Repair a typed connector in place, never infer an omitted word or repair a name.
  // Two substantive words must remain, so short titles and initials stay protected.
  if (
    input.length !== target.length ||
    target.filter((word) => !linkingWords.has(word)).length < 2
  )
    return input;
  return input.map((word, index) =>
    linkingWords.has(target[index]) &&
    /^[a-z]+$/.test(word) &&
    distance(word, target[index]) === 1
      ? target[index]
      : word,
  );
}
export function validateAnswer(
  answer: string,
  accepted: string[],
  difficulty: Settings["difficulties"][number],
  important: string[] = [],
  cartoonId?: string,
): boolean {
  return (
    assessAnswer(answer, accepted, difficulty, important, cartoonId) === null
  );
}

export type Rejection =
  | "invalid"
  | "short"
  | "number"
  | "important"
  | "incomplete"
  | "similarity"
  | "version";

export function assessAnswer(
  answer: string,
  accepted: string[],
  difficulty: Settings["difficulties"][number],
  important: string[] = [],
  cartoonId?: string,
): Rejection | null {
  const input = tokens(answer);
  const normalized = input.join(" ");
  if (!normalized || answer.length > 200) return "invalid";
  const threshold = { easy: 0.75, normal: 0.82, hard: 0.9 }[difficulty];
  const franchise = cartoonFranchise(cartoonId);
  if (franchise) {
    const key = (text: string) => tokens(text).join("");
    const answerKey = key(answer);
    const general = franchise.group.franchiseAliases;
    const generalKeys = new Set(general.map(key));
    const own = franchise.version.names.filter(
      (name) => !generalKeys.has(key(name)),
    );
    const others = franchise.group.versions
      .filter((v) => v.editorialId !== cartoonId)
      .flatMap((v) => v.names)
      .filter((name) => !generalKeys.has(key(name)));
    if (own.some((name) => key(name) === answerKey)) {
      const currentNames = [...accepted, ...franchise.version.explicitNames];
      if (currentNames.some((name) => key(name) === answerKey)) return null;
      return assessAnswer(answer, currentNames, difficulty, important);
    }
    if (others.some((name) => key(name) === answerKey)) return "version";
    if (generalKeys.has(answerKey)) return null;
    // A misspelled version name must not fall back to a shorter franchise alias.
    const proximity = (name: string) => {
      const candidate = key(name);
      return (
        1 -
        distance(answerKey, candidate) /
          Math.max(answerKey.length, candidate.length, 1)
      );
    };
    const ownBest = Math.max(
      0,
      ...own.map(proximity),
      ...general.map(proximity),
    );
    const otherBest = Math.max(0, ...others.map(proximity));
    if (otherBest > ownBest && 0.8 * otherBest + 0.2 >= threshold)
      return "version";
    // Only tolerate typos in a franchise name, never extra words naming a version.
    const generalCandidates = general.filter(
      (name) => tokens(name).length === input.length,
    );
    if (
      generalCandidates.length &&
      assessAnswer(answer, generalCandidates, difficulty) === null
    )
      return null;
  }
  const priority: Rejection[] = [
    "invalid",
    "short",
    "number",
    "important",
    "incomplete",
    "similarity",
  ];
  let reason: Rejection = "invalid";
  function reject(candidate: Rejection) {
    if (priority.indexOf(candidate) > priority.indexOf(reason))
      reason = candidate;
  }
  for (const alias of accepted) {
    const target = tokens(alias);
    const repaired = repairLinkingWords(input, target);
    const candidate = repaired.join(" ");
    const title = target.join(" ");
    if (normalized === title) return null;
    if (Math.min(normalized.length, title.length) < 5) {
      reject("short");
      continue;
    }
    if (
      input.filter((t) => /^\d+$/.test(t)).join() !==
      target.filter((t) => /^\d+$/.test(t)).join()
    ) {
      reject("number");
      continue;
    }
    if (important.some((word) => !input.includes(normalize(word)))) {
      reject("important");
      continue;
    }
    // Require every significant title token: a missing sequel subtitle is never a typo.
    if (
      target.some(
        (word) =>
          !repaired.some(
            (t) =>
              1 - distance(t, word) / Math.max(t.length, word.length) >= 0.6,
          ),
      )
    ) {
      reject("incomplete");
      continue;
    }
    const edit =
      1 - distance(candidate, title) / Math.max(candidate.length, title.length);
    const tokenScore =
      target.filter((word) =>
        repaired.some(
          (t) => 1 - distance(t, word) / Math.max(t.length, word.length) >= 0.6,
        ),
      ).length / Math.max(input.length, target.length);
    if (0.8 * edit + 0.2 * tokenScore >= threshold) return null;
    reject("similarity");
  }
  return reason;
}
