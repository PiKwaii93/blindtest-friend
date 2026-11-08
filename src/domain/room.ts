import type { Game, Player } from "./game";
import type { Settings } from "./settings";
export type Room = {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  settings: Settings;
  players: Player[];
  game: Game | null;
  gameId: string | null;
  banned: string[];
};
