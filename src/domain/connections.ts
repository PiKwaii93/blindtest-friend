import {
  advancePreparationIfReady,
  revealIfEveryoneFound,
  type Game,
} from "./game";

export const connectionGraceMs = 10000;

export function disconnectedPlayers(
  game: Game,
  lastSeen: Record<string, number>,
  now: number,
) {
  if (game.settings.mode !== "open") return [];
  return game.players
    .filter(
      (player) =>
        !game.departed?.includes(player.id) &&
        now - (lastSeen[player.id] ?? game.startedAt) >= connectionGraceMs,
    )
    .map((player) => player.id)
    .sort();
}

export function synchronizeConnections(
  game: Game,
  lastSeen: Record<string, number>,
  now: number,
) {
  if (game.settings.mode !== "open" || game.phase === "FINISHED") return;
  game.disconnected = disconnectedPlayers(game, lastSeen, now);
  advancePreparationIfReady(game, now);
  revealIfEveryoneFound(game, now);
}
