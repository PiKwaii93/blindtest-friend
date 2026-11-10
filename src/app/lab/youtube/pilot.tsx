"use client";

import { useEffect, useRef, useState } from "react";
import { publicGame, type Action, type PublicGame } from "@/domain/game";
import {
  createPilotRound,
  stepPilot,
  youtubePilots,
  type RoundClock,
} from "@/domain/youtube-pilot";

type Player = {
  getCurrentTime(): number;
  getPlayerState(): number;
  cueVideoById(options: { videoId: string; startSeconds: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
};
type YouTubeWindow = Window & {
  YT?: { Player: new (node: HTMLElement, options: object) => Player };
  onYouTubeIframeAPIReady?: () => void;
};
let loading: Promise<NonNullable<YouTubeWindow["YT"]>> | undefined;

function loadYouTube() {
  const apiWindow = window as YouTubeWindow;
  if (apiWindow.YT?.Player) return Promise.resolve(apiWindow.YT);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    const timeout = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(new Error("L’API YouTube ne répond pas."));
    }
    script.onerror = fail;
    apiWindow.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (apiWindow.YT?.Player) resolve(apiWindow.YT);
      else fail();
    };
    document.head.append(script);
  });
  return loading;
}

function visible(player: Player) {
  const { top, bottom, left, right, width, height } = player
    .getIframe()
    .getBoundingClientRect();
  const area =
    Math.max(0, Math.min(bottom, innerHeight) - Math.max(top, 0)) *
    Math.max(0, Math.min(right, innerWidth) - Math.max(left, 0));
  return (
    !document.hidden &&
    width >= 200 &&
    height >= 200 &&
    area > (width * height) / 2
  );
}

const playerStates: Record<number, string> = {
  [-1]: "En attente",
  0: "Terminé",
  1: "Lecture",
  2: "En pause",
  3: "Mise en mémoire tampon",
  5: "Vidéo préparée",
};
const playerErrors: Record<number, string> = {
  2: "Identifiant vidéo invalide.",
  5: "Erreur du lecteur HTML5.",
  100: "Vidéo privée ou indisponible.",
  101: "Intégration interdite par l’éditeur.",
  150: "Intégration interdite par l’éditeur.",
  153: "Identification de la page refusée (Referer).",
};
type Snapshot = { game: PublicGame; now: number };
const channelName = (session: string) => `encore-youtube-pilot:${session}`;

function PlayerScreen({ session }: { session: string }) {
  const [state, setState] = useState<Snapshot>();
  useEffect(() => {
    if (!session) return;
    const channel = new BroadcastChannel(channelName(session));
    channel.onmessage = ({ data }) => setState(data);
    return () => channel.close();
  }, [session]);
  return (
    <main
      className="panel"
      style={{ margin: "2rem auto", maxWidth: 680, padding: 24 }}
    >
      <h1>Écran des joueurs</h1>
      <p>Le son provient des enceintes de la régie, dans la même pièce.</p>
      {state ? <RoundDisplay state={state} /> : <p>En attente de la régie…</p>}
    </main>
  );
}

function RoundDisplay({ state: { game, now } }: { state: Snapshot }) {
  const consumed =
    game.phase === "PLAYING"
      ? game.consumedMs + Math.max(0, now - game.startedAt)
      : game.consumedMs;
  return (
    <section>
      <p>
        Phase <strong>{game.phase}</strong> · écoute{" "}
        {(Math.min(10000, consumed) / 1000).toFixed(1)} / 10 s
      </p>
      {game.phase === "COUNTDOWN" && (
        <p>
          Départ dans{" "}
          {Math.ceil(Math.max(0, (game.deadline ?? now) - now) / 1000)} s
        </p>
      )}
      {game.phase === "ANSWERING" && (
        <p>Réponse attendue de Joueur {game.attempts.at(-1)?.playerId}</p>
      )}
      {game.reveal && !game.preparationError && <h2>{game.reveal.title}</h2>}
    </section>
  );
}

export function YouTubePilot({ screen }: { screen: string | null }) {
  return screen === null ? <ControlRoom /> : <PlayerScreen session={screen} />;
}

