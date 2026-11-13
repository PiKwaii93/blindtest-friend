import { assessAnswer, validateAnswer } from "./answers";
import { settingsSchema, type Settings } from "./settings";
import type { Popularity, AnimationOrigin } from "./catalogue-filters";
export type Player = {
  id: string;
  name: string;
  team: string | null;
  ready: boolean;
  score: number;
  correct: number;
  winningMs: number;
};
export type Clip = {
  id: string;
  workId: string;
  title: string;
  aliases: string[];
  important: string[];
  categories: string[];
  image: string | null;
  imageAttribution?: string | null;
  path: string;
  difficulty: "easy" | "normal" | "hard";
  startMs: number;
  durationMs: number;
  freezeOnReveal?: boolean;
  french?: boolean;
  firstFrenchBroadcastYear?: number | null;
  generationYear?: number | null;
  popularity?: Popularity | null;
  animationOrigin?: AnimationOrigin | null;
};
export type Phase =
  | "LOBBY"
  | "PREPARING"
  | "COUNTDOWN"
  | "PLAYING"
  | "ANSWERING"
  | "REVEAL"
  | "NEXT_ROUND"
  | "FINISHED";
export type Attempt = {
  playerId: string;
  acceptedAt: number;
  remainingMs: number;
  answer?: string;
  correct?: boolean;
  points?: number;
};
export type Game = {
  phase: Phase;
  settings: Settings;
  players: Player[];
  playlist: Clip[];
  round: number;
  consumedMs: number;
  startedAt: number;
  deadline: number | null;
  excluded: string[];
  loaded: string[];
  attempts: Attempt[];
  winner: string | null;
  departed?: string[];
  disconnected?: string[];
  completedRounds?: {
    number: number;
    workId: string;
    clipId: string;
    consumedMs: number;
    attempts: Attempt[];
    winner: string | null;
  }[];
  selectionMetadata?: { workId: string; reason: string; lastPlayed: number }[];
  preparationError?: string;
};
export type Action =
  | { type: "tick" }
  | { type: "loaded"; playerId: string }
  | { type: "buzz"; playerId: string }
  | { type: "answer"; playerId: string; answer: string };
export function points(remaining: number, total: number) {
  return Math.max(
    100,
    Math.min(200, 100 + Math.floor((100 * remaining) / total)),
  );
}
export function ranking(players: Player[]) {
  return [...players].sort(
    (a, b) =>
      b.score - a.score || b.correct - a.correct || a.winningMs - b.winningMs,
  );
}
export function rankPosition(sorted: Player[], index: number): number {
  const player = sorted[index];
  let first = index;
  while (first > 0) {
    const previous = sorted[first - 1];
    if (
      previous.score !== player.score ||
      previous.correct !== player.correct ||
      previous.winningMs !== player.winningMs
    )
      break;
    first--;
  }
  return first + 1;
}
export function teams(players: Player[]) {
  const groups = new Map<string, Player>();
  for (const p of players) {
    const id = p.team ?? "Sans équipe";
    const t = groups.get(id) ?? {
      ...p,
      id,
      name: id,
      score: 0,
      correct: 0,
      winningMs: 0,
    };
    t.score += p.score;
    t.correct += p.correct;
    t.winningMs += p.winningMs;
    groups.set(id, t);
  }
  return ranking([...groups.values()]);
}
export function start(
  settings: Settings,
  players: Player[],
  playlist: Clip[],
  now: number,
): Game {
  settingsSchema.parse(settings);
  if (!players.length || players.some((p) => !p.ready))
    throw new Error("Tous les joueurs doivent être prêts.");
  if (
    settings.mode === "teams" &&
    (players.some((p) => !p.team) ||
      new Set(players.map((p) => p.team)).size < 2)
  )
    throw new Error("Deux équipes non vides sont nécessaires.");
  if (
    playlist.length !== settings.rounds ||
    new Set(playlist.map((c) => c.workId)).size !== settings.rounds
  )
    throw new Error("Catalogue insuffisant.");
  return {
    phase: "PREPARING",
    settings,
    players: players.map((p) => ({ ...p, score: 0, correct: 0, winningMs: 0 })),
    playlist,
    round: 0,
    consumedMs: 0,
    startedAt: now,
    deadline: now + 20000,
    excluded: [],
    loaded: [],
    attempts: [],
    winner: null,
  };
}
export const sandboxVideoRevealMs = 10000;
export function isSandboxVideo(path: string) {
  return path.startsWith("sandbox-video/") && path.endsWith(".mp4");
}
function clipListenBudget(settings: Settings, clip?: Clip) {
  const requested = settings.listenSeconds * 1000;
  return clip ? Math.min(requested, clip.durationMs) : requested;
}
function listenBudget(g: Game) {
  return clipListenBudget(g.settings, g.playlist[g.round]);
}

