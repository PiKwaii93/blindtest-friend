"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import type { SandboxReview } from "@/domain/sandbox-review";

export function SandboxPreview({
  workId,
  path,
  initialMs,
  maximumMs,
  review,
  refresh,
  onDirtyChange,
}: {
  workId: string;
  path: string;
  initialMs: number;
  maximumMs: number;
  review?: SandboxReview | null;
  refresh: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [startMs, setStartMs] = useState(review?.startMs ?? initialMs);
  const [french, setFrench] = useState(review?.french ?? false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState<{
    start: number;
    revealed: boolean;
  } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const valid =
    Number.isInteger(startMs) && startMs >= 0 && startMs <= maximumMs;
  const dirty =
    startMs !== (review?.startMs ?? initialMs) ||
    french !== (review?.french ?? false);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  async function request(save: boolean) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        save
          ? "/api/admin/preview"
          : "/api/admin/preview?path=" + encodeURIComponent(path),
        save
          ? {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workId, path, startMs, french }),
            }
          : undefined,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aperçu indisponible.");
      if (save) {
        await refresh();
        setMessage("Contrôle vidéo enregistré.");
      } else setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-flow">
      <h3>Contrôle du générique vidéo</h3>
      <Button
        type="button"
        variant="outline"
        disabled={busy || !!simulation}
        onClick={() => void request(false)}
      >
        Charger l’aperçu vidéo
      </Button>
      {url && (
        <video
          ref={video}
          controls={!simulation}
          playsInline
          src={url}
          hidden={Boolean(simulation && !simulation.revealed)}
          style={{ width: "100%", maxHeight: 280 }}
          onLoadedMetadata={(event) => {
            if (valid) event.currentTarget.currentTime = startMs / 1000;
          }}
          onTimeUpdate={({ currentTarget }) => {
            if (!simulation) return;
            const elapsed = currentTarget.currentTime - simulation.start;
            if (elapsed >= 20) {
              currentTarget.pause();
              setSimulation(null);
            } else if (elapsed >= 10 && !simulation.revealed) {
              setSimulation({ ...simulation, revealed: true });
            }
          }}
          onEnded={() => setSimulation(null)}
        />
      )}
      <label>
        Départ du générique (ms)
        <input
          type="number"
          min={0}
          max={maximumMs}
          step={1}
          value={startMs}
          onChange={(event) =>
            setStartMs(event.currentTarget.valueAsNumber || 0)
          }
        />
      </label>
      <div className="row">
        <Button
          type="button"
          variant="outline"
          disabled={!url || !valid || !!simulation}
          onClick={() => {
            if (!video.current) return;
            video.current.currentTime = startMs / 1000;
            void video.current
              .play()
              .catch(() => setError("Cliquez sur Lecture dans le lecteur."));
          }}
        >
          Écouter depuis le départ
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!url || !!simulation}
          onClick={() => {
            if (video.current)
              setStartMs(Math.round(video.current.currentTime * 1000));
          }}
        >
          Prendre la position du lecteur
        </Button>
      </div>
      {simulation ? (
        <div className="row">
          <span role="status">
            {simulation.revealed
              ? "Simulation · révélation"
              : "Simulation · écoute, image masquée"}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              video.current?.pause();
              setSimulation(null);
            }}
          >
            Arrêter la simulation
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={!url || !valid || startMs > maximumMs - 5000}
          onClick={() => {
            const player = video.current;
            if (!player || player.readyState === 0) return;
            const start = startMs / 1000;
            player.currentTime = start;
            setSimulation({ start, revealed: false });
            void player.play().catch(() => {
              setSimulation(null);
              setError("La simulation n’a pas pu démarrer.");
            });
          }}
        >
          Simuler 10 s d’écoute + 10 s de révélation
        </Button>
      )}
      {valid && startMs > maximumMs - 5000 && (
        <p className="muted small">
          Ce fichier est trop court à ce départ pour simuler 20 s.
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={french}
          onChange={(event) => setFrench(event.target.checked)}
        />{" "}
        VF confirmée
      </label>
      <Button
        type="button"
        disabled={busy || !valid}
        onClick={() => void request(true)}
      >
        Enregistrer le contrôle vidéo
      </Button>
      {!valid && (
        <p className="error">
          Ce départ doit laisser 5 s d’écoute et 10 s de révélation.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
