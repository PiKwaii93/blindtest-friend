import { start, transition, type Action, type Game } from "./game";
import { defaultSettings } from "./settings";

type YouTubeWork = {
  id: string;
  title: string;
  aliases: string[];
  source: {
    kind: "youtube";
    videoId: string;
    startSeconds: number;
    reference: string;
  };
};

export const youtubePilots: YouTubeWork[] = [
  {
    id: "da-048",
    title: "Code Lyoko",
    aliases: ["Un monde sans danger"],
    source: {
      kind: "youtube",
      videoId: "QCGixQKvTpA",
      startSeconds: 0,
      reference: "CODE LYOKO OFFICIEL · EP01 · Teddy Gozilla",
    },
  },
  {
    id: "da-010",
    title: "Inspecteur Gadget",
    aliases: [],
    source: {
      kind: "youtube",
      videoId: "MUWz_Mf4CjQ",
      startSeconds: 0,
      reference: "Jacques Cardona · Bande originale de la TV · Wagram Music",
    },
  },
];

export function createPilotRound(work: YouTubeWork) {
  return start(
    { ...defaultSettings, rounds: 1, listenSeconds: 10 },
    ["Joueur 1", "Joueur 2"].map((name, index) => ({
      id: String(index + 1),
      name,
      team: null,
      ready: true,
      score: 0,
      correct: 0,
      winningMs: 0,
    })),
    [
      {
        id: work.id,
        workId: work.id,
        title: work.title,
        aliases: work.aliases,
        important: [],
        categories: ["Dessins animés"],
        image: null,
        path: "",
        difficulty: "normal",
        startMs: 0,
        durationMs: 10000,
      },
    ],
    0,
  );
}

export type RoundClock = {
  game: Game;
  now: number;
  wall: number;
  media: number | null;
};

export function stepPilot(
  clock: RoundClock,
  wall: number,
  media: number | null,
  action: Action = { type: "tick" },
): RoundClock {
  const { game } = clock;
  const elapsed = Math.max(0, wall - clock.wall);
  const waiting = game.phase === "PLAYING" && clock.now < game.startedAt;
  let advance = elapsed;
  if (game.phase === "PLAYING" && !waiting) {
    const delta =
      media !== null && clock.media !== null ? (media - clock.media) * 1000 : 0;
    // A seek or a large sampling gap does not count as continuous listening.
    advance = delta > 0 && delta <= elapsed + 150 && elapsed <= 500 ? delta : 0;
  }
  const now =
    clock.now +
    (waiting ? Math.min(elapsed, game.startedAt - clock.now) : advance);
  const next = transition(game, action, now);
  return {
    game: next,
    now,
    wall,
    media:
      game.phase === "PLAYING" && next.phase === "PLAYING" && !waiting
        ? media
        : null,
  };
}
