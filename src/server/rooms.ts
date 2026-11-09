import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { database } from "./supabase";
import { defaultSettings, settingsSchema } from "@/domain/settings";
import {
  publicGame,
  start,
  transition,
  type Action,
  type Clip,
} from "@/domain/game";
import { selectClips } from "@/domain/selection";
import type { Room } from "@/domain/room";
import { z } from "zod";

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join") }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("ready"), ready: z.boolean() }),
  z.object({ type: z.literal("settings"), settings: settingsSchema }),
  z.object({ type: z.literal("team"), team: z.string().trim().min(1).max(24) }),
  z.object({ type: z.literal("kick"), playerId: z.string().uuid() }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("lobby") }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("loaded"), round: z.number().int().min(0) }),
  z.object({ type: z.literal("buzz"), round: z.number().int().min(0) }),
  z.object({
    type: z.literal("answer"),
    round: z.number().int().min(0),
    answer: z.string().trim().min(1).max(200),
  }),
]);
export async function catalogue(): Promise<Clip[]> {
  const { data, error } = await database()
    .from("audio_clips")
    .select(
      "*,works!inner(*,work_aliases(alias),work_categories(categories(name,is_active)))",
    )
    .eq("is_active", true)
    .eq("rights_status", "authorized")
    .eq("works.is_active", true);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    workId: c.work_id,
    title: c.works.title,
    aliases: c.works.work_aliases.map((a: { alias: string }) => a.alias),
    important: c.works.important_words,
    categories: c.works.work_categories
      .filter(
        (x: { categories: { is_active: boolean } }) => x.categories.is_active,
      )
      .map((x: { categories: { name: string } }) => x.categories.name),
    image: c.works.image_path,
    imageAttribution: c.works.image_attribution,
    path: c.audio_path,
    difficulty: c.difficulty,
    startMs: c.start_ms,
    durationMs: c.usable_duration_ms,
  }));
}
export async function createRoom(userId: string, name: string) {
  const db = database();
  const { data: profile } = await db
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  if (!profile)
    throw new Error("Complétez votre profil avant de créer un salon.");
  const { data: categories } = await db
    .from("categories")
    .select("name")
    .eq("is_active", true);
  const state: Room = {
    id: randomUUID(),
    code: randomBytes(5).toString("hex").toUpperCase(),
    name,
    ownerId: userId,
    settings: {
      ...defaultSettings,
      categories: categories?.map((c) => c.name) ?? defaultSettings.categories,
    },
    players: [
      {
        id: userId,
        name: profile.username,
        team: null,
        ready: false,
        score: 0,
        correct: 0,
        winningMs: 0,
      },
    ],
    game: null,
    gameId: null,
    banned: [],
  };
  const { error } = await db
    .from("rooms")
    .insert({ id: state.id, code: state.code, owner_id: userId, state });
  if (error) throw error;
  return state.code;
}
export async function readRoom(code: string) {
  const { data, error } = await database().rpc("read_room_clock", {
    p_code: code,
  });
  if (error) throw error;
  if (!data) throw new Error("Salon introuvable.");
  return data as { state: Room; version: number; now: number };
}
export async function snapshot(code: string, userId: string) {
  const row = await readRoom(code);
  const r = row.state;
  if (
    !r.players.some((p) => p.id === userId) &&
    !r.game?.players.some((p) => p.id === userId)
  )
    throw new Error("Rejoignez ce salon pour y accéder.");
  const g = r.game;
  let audio: string | null = null;
  if (g && !["FINISHED", "LOBBY"].includes(g.phase)) {
    const clip = g.playlist[g.round];
    if (clip.path.startsWith("demo/")) audio = "/" + clip.path;
    else {
      const { data, error } = await database()
        .storage.from("audio")
        .createSignedUrl(clip.path, 120);
      if (error) throw error;
      audio = data.signedUrl;
    }
  }
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    ownerId: r.ownerId,
    settings: r.settings,
    players: r.players,
    game: g ? publicGame(g) : null,
    gameId: r.gameId,
    version: row.version,
    serverNow: row.now,
    audio,
    startMs: g?.playlist[g.round]?.startMs ?? 0,
  };
}
export async function command(
  code: string,
  userId: string,
  input: unknown,
  system = false,
) {
  const action = commandSchema.parse(input);
  const db = database();
  for (let retry = 0; retry < 8; retry++) {
    const row = await readRoom(code);
    const r = structuredClone(row.state);
    const now = row.now;
    let player = r.players.find((p) => p.id === userId);
    if (
      !system &&
      action.type !== "join" &&
      !player &&
      !r.game?.players.some((p) => p.id === userId)
    )
      throw new Error("Accès refusé.");
    const active = r.game && r.game.phase !== "FINISHED";
    if (action.type === "join") {
      if (r.banned.includes(userId))
        throw new Error("Vous avez été exclu de ce salon.");
      if (!player) {
        if (active) throw new Error("Cette partie a déjà commencé.");
        if (r.players.length >= Number(process.env.ROOM_CAPACITY ?? 32))
          throw new Error("Le salon est complet.");
        const { data: p } = await db
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .single();
        if (!p) throw new Error("Profil manquant.");
        player = {
          id: userId,
          name: p.username,
          team: null,
          ready: false,
          score: 0,
          correct: 0,
          winningMs: 0,
        };
        r.players.push(player);
      }
    } else if (action.type === "leave" || action.type === "kick") {
      const target = action.type === "leave" ? userId : action.playerId;
      if (
        action.type === "kick" &&
        (r.ownerId !== userId || active || target === userId)
      )
        throw new Error("Exclusion impossible.");
      r.players = r.players.filter((p) => p.id !== target);
      if (active && r.game) {
        r.game.departed = [...new Set([...(r.game.departed ?? []), target])];
        if (!r.game.excluded.includes(target)) r.game.excluded.push(target);
        if (!r.game.loaded.includes(target)) r.game.loaded.push(target);
        if (
          r.game.phase === "PREPARING" &&
          r.game.loaded.length === r.game.players.length
        ) {
          r.game.phase = "COUNTDOWN";
          r.game.startedAt = now;
          r.game.deadline = now + 3000;
        }
        if (!r.players.length) {
          r.game.phase = "FINISHED";
          r.game.deadline = null;
          r.game.preparationError =
            "Tous les participants ont quitté la partie.";
        }
      }
      if (action.type === "kick") r.banned.push(target);
      if (r.ownerId === target) r.ownerId = r.players[0]?.id ?? r.ownerId;
    } else if (
      action.type === "settings" ||
      action.type === "ready" ||
      action.type === "team"
    ) {
      if (active) throw new Error("La partie est en cours.");
      if (action.type === "settings") {
        if (r.ownerId !== userId)
          throw new Error("Action réservée au propriétaire.");
        const { data: activeCategories, error } = await db
          .from("categories")
          .select("name")
          .eq("is_active", true);
        if (error) throw error;
        if (
          action.settings.categories.some(
            (c) => !activeCategories.some((a) => a.name === c),
          )
        )
          throw new Error("Catégorie inconnue ou désactivée.");
        r.settings = action.settings;
        r.players.forEach((p) => (p.ready = false));
      }
      if (action.type === "ready") player!.ready = action.ready;
      if (action.type === "team") {
        player!.team = action.team;
        player!.ready = false;
      }
    } else if (action.type === "start") {
      if (r.ownerId !== userId || active)
        throw new Error("Lancement impossible.");
      const { data: history } = await db
        .from("user_work_history")
        .select("*")
        .in(
          "user_id",
          r.players.map((p) => p.id),
        );
      const selected = selectClips(
        await catalogue(),
        r.settings,
        (history ?? []).map((h) => ({
          workId: h.work_id,
          lastPlayed: Date.parse(h.last_played_at),
          count: h.play_count,
        })),
      );
      // Availability is checked before committing the start. No silent missing-media rounds.
      for (let offset = 0; offset < selected.length; offset += 8)
        await Promise.all(
          selected.slice(offset, offset + 8).map(async ({ clip }) => {
            if (clip.path.startsWith("demo/")) {
              await stat(join(process.cwd(), "public", clip.path));
              return;
            }
            const { data, error } = await db.storage
              .from("audio")
              .createSignedUrl(clip.path, 60);
            if (error) throw new Error("Un extrait audio est indisponible.");
            const response = await fetch(data.signedUrl, {
              method: "HEAD",
              signal: AbortSignal.timeout(5000),
            });
            if (!response.ok)
              throw new Error("Un extrait audio est indisponible.");
          }),
        );
      r.game = start(
        r.settings,
        r.players,
        selected.map((s) => s.clip),
        now,
      );
      r.gameId = randomUUID();
      r.game.selectionMetadata = selected.map((s) => s.metadata);
    } else if (action.type === "lobby") {
      if (r.ownerId !== userId || r.game?.phase !== "FINISHED")
        throw new Error("Retour au lobby indisponible.");
      r.game = null;
      r.gameId = null;
      r.players.forEach((p) => (p.ready = false));
    } else if (r.game) {
      if ("round" in action && action.round !== r.game.round)
        throw new Error("La manche a changé.");
      r.game = transition(
        r.game,
        { ...action, playerId: userId } as Action,
        now,
      );
    }
    if (JSON.stringify(r) === JSON.stringify(row.state)) return;
    const { data: committed, error } = await db.rpc("commit_room", {
      p_id: r.id,
      p_version: row.version,
      p_state: r,
      p_observed_at: now,
      p_event: action.type.toUpperCase(),
    });
    if (error) throw error;
    if (committed) return;
  }
  throw new Error("Salon très sollicité, veuillez réessayer.");
}
