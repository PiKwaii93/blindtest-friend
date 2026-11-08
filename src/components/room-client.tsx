"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RevealImage } from "./reveal-image";
import { Copy, Headphones, LogOut, Trophy, Volume2, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { browserClient, configured } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import type { Player, PublicGame } from "@/domain/game";
import { ranking, teams, rankPosition } from "@/domain/game";
import {
  difficulties,
  settingsSchema,
  launchBlockers,
  type Settings,
} from "@/domain/settings";
type Snapshot = {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  players: Player[];
  settings: Settings;
  game: PublicGame | null;
  gameId: string | null;
  version: number;
  serverNow: number;
  audio: string | null;
  startMs: number;
};
type Availability = {
  workId: string;
  categories: string[];
  difficulty: Settings["difficulties"][number];
  durationMs: number;
};
const labels = { easy: "Facile", normal: "Normal", hard: "Difficile" };
export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<Snapshot | null>(null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [answer, setAnswer] = useState("");
  const [now, setNow] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [copied, setCopied] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const offset = useRef(0);
  const minRtt = useRef(Infinity);
  const version = useRef(-1);
  const loaded = useRef("");
  const serverSettings = useRef("");
  const polling = useRef(false);
  const reduced = useReducedMotion();
  const refresh = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const before = Date.now();
      const response = await fetch("/api/rooms/" + code, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const after = Date.now();
      if (after - before <= minRtt.current) {
        minRtt.current = after - before;
        offset.current = data.serverNow - (before + after) / 2;
      }
      if (data.version >= version.current) {
        version.current = data.version;
        setState(data);
        const serialized = JSON.stringify(data.settings);
        if (serverSettings.current !== serialized) {
          serverSettings.current = serialized;
          setSettings(data.settings);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion interrompue.");
    } finally {
      polling.current = false;
    }
  }, [code]);
  const send = useCallback(
    async (action: Record<string, unknown>) => {
      const response = await fetch("/api/rooms/" + code, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
    },
    [code, refresh],
  );
  const act = useCallback(
    async (action: Record<string, unknown>) => {
      setBusy(true);
      setError("");
      try {
        await send(action);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible.");
      } finally {
        setBusy(false);
      }
    },
    [send],
  );
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const db = browserClient();
    void (async () => {
      const { data } = await db.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      if (!alive) return;
      setUserId(data.user.id);
      await send({ type: "join" });
      const response = await fetch("/api/catalogue");
      const cat = await response.json();
      if (response.ok && alive) {
        setCategories(cat.categories);
        setAvailability(cat.availability);
      }
    })().catch((e) => setError(e.message));
    const interval = setInterval(() => void refresh(), 2500);
    const clock = setInterval(() => setNow(Date.now() + offset.current), 50);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      clearInterval(interval);
      clearInterval(clock);
      window.removeEventListener("focus", focus);
    };
  }, [send, refresh, router]);
  const roomId = state?.id;
  useEffect(() => {
    if (!roomId || !configured) return;
    const db = browserClient();
    const channel = db
      .channel("room:" + roomId, { config: { private: true } })
      .on("broadcast", { event: "STATE_CHANGED" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    return () => {
      void db.removeChannel(channel);
    };
  }, [roomId, refresh]);
  const g = state?.game;
  const phase = g?.phase;
  const round = g?.round;
  const deadline = g?.deadline;
  useEffect(() => {
    if (!deadline || !phase || phase === "FINISHED") return;
    const timer = setTimeout(
      () => void act({ type: "tick" }),
      Math.max(25, deadline - Date.now() - offset.current + 30),
    );
    return () => clearTimeout(timer);
  }, [deadline, phase, act]);
  useEffect(() => {
    const a = new Audio();
    a.hidden = true;
    a.setAttribute("aria-hidden", "true");
    document.body.appendChild(a);
    audio.current = a;
    return () => {
      a.pause();
      a.src = "";
      a.remove();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  const audioUrl = state?.audio;
  const startMs = state?.startMs ?? 0;
  // Signed URLs may rotate during polling; retain the loaded audio for this round.
  useEffect(() => {
    const a = audio.current;
    if (!a || !audioUrl || round === undefined) return;
    if (loaded.current === `${state?.gameId}:${round}`) return;
    loaded.current = `${state?.gameId}:${round}`;
    a.src = audioUrl;
    a.preload = "auto";
    a.load();
  }, [audioUrl, round, state?.gameId]);
  useEffect(() => {
    const a = audio.current;
    if (!a || phase !== "PREPARING" || !enabled || g?.loaded.includes(userId))
      return;
    const ready = () => {
      if (a.readyState >= 3) void act({ type: "loaded", round });
    };
    const failed = () =>
      setError(
        "Le média ne peut pas être chargé. Vérifiez votre connexion et les droits de lecture.",
      );
    a.addEventListener("canplaythrough", ready);
    a.addEventListener("error", failed);
    ready();
    return () => {
      a.removeEventListener("canplaythrough", ready);
      a.removeEventListener("error", failed);
    };
  }, [phase, enabled, round, g?.loaded, userId, act, audioUrl]);
  const playbackStartedAt = g?.startedAt ?? 0;
  const consumedMs = g?.consumedMs ?? 0;
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (phase !== "PLAYING" || !enabled) {
      a.pause();
      return;
    }
    let stopped = false;
    const synchronize = () => {
      if (stopped) return;
      const time = Date.now() + offset.current;
      const desired =
        (startMs + consumedMs + Math.max(0, time - playbackStartedAt)) / 1000;
      if (time < playbackStartedAt) return;
      if (Math.abs(a.currentTime - desired) > 0.18) a.currentTime = desired;
      if (a.paused)
        void a
          .play()
          .catch(() =>
            setError(
              "Autorisez la lecture audio avec le bouton Activer le son.",
            ),
          );
    };
    const timer = setInterval(synchronize, 100);
    synchronize();
    return () => {
      stopped = true;
      clearInterval(timer);
      a.pause();
    };
  }, [phase, enabled, startMs, consumedMs, playbackStartedAt]);
  const canBuzz = Boolean(
    g?.phase === "PLAYING" &&
    !g.excluded.includes(userId) &&
    now >= g.startedAt &&
    !busy,
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest(
            "input,textarea,select,button,[contenteditable=true]",
          )
        )
      ) {
        e.preventDefault();
        if (canBuzz) void act({ type: "buzz", round });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canBuzz, act, round]);
  async function enableAudio() {
    try {
      const a = audio.current!;
      const context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.01);
      await context.close();
      if (a.src) {
        a.muted = true;
        await a.play();
        a.pause();
        a.muted = false;
      }
      setEnabled(true);
    } catch {
      setError(
        "Lecture audio bloquée. Autorisez le son dans votre navigateur.",
      );
    }
  }
  if (!configured)
    return (
      <main>
        <div className="notice">
          Configurez Supabase pour accéder aux salons.
        </div>
      </main>
    );
  if (!state || !settings)
    return (
      <main>
        <div className="panel narrow">
          <h2>Connexion au salon…</h2>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Link href="/login" className="link">
            Connexion
          </Link>
        </div>
      </main>
    );
  const me = state.players.find((p) => p.id === userId);
  const owner = state.ownerId === userId;
  const matches = availability.filter(
    (c) =>
      settings.difficulties.includes(c.difficulty) &&
      c.categories.some((x) => settings.categories.includes(x)) &&
      c.durationMs >= settings.listenSeconds * 1000,
  );
  const eligible = new Set(matches.map((c) => c.workId)).size;
  const unsaved = JSON.stringify(settings) !== JSON.stringify(state.settings);
  const blockers = launchBlockers(settings, eligible, unsaved, state.players);
  const attempt = g?.attempts.at(-1);
  const answering = phase === "ANSWERING" && attempt?.playerId === userId;
  const remaining = g
    ? phase === "PLAYING"
      ? Math.max(0, (g.deadline ?? now) - Math.max(now, g.startedAt))
      : phase === "ANSWERING" || phase === "COUNTDOWN"
        ? Math.max(0, (g.deadline ?? now) - now)
        : 0
    : 0;
  const scores = g
    ? g.settings.mode === "teams"
      ? teams(g.players)
      : ranking(g.players)
    : [];
  function toggle<T>(values: T[], v: T) {
    return values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  }
  return (
    <main>
      <div className="page-title row between">
        <div>
          <span className="eyebrow">
            {g ? "La partie est lancée" : "Votre salon privé"}
          </span>
          <h1>{state.name}</h1>
        </div>
        <div className="row">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(
                location.origin + "/rooms/" + code,
              );
              setCopied(true);
            }}
          >
            <Copy size={15} />
            {copied ? "Lien copié" : code}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await send({ type: "leave" });
              router.push("/");
            }}
          >
            <LogOut size={15} /> Quitter
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}
      {!enabled && (
        <div className="notice row between">
          <span>
            Activez le son sur cet appareil avant de vous déclarer prêt.
          </span>
          <Button size="sm" onClick={enableAudio}>
            <Headphones size={16} /> Activer le son
          </Button>
        </div>
      )}
      <div className="columns">
        <div>
          {!g ? (
            <div className="panel stack">
              <div className="row between">
                <h2>Composez votre partie</h2>
                <span className="pill">{eligible} œuvres disponibles</span>
              </div>
              <fieldset
                disabled={!owner || busy}
                className="stack"
                style={{ border: 0, padding: 0 }}
              >
                <div>
                  <label>Les univers</label>
                  <div className="row small">
                    <button
                      type="button"
                      className="link"
                      onClick={() => setSettings({ ...settings, categories })}
                    >
                      Tout sélectionner
                    </button>
                    <button
                      type="button"
                      className="link"
                      onClick={() =>
                        setSettings({ ...settings, categories: [] })
                      }
                    >
                      Tout désélectionner
                    </button>
                  </div>
                  <div className="settings-grid" style={{ marginTop: 12 }}>
                    {categories.map((c) => (
                      <label className="check-chip" key={c}>
                        <input
                          type="checkbox"
                          checked={settings.categories.includes(c)}
                          onChange={() =>
                            setSettings({
                              ...settings,
                              categories: toggle(settings.categories, c),
                            })
                          }
                        />
                        {c}
                        <span className="muted small">
                          {
                            new Set(
                              availability
                                .filter(
                                  (a) =>
                                    a.categories.includes(c) &&
                                    settings.difficulties.includes(
                                      a.difficulty,
                                    ) &&
                                    a.durationMs >=
                                      settings.listenSeconds * 1000,
                                )
                                .map((a) => a.workId),
                            ).size
                          }
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label>Difficultés</label>
                  <div className="row">
                    {difficulties.map((d) => (
                      <label className="check-chip" key={d}>
                        <input
                          type="checkbox"
                          checked={settings.difficulties.includes(d)}
                          onChange={() =>
                            setSettings({
                              ...settings,
                              difficulties: toggle(settings.difficulties, d),
                            })
                          }
                        />
                        {labels[d]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="settings-grid">
                  <div>
                    <label htmlFor="rounds">Manches · {settings.rounds}</label>
                    <input
                      id="rounds"
                      type="range"
                      min={1}
                      max={50}
                      value={settings.rounds}
                      onChange={(e) =>
                        setSettings({ ...settings, rounds: +e.target.value })
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="mode">Mode de jeu</label>
                    <select
                      id="mode"
                      value={settings.mode}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mode: e.target.value as Settings["mode"],
                        })
                      }
                    >
                      <option value="individual">Individuel</option>
                      <option value="teams">Équipes</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="listen">Écoute cumulée (secondes)</label>
                    <input
                      id="listen"
                      type="number"
                      min={5}
                      max={30}
                      value={settings.listenSeconds}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          listenSeconds: +e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="response">
                      Temps de réponse (secondes)
                    </label>
                    <input
                      id="response"
                      type="number"
                      min={5}
                      max={30}
                      value={settings.answerSeconds}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          answerSeconds: +e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                {owner && (
                  <Button
                    variant="outline"
                    disabled={
                      !unsaved || !settingsSchema.safeParse(settings).success
                    }
                    onClick={() => act({ type: "settings", settings })}
                  >
                    Enregistrer les règles
                  </Button>
                )}
              </fieldset>
              <p className="small muted">
                Une mauvaise réponse vous exclut de la manche.
                {settings.mode === "teams"
                  ? " Vos coéquipiers restent en jeu."
                  : ""}
              </p>
              {eligible < settings.rounds && (
                <div className="notice">
                  Il manque {settings.rounds - eligible} œuvres éligibles pour
                  cette configuration.
                  {owner && eligible > 0 && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          rounds: Math.min(50, eligible),
                        })
                      }
                    >
                      Réduire à {Math.min(50, eligible)} manches
                    </Button>
                  )}
                </div>
              )}
              {owner && (
                <Button
                  disabled={busy || blockers.length > 0}
                  onClick={() => act({ type: "start" })}
                >
                  <Zap size={17} /> Lancer la partie
                </Button>
              )}
              {blockers.length > 0 && (
                <div role="status" className="notice">
                  <strong>Avant de lancer :</strong>
                  <ul>
                    {blockers.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <motion.div
              key={g.round + g.phase}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel game-stage"
            >
              <span className="eyebrow">
                Manche {g.round + 1} / {g.settings.rounds}
              </span>
              {phase === "PREPARING" ? (
                <>
                  <Headphones size={48} />
                  <h2>À vos écouteurs.</h2>
                  <p className="muted">
                    Préchargement audio · {g.loaded.length}/{g.players.length}{" "}
                    joueurs
                  </p>
                </>
              ) : phase === "COUNTDOWN" ? (
                <>
                  <p className="muted">Prêts pour le déclic ?</p>
                  <div className="timer">{Math.ceil(remaining / 1000)}</div>
                </>
              ) : phase === "PLAYING" ? (
                <>
                  <div className="timer">
                    {(remaining / 1000).toFixed(1)}
                    <span className="small muted"> s</span>
                  </div>
                  <button
                    className="buzzer"
                    disabled={!canBuzz}
                    onClick={() => act({ type: "buzz", round })}
                  >
                    BUZZ
                  </button>
                  <p className="small muted">
                    {g.excluded.includes(userId)
                      ? "Vous êtes exclu de cette manche."
                      : "Appuyez sur Espace ou sur le buzzer"}
                  </p>
                </>
              ) : phase === "ANSWERING" ? (
                <>
                  <div className="timer">{Math.ceil(remaining / 1000)}</div>
                  <h2>
                    {answering
                      ? "Vous avez la main !"
                      : `${g.players.find((p) => p.id === attempt?.playerId)?.name} répond…`}
                  </h2>
                  {answering ? (
                    <form
                      className="stack full"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await act({ type: "answer", round, answer });
                        setAnswer("");
                      }}
                    >
                      <label htmlFor="answer">
                        Quel est le titre de l’œuvre ?
                      </label>
                      <input
                        id="answer"
                        autoFocus
                        value={answer}
                        maxLength={200}
                        onChange={(e) => setAnswer(e.target.value)}
                        autoComplete="off"
                        disabled={busy}
                      />
                      <Button disabled={busy || !answer.trim()}>
                        Valider ma réponse
                      </Button>
                      <span className="small muted">
                        Une seule proposition. À vous de jouer.
                      </span>
                    </form>
                  ) : (
                    <p className="muted">L’écoute est en pause.</p>
                  )}
                </>
              ) : phase === "REVEAL" ? (
                <>
                  <span className="pill">La réponse</span>
                  <RevealImage
                    key={`${g.round}:${g.reveal?.image}`}
                    src={g.reveal?.image}
                    title={g.reveal?.title ?? "l’œuvre"}
                  />
                  <h2 className="reveal-title">{g.reveal?.title}</h2>
                  <p className="muted">{g.reveal?.categories.join(" · ")}</p>
                  {g.winner ? (
                    <p className="success">
                      {g.players.find((p) => p.id === g.winner)?.name} · +
                      {attempt?.points} points
                    </p>
                  ) : (
                    <p className="muted">Personne n’a trouvé cette fois.</p>
                  )}
                </>
              ) : phase === "FINISHED" ? (
                <>
                  <Trophy size={50} color="#b997ff" />
                  <h2>
                    {g.preparationError
                      ? "Partie interrompue"
                      : "Bien joué, tout le monde."}
                  </h2>
                  {g.preparationError && (
                    <p className="error">{g.preparationError}</p>
                  )}
                  <div className="podium">
                    {scores.slice(0, 3).map((p, i) => (
                      <div key={p.id} style={{ minHeight: 160 - i * 20 }}>
                        <strong>#{rankPosition(scores, i)}</strong>
                        <h3>{p.name}</h3>
                        <span className="score">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/games/${state.gameId}/results`}>
                      Voir les résultats
                    </Link>
                  </Button>
                  {owner && (
                    <Button onClick={() => act({ type: "lobby" })}>
                      Retour au lobby
                    </Button>
                  )}
                </>
              ) : (
                <h2>La prochaine manche arrive…</h2>
              )}
            </motion.div>
          )}
        </div>
        <aside className="stack" style={{ alignContent: "start" }}>
          <div className="panel">
            <div className="row between">
              <h3>{g ? "Classement" : "Les joueurs"}</h3>
              <span className="pill">{state.players.length} en ligne</span>
            </div>
            {(g ? scores : state.players).map((p, i) => (
              <div className="player" key={p.id}>
                <div className="avatar">
                  {g
                    ? rankPosition(scores, i)
                    : p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="name">
                  <strong>{p.name}</strong>
                  <div className="muted small">
                    {!g
                      ? p.ready
                        ? "Prêt à jouer"
                        : "En préparation"
                      : p.correct + " bonnes réponses"}
                    {p.id === state.ownerId && !g ? " · Créateur" : ""}
                  </div>
                </div>
                {g ? (
                  <span className="score">{p.score}</span>
                ) : owner && p.id !== userId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act({ type: "kick", playerId: p.id })}
                  >
                    Exclure
                  </Button>
                ) : null}
              </div>
            ))}
            {!g && (
              <div className="stack" style={{ marginTop: 20 }}>
                {state.settings.mode === "teams" && (
                  <div>
                    <label htmlFor="team">Votre équipe</label>
                    <select
                      id="team"
                      value={me?.team ?? ""}
                      onChange={(e) =>
                        act({ type: "team", team: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        Choisir une équipe
                      </option>
                      <option>Violets</option>
                      <option>Bleus</option>
                      <option>Roses</option>
                      <option>Verts</option>
                    </select>
                  </div>
                )}
                <Button
                  disabled={!enabled || busy}
                  variant={me?.ready ? "outline" : "default"}
                  onClick={() => act({ type: "ready", ready: !me?.ready })}
                >
                  {me?.ready ? "Je ne suis plus prêt" : "Je suis prêt"}
                </Button>
              </div>
            )}
          </div>
          {g?.settings.mode === "teams" && (
            <div className="panel">
              <h3>Contributions individuelles</h3>
              {ranking(g.players).map((p) => (
                <div className="row between" key={p.id}>
                  <span>
                    {p.name} · {p.team}
                  </span>
                  <strong>{p.score}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="panel row">
            <Volume2 size={18} />
            <label htmlFor="volume" style={{ margin: 0 }}>
              Volume
            </label>
            <input
              id="volume"
              className="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