export function roundRecap(
  game: Game,
  reportCounts: ReadonlyMap<number, number>,
) {
  return (game.completedRounds ?? []).flatMap((round) => {
    const index = round.number - 1;
    const clip = game.playlist[index];
    if (!clip || clip.id !== round.clipId) return [];
    const first =
      game.settings.mode === "open"
        ? round.attempts.find((attempt) => attempt.correct)
        : round.attempts[0];
    return [
      {
        number: round.number,
        title: clip.title,
        firstBuzzMs: first
          ? Math.max(
              0,
              clipListenBudget(game.settings, clip) - first.remainingMs,
            )
          : null,
        found: round.winner !== null,
        reports: reportCounts.get(index) ?? 0,
      },
    ];
  });
}
function reveal(g: Game, now: number) {
  g.phase = "REVEAL";
  g.deadline =
    now +
    (g.settings.mode === "open" || isSandboxVideo(g.playlist[g.round].path)
      ? sandboxVideoRevealMs
      : 5000);
  g.startedAt = now;
}
export function revealIfEveryoneFound(g: Game, now: number) {
  if (g.settings.mode !== "open" || g.phase !== "PLAYING") return;
  const active = g.players.filter(
    (p) => !g.departed?.includes(p.id) && !g.disconnected?.includes(p.id),
  );
  if (
    !active.length ||
    !active.every((p) =>
      g.attempts.some((a) => a.playerId === p.id && a.correct),
    )
  )
    return;
  // Continue the reveal from the current media position, not from the full round budget.
  g.consumedMs = Math.min(
    listenBudget(g),
    g.consumedMs + Math.max(0, now - g.startedAt),
  );
  reveal(g, now);
}
export function advancePreparationIfReady(g: Game, now: number) {
  if (g.phase !== "PREPARING") return;
  const active = g.players.filter(
    (p) =>
      !g.departed?.includes(p.id) &&
      !(g.settings.mode === "open" && g.disconnected?.includes(p.id)),
  );
  if (active.length && active.every((p) => g.loaded.includes(p.id))) {
    g.phase = "COUNTDOWN";
    g.startedAt = now;
    g.deadline = now + 3000;
  }
}
function fail(g: Game, now: number) {
  const a = g.attempts.at(-1)!;
  a.correct = false;
  a.points = 0;
  if (!g.excluded.includes(a.playerId)) g.excluded.push(a.playerId);
  if (g.excluded.length === g.players.length || g.consumedMs >= listenBudget(g))
    reveal(g, now);
  else {
    g.phase = "PLAYING";
    g.startedAt = now + 500;
    g.deadline = g.startedAt + listenBudget(g) - g.consumedMs;
  }
}
export function transition(state: Game, action: Action, now: number): Game {
  const g = structuredClone(state);
  // Expiration wins over any late command. An accepted buzz keeps its own answer deadline.
  if (g.deadline !== null && now >= g.deadline) {
    if (g.phase === "PREPARING") {
      g.phase = "FINISHED";
      g.preparationError =
        "Préchargement audio impossible : partie interrompue.";
      g.deadline = null;
    } else if (g.phase === "COUNTDOWN") {
      g.phase = "PLAYING";
      g.startedAt = g.deadline;
      g.deadline = g.startedAt + listenBudget(g);
    } else if (g.phase === "PLAYING") {
      g.consumedMs = listenBudget(g);
      reveal(g, now);
    } else if (g.phase === "ANSWERING") fail(g, now);
    else if (g.phase === "REVEAL") {
      g.completedRounds ??= [];
      g.completedRounds.push({
        number: g.round + 1,
        workId: g.playlist[g.round].workId,
        clipId: g.playlist[g.round].id,
        consumedMs: g.consumedMs,
        attempts: structuredClone(g.attempts),
        winner: g.winner,
      });
      g.phase = "NEXT_ROUND";
      g.deadline =
        now +
        (isSandboxVideo(g.playlist[g.round].path) &&
        g.round + 1 < g.settings.rounds
          ? 900
          : 500);
    } else if (g.phase === "NEXT_ROUND") {
      if (g.round + 1 >= g.settings.rounds) {
        g.phase = "FINISHED";
        g.deadline = null;
      } else {
        g.round++;
        g.phase = "PREPARING";
        g.startedAt = now;
        g.deadline = now + 20000;
        g.consumedMs = 0;
        g.excluded = [...(g.departed ?? [])];
        g.loaded = [...(g.departed ?? [])];
        g.attempts = [];
        g.winner = null;
      }
    }
    return g;
  }
  if (action.type === "tick") return g;
  if (!g.players.some((p) => p.id === action.playerId))
    throw new Error("Participant inconnu.");
  if (g.departed?.includes(action.playerId))
    throw new Error("Vous avez quitté cette partie.");
  if (action.type === "loaded" && g.phase === "PREPARING") {
    if (!g.loaded.includes(action.playerId)) g.loaded.push(action.playerId);
    advancePreparationIfReady(g, now);
  }
  if (action.type === "buzz") {
    if (
      g.settings.mode === "open" ||
      g.phase !== "PLAYING" ||
      now < g.startedAt ||
      g.excluded.includes(action.playerId)
    )
      throw new Error("Buzz indisponible.");
    g.consumedMs += now - g.startedAt;
    g.phase = "ANSWERING";
    g.deadline = now + g.settings.answerSeconds * 1000;
    g.attempts.push({
      playerId: action.playerId,
      acceptedAt: now,
      remainingMs: listenBudget(g) - g.consumedMs,
    });
  }
  if (action.type === "answer") {
    if (g.settings.mode === "open") {
      if (g.phase !== "PLAYING" || now < g.startedAt)
        throw new Error("Les réponses sont fermées.");
      if (g.attempts.some((a) => a.playerId === action.playerId && a.correct))
        throw new Error("Vous avez déjà trouvé cette œuvre.");
      const clip = g.playlist[g.round];
      const elapsed = Math.max(0, now - g.startedAt);
      const remainingMs = Math.max(0, listenBudget(g) - elapsed);
      const correct = validateAnswer(
        action.answer,
        [clip.title, ...clip.aliases],
        clip.difficulty,
        clip.important,
      );
      const score = correct ? points(remainingMs, listenBudget(g)) : 0;
      g.attempts.push({
        playerId: action.playerId,
        acceptedAt: now,
        remainingMs,
        answer: action.answer,
        correct,
        points: score,
      });
      if (correct) {
        const player = g.players.find((p) => p.id === action.playerId)!;
        player.score += score;
        player.correct++;
        player.winningMs += elapsed;
        g.winner ??= player.id;
        revealIfEveryoneFound(g, now);
      }
      // Other players keep their listening clock until everyone has found the answer.
      return g;
    }
    const a = g.attempts.at(-1);
    if (
      g.phase !== "ANSWERING" ||
      !a ||
      a.playerId !== action.playerId ||
      a.answer !== undefined
    )
      throw new Error("Tentative déjà terminée.");
    a.answer = action.answer;
    const clip = g.playlist[g.round];
    a.correct = validateAnswer(
      action.answer,
      [clip.title, ...clip.aliases],
      clip.difficulty,
      clip.important,
    );
    if (a.correct) {
      a.points = points(a.remainingMs, listenBudget(g));
      const p = g.players.find((p) => p.id === a.playerId)!;
      p.score += a.points;
      p.correct++;
      p.winningMs += g.consumedMs;
      g.winner = p.id;
      reveal(g, now);
    } else fail(g, now);
  }
  return g;
}
export function publicGame(g: Game, viewerId?: string) {
  const {
    playlist,
    completedRounds: _completedRounds,
    selectionMetadata: _selectionMetadata,
    ...safe
  } = g;
  void _completedRounds;
  void _selectionMetadata;
  const clip = playlist[g.round];
  const refused =
    viewerId &&
    g.phase === "REVEAL" &&
    isSandboxVideo(clip.path) &&
    !g.attempts.some(
      (attempt) => attempt.playerId === viewerId && attempt.correct,
    )
      ? g.attempts.findLast(
          (attempt) =>
            attempt.playerId === viewerId &&
            attempt.correct === false &&
            attempt.answer !== undefined,
        )
      : undefined;
  return {
    ...safe,
    ...(refused?.answer !== undefined
      ? {
          refusal: {
            answer: refused.answer,
            reason: assessAnswer(
              refused.answer,
              [clip.title, ...clip.aliases],
              clip.difficulty,
              clip.important,
            ),
          },
        }
      : {}),
    attempts: g.attempts.map(({ answer, ...a }) => {
      const revealed = g.phase === "REVEAL" || g.phase === "FINISHED";
      return {
        ...a,
        ...(revealed && g.settings.mode !== "open" && answer !== undefined
          ? { answer }
          : {}),
      };
    }),
    reveal:
      g.phase === "REVEAL" || g.phase === "FINISHED"
        ? {
            title: clip.title,
            aliases: clip.aliases,
            categories: clip.categories,
            image: clip.image,
            imageAttribution: clip.imageAttribution ?? null,
          }
        : null,
  };
}
export type PublicGame = ReturnType<typeof publicGame>;