function ControlRoom() {
  const [selection, setSelection] = useState(0);
  const [offset, setOffset] = useState(0);
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState("Lecteur inactif");
  const [playerState, setPlayerState] = useState(-1);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<Snapshot>();
  const [session, setSession] = useState("");
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const clock = useRef<RoundClock | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const work = youtubePilots[selection];
  const videoId = work.source.videoId;

  useEffect(() => {
    if (!armed || !mount.current) return;
    const node = document.createElement("iframe");
    const params = new URLSearchParams({
      enablejsapi: "1",
      origin: location.origin,
      autoplay: "0",
      start: String(Math.floor(offset)),
    });
    node.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
    node.title = "Lecteur YouTube de la régie";
    node.referrerPolicy = "strict-origin-when-cross-origin";
    node.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    node.style.cssText = "width:100%;height:100%;border:0";
    mount.current.append(node);
    let cancelled = false;
    let instance: Player | undefined;
    loadYouTube()
      .then((api) => {
        if (cancelled) return;
        instance = new api.Player(node, {
          events: {
            onReady: ({ target }: { target: Player }) => {
              if (cancelled) return;
              player.current = target;
              target.cueVideoById({ videoId, startSeconds: offset });
              setStatus("Préparation du lecteur…");
              setReady(true);
            },
            onStateChange: ({ data }: { data: number }) => {
              if (cancelled) return;
              setPlayerState(data);
              if (data !== 1 && clock.current) clock.current.media = null;
              setStatus(playerStates[data] ?? `État ${data}`);
            },
            onError: ({ data }: { data: number }) => {
              if (!cancelled) {
                setReady(false);
                setStatus(playerErrors[data] ?? `Erreur YouTube ${data}`);
              }
            },
            onAutoplayBlocked: () => {
              if (!cancelled)
                setStatus(
                  "Lecture bloquée. Cliquez sur Lecture dans le lecteur YouTube.",
                );
            },
          },
        });
      })
      .catch((error: Error) => {
        if (!cancelled) setStatus(error.message);
      });
    return () => {
      cancelled = true;
      player.current = null;
      instance?.destroy();
      node.remove();
    };
  }, [armed, videoId, offset]);

  useEffect(() => {
    if (!session) return;
    const connection = new BroadcastChannel(channelName(session));
    channel.current = connection;
    return () => {
      connection.close();
      channel.current = null;
    };
  }, [session]);

  function openScreen() {
    const id = session || crypto.randomUUID();
    setSession(id);
    window.open(`?screen=1&session=${id}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    function pauseWhenHidden() {
      const current = player.current;
      if (current?.getPlayerState() === 1 && !visible(current)) {
        current.pauseVideo();
        if (clock.current) clock.current.media = null;
      }
    }
    const interval = window.setInterval(() => {
      pauseWhenHidden();
      advance({ type: "tick" });
    }, 100);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, []);

  function begin() {
    if (!ready || !player.current || clock.current) return;
    clock.current = {
      game: createPilotRound(work),
      now: 0,
      wall: performance.now(),
      media: null,
    };
    advance({ type: "loaded", playerId: "1" });
    advance({ type: "loaded", playerId: "2" });
  }

  function advance(action: Action) {
    const current = clock.current;
    if (!current) return;
    const instance = player.current;
    const media =
      instance?.getPlayerState() === 1 && visible(instance)
        ? instance.getCurrentTime()
        : null;
    if (
      action.type === "buzz" &&
      (media === null ||
        current.game.phase !== "PLAYING" ||
        current.now < current.game.startedAt ||
        current.game.excluded.includes(action.playerId))
    )
      return;
    if (action.type === "answer" && current.game.phase !== "ANSWERING") return;
    const next = stepPilot(current, performance.now(), media, action);
    clock.current = next;
    const wasListening =
      current.game.phase === "PLAYING" && current.now >= current.game.startedAt;
    const listening =
      next.game.phase === "PLAYING" && next.now >= next.game.startedAt;
    if (wasListening && !listening) instance?.pauseVideo();
    if (!wasListening && listening && instance) {
      if (visible(instance)) instance.playVideo();
      else setStatus("Gardez le lecteur visible et cliquez sur Lecture.");
    }
    const snapshot = { game: publicGame(next.game), now: next.now };
    setState(snapshot);
    channel.current?.postMessage(snapshot);
  }

  function reset() {
    clock.current = null;
    player.current?.pauseVideo();
    setState(undefined);
    channel.current?.postMessage(undefined);
    setArmed(false);
    setReady(false);
    setPlayerState(-1);
    setStatus("Lecteur inactif");
  }

  const answering =
    state?.game.phase === "ANSWERING" ? state.game.attempts.at(-1) : null;
  return (
    <main
      className="panel"
      style={{ margin: "2rem auto", maxWidth: 760, padding: 24 }}
    >
      <h1>Laboratoire YouTube · Régie</h1>
      <p>
        Essai en présentiel. Placez la régie hors du champ de vision des joueurs
        et utilisez les enceintes de cet appareil.
      </p>
      <p>
        <label>
          Pilote{" "}
          <select
            value={selection}
            disabled={armed}
            onChange={(event) => {
              const index = Number(event.target.value);
              setSelection(index);
              setOffset(youtubePilots[index].source.startSeconds);
            }}
          >
            {youtubePilots.map((item, index) => (
              <option key={item.id} value={index}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          Début candidat (secondes){" "}
          <input
            type="number"
            min="0"
            max="3600"
            step="0.1"
            value={offset}
            disabled={armed}
            onChange={(event) =>
              setOffset(Math.max(0, Math.min(3600, Number(event.target.value))))
            }
          />
        </label>
      </p>
      <p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noreferrer"
        >
          {work.source.reference}
        </a>
      </p>
      <p>
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Confidentialité Google
        </a>
      </p>
      <div>
        <button type="button" disabled={armed} onClick={() => setArmed(true)}>
          Préparer le lecteur YouTube
        </button>{" "}
        <button type="button" onClick={openScreen}>
          Ouvrir l’écran des joueurs
        </button>{" "}
        <button type="button" disabled={!armed} onClick={reset}>
          Réinitialiser l’essai
        </button>
      </div>
      <p role="status">{status}</p>
      {armed && (
        <div
          ref={mount}
          style={{ width: "100%", height: "clamp(200px, 45vw, 380px)" }}
        />
      )}
      <p>
        <button type="button" disabled={!ready || !!state} onClick={begin}>
          Démarrer la manche
        </button>
      </p>
      {state && <RoundDisplay state={state} />}
      {state?.game.phase === "PLAYING" &&
        state.now >= state.game.startedAt &&
        playerState === 1 &&
        state.game.players
          .filter((item) => !state.game.excluded.includes(item.id))
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => advance({ type: "buzz", playerId: item.id })}
            >
              Buzz {item.name}
            </button>
          ))}
      {answering && (
        <form
          key={answering.acceptedAt}
          onSubmit={(event) => {
            event.preventDefault();
            advance({
              type: "answer",
              playerId: answering.playerId,
              answer: String(new FormData(event.currentTarget).get("answer")),
            });
          }}
        >
          <label>
            Réponse <input name="answer" required maxLength={150} />
          </label>
          <button type="submit">Valider</button>
        </form>
      )}
    </main>
  );
}
