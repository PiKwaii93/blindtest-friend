"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { browserClient } from "@/lib/supabase/browser";
import { associateDraftMedia } from "@/domain/catalogue-batch";
import { isSandboxVideo } from "@/domain/game";
import {
  hasConfirmedFrench,
  type SandboxReview,
} from "@/domain/sandbox-review";
import { SandboxPreview } from "./sandbox-preview";
import { clipReportLabels, type ClipReportReason } from "@/domain/clip-reports";
type Category = { id: string; name: string; slug: string; is_active: boolean };
type Work = {
  id: string;
  title: string;
  rights_source: string;
  image_path: string | null;
  editorial_id: string | null;
  image_license: string | null;
  image_attribution: string | null;
  research: {
    youtube_search?: string;
    wikimedia_image_search?: string;
    documented_theme_url?: string;
    full_listening_review?: string;
    verified_reference?: { url: string; note: string };
    sandbox_review?: SandboxReview;
  } | null;
  release_year: number | null;
  is_active: boolean;
  important_words: string[];
  work_aliases: { alias: string }[];
  work_categories: { category_id: string }[];
  audio_clips: {
    audio_path: string;
    difficulty: string;
    start_ms: number;
    usable_duration_ms: number;
    is_active: boolean;
    rights_status: string;
    license_reference?: string | null;
    previewed?: boolean;
  }[];
};
function editable(w: Work) {
  return {
    id: w.id,
    editorial_id: w.editorial_id,
    title: w.title,
    rights_source: w.rights_source,
    image_path: w.image_path,
    image_license: w.image_license,
    image_attribution: w.image_attribution,
    release_year: w.release_year,
    is_active: w.is_active,
    important_words: w.important_words,
    aliases: w.work_aliases.map((a) => a.alias),
    categories: w.work_categories.map((c) => c.category_id),
    clips: w.audio_clips.map(
      ({
        audio_path,
        difficulty,
        start_ms,
        usable_duration_ms,
        is_active,
        rights_status,
        license_reference,
        previewed,
      }) => ({
        audio_path,
        difficulty,
        start_ms,
        usable_duration_ms,
        is_active,
        rights_status,
        license_reference,
        previewed,
      }),
    ),
  };
}
import { normalize } from "@/domain/answers";
import { RevealImage } from "./reveal-image";

type Draft = Omit<ReturnType<typeof editable>, "id"> & { id?: string };
const emptyDraft: Draft = {
  title: "",
  editorial_id: null,
  aliases: [],
  categories: [],
  clips: [],
  rights_source: "",
  image_path: null,
  image_license: null,
  image_attribution: null,
  release_year: null,
  is_active: false,
  important_words: [],
};
const emptyClip: Draft["clips"][number] = {
  audio_path: "",
  difficulty: "normal",
  start_ms: 0,
  usable_duration_ms: 10000,
  is_active: false,
  rights_status: "pending",
  license_reference: null,
  previewed: false,
};
type Upload = { name: string; path: string; image: boolean };

async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Opération impossible.");
  return data;
}

async function uploadFile(file: File): Promise<Upload> {
  if (file.size >= 4 * 1024 * 1024) {
    const ticket = await api("/api/admin/upload-ticket", {
      type: file.type,
      size: file.size,
    });
    const { error } = await browserClient()
      .storage.from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: file.type,
      });
    if (error) throw error;
    return {
      name: file.name,
      path: ticket.url ?? ticket.path,
      image: Boolean(ticket.url),
    };
  }
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/admin/upload", {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return {
    name: file.name,
    path: data.url ?? data.path,
    image: Boolean(data.url),
  };
}

function MediaPicker({ onUpload }: { onUpload: (files: Upload[]) => void }) {
  const [items, setItems] = useState<
    (Upload | { name: string; error: string })[]
  >([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const busy = progress.done < progress.total;
  async function upload(files: File[]) {
    const names = new Set(
      items.flatMap((item) =>
        "path" in item ? [item.name.toLowerCase()] : [],
      ),
    );
    const completed: Upload[] = [];
    setProgress({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      try {
        if (names.has(file.name.toLowerCase()))
          throw new Error("Nom de fichier déjà envoyé.");
        const result = await uploadFile(file);
        names.add(file.name.toLowerCase());
        completed.push(result);
        setItems((previous) => [...previous, result]);
      } catch (error) {
        setItems((previous) => [
          ...previous,
          {
            name: file.name,
            error: error instanceof Error ? error.message : "Envoi impossible.",
          },
        ]);
      }
      setProgress({ done: index + 1, total: files.length });
    }
    onUpload(completed);
  }
  return (
    <div className="admin-flow">
      <label>
        Choisir des fichiers audio ou des images
        <input
          type="file"
          id="upload"
          multiple
          accept="audio/mpeg,audio/wav,audio/ogg,image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) void upload(files);
          }}
        />
      </label>
      {progress.total > 0 && (
        <div role="status">
          {progress.done} / {progress.total} fichiers traités{" "}
          <progress
            aria-label="Progression des envois"
            value={progress.done}
            max={progress.total}
          />
        </div>
      )}
      {items.length > 0 && (
        <ul className="admin-upload-results">
          {items.map((item, index) => (
            <li key={index}>
              <strong>{item.name}</strong>
              {" → "}
              {"path" in item ? (
                <code>{item.path}</code>
              ) : (
                <span className="admin-error">{item.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const defaultFilters = {
  query: "",
  category: "",
  active: "",
  kind: "",
  audio: "",
  image: "",
  vf: "",
};
function needsFrenchReview(work: Work) {
  return (
    !work.is_active &&
    work.audio_clips.some(
      (clip) =>
        clip.rights_status === "pending" &&
        isSandboxVideo(clip.audio_path) &&
        !hasConfirmedFrench(clip.audio_path, work.research?.sandbox_review),
    )
  );
}
type Filters = typeof defaultFilters;
const pageSize = 25;
function Works({
  works,
  categories,
  onOpen,
  videoSandbox,
}: {
  works: Work[];
  categories: Category[];
  onOpen: (work: Work | null, queue?: string[]) => void;
  videoSandbox: boolean;
}) {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const index = useMemo(
    () =>
      works.map((work) => ({
        work,
        search: normalize(
          [
            work.title,
            work.id,
            work.editorial_id,
            ...work.work_aliases.map((alias) => alias.alias),
          ]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [works],
  );
  const query = normalize(filters.query);
  const filtered = index
    .filter(
      ({ work, search }) =>
        search.includes(query) &&
        (!filters.category ||
          work.work_categories.some(
            (category) => category.category_id === filters.category,
          )) &&
        (!filters.active || work.is_active === (filters.active === "yes")) &&
        (!filters.kind ||
          (filters.kind === "demo"
            ? work.audio_clips.some((clip) =>
                clip.audio_path.startsWith("demo/"),
              )
            : !work.is_active)) &&
        (!filters.audio ||
          Boolean(work.audio_clips.length) === (filters.audio === "yes")) &&
        (!filters.image ||
          Boolean(work.image_path) === (filters.image === "yes")) &&
        (!filters.vf || needsFrenchReview(work)),
    )
    .map(({ work }) => work);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  function filter(key: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  const options = (
    key: keyof Filters,
    label: string,
    values: [string, string][],
  ) => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={filters[key]}
        onChange={(event) => filter(key, event.target.value)}
      >
        <option value="">Tous</option>
        {values.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="panel admin-flow" aria-label="Catalogue des œuvres">
      <div className="row between">
        <h2>Œuvres</h2>
        <Button onClick={() => onOpen(null)}>Nouvelle œuvre</Button>
      </div>
      <div className="admin-filters">
        <label className="admin-search">
          Recherche
          <input
            type="search"
            placeholder="Titre, alias ou identifiant"
            value={filters.query}
            onChange={(event) => filter("query", event.target.value)}
          />
        </label>
        {options(
          "category",
          "Catégorie",
          categories.map((category) => [category.id, category.name]),
        )}
        {options("active", "État", [
          ["yes", "Actif"],
          ["no", "Inactif"],
        ])}
        {options("kind", "Type", [
          ["demo", "Démo"],
          ["draft", "Brouillon"],
        ])}
        {options("audio", "Audio", [
          ["yes", "Avec audio"],
          ["no", "Sans audio"],
        ])}
        {options("image", "Illustration", [
          ["yes", "Avec illustration"],
          ["no", "Sans illustration"],
        ])}
        {videoSandbox &&
          options("vf", "Contrôle VF", [["pending", "VF à confirmer"]])}
      </div>
      <div className="row between">
        <p role="status">
          {filtered.length} œuvres sur {works.length}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFilters(defaultFilters);
            setPage(1);
          }}
        >
          Effacer les filtres
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p>Aucune œuvre ne correspond aux filtres.</p>
      ) : (
        <ul className="admin-work-list">
          {filtered
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((work) => (
              <li key={work.id}>
                <button
                  type="button"
                  className="admin-work-row"
                  onClick={() =>
                    onOpen(
                      work,
                      filters.vf ? filtered.map((item) => item.id) : undefined,
                    )
                  }
                >
                  <span className="admin-work-title">
                    <strong>{work.title}</strong>
                    <span className="muted small">
                      {[
                        work.editorial_id,
                        ...work.work_categories.map(
                          (item) =>
                            categories.find(
                              (category) => category.id === item.category_id,
                            )?.name,
                        ),
                      ]
                        .filter(Boolean)
                        .join(" · ") || work.id}
                    </span>
                  </span>
                  <span className="admin-badges">
                    <span
                      className={
                        work.is_active
                          ? "admin-badge admin-active"
                          : "admin-badge"
                      }
                    >
                      {work.is_active ? "Actif" : "Brouillon"}
                    </span>
                    {work.audio_clips.some((clip) =>
                      clip.audio_path.startsWith("demo/"),
                    ) && <span className="admin-badge">Démo</span>}
                    <span className="admin-badge">
                      {work.audio_clips.length
                        ? work.audio_clips.length + " audio"
                        : "Sans audio"}
                    </span>
                    <span className="admin-badge">
                      {work.image_path ? "Illustré" : "Sans image"}
                    </span>
                  </span>
                  <span className="admin-edit">Modifier →</span>
                </button>
              </li>
            ))}
        </ul>
      )}
      <nav
        aria-label="Pagination des œuvres"
        className="row between admin-pagination"
      >
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Précédente
        </Button>
        <span>
          Page {currentPage} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage === pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Suivante
        </Button>
      </nav>
    </section>
  );
}

type Preview = {
  url: string;
  index: number;
  path: string;
  start: number;
  end: number;
};
function ClipReports({ work }: { work: Work }) {
  const [reports, setReports] = useState<
    {
      game_id: string;
      round: number;
      clip_id: string;
      media_path: string;
      reason: ClipReportReason;
      created_at: string;
    }[]
  >();
  const [error, setError] = useState("");
  const workId = work.id;
  useEffect(() => {
    let active = true;
    void api("/api/admin/reports?workId=" + encodeURIComponent(workId)).then(
      ({ reports }) => {
        if (active) setReports(reports);
      },
      (e: Error) => {
        if (active) setError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, [workId]);
  return (
    <section className="admin-flow" aria-label="Signalements des extraits">
      <h3>Signalements des extraits</h3>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !reports ? (
        <p role="status">Chargement des signalements…</p>
      ) : reports.length === 0 ? (
        <p className="muted">Aucun signalement.</p>
      ) : (
        <ul className="admin-work-list">
          {reports.map((report, index) => (
            <li key={`${report.game_id}:${report.round}:${index}`}>
              <strong>{clipReportLabels[report.reason]}</strong>
              <p className="muted small">
                Manche {report.round + 1} ·{" "}
                {new Date(report.created_at).toLocaleString("fr-FR")}
                {!work.audio_clips.some(
                  (clip) => clip.audio_path === report.media_path,
                ) && " · Ancien média"}
              </p>
              <details>
                <summary>Référence de l’extrait</summary>
                <code>{report.media_path}</code>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function WorkEditor({
  work,
  videoSandbox,
  queueMode,
  onNext,
  categories,
  onClose,
  onSave,
}: {
  work: Work | null;
  videoSandbox: boolean;
  queueMode: boolean;
  onNext?: () => void;
  categories: Category[];
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    work ? editable(work) : emptyDraft,
  );
  const [original, setOriginal] = useState(() => JSON.stringify(draft));
  const [tab, setTab] = useState(queueMode ? "Audio" : "Informations");
  const [sandboxDirty, setSandboxDirty] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [played, setPlayed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty =
    sandboxDirty ||
    JSON.stringify(draft) !== original ||
    (advanced && raw !== JSON.stringify(draft, null, 2));
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function leave(next: () => void) {
    if (
      !busy &&
      (!dirty ||
        window.confirm(
          "Quitter cette fiche et perdre les modifications non enregistrées ?",
        ))
    )
      next();
  }
  function close() {
    leave(onClose);
  }
  function update(changes: Partial<Draft>) {
    setSaved(false);
    setDraft((previous) => ({ ...previous, ...changes }));
  }
  function updateClip(index: number, changes: Partial<Draft["clips"][number]>) {
    update({
      clips: draft.clips.map((clip, i) =>
        i === index ? { ...clip, ...changes } : clip,
      ),
    });
  }
  async function listen(index: number) {
    setError("");
    setPreview(null);
    setPlayed(false);
    const clip = draft.clips[index];
    try {
      const { url } = await api(
        "/api/admin/preview?path=" + encodeURIComponent(clip.audio_path),
      );
      setPreview({
        url,
        index,
        path: clip.audio_path,
        start: clip.start_ms / 1000,
        end: (clip.start_ms + clip.usable_duration_ms) / 1000,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Aperçu indisponible.");
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const value = advanced ? JSON.parse(raw) : draft;
      if (!value || Array.isArray(value) || typeof value !== "object")
        throw new Error("Saisissez une seule fiche JSON.");
      await api("/api/admin", { works: [{ ...value, id: work?.id }] });
      setDraft(value);
      setOriginal(JSON.stringify(value));
      setRaw(JSON.stringify(value, null, 2));
      await onSave();
      if (!work) onClose();
      else setSaved(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="admin-drawer"
      aria-labelledby="work-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="admin-drawer-head row between">
        <div>
          <span className="eyebrow">{work?.editorial_id ?? "Catalogue"}</span>
          <h2 id="work-editor-title">{work?.title ?? "Nouvelle œuvre"}</h2>
        </div>
        <Button variant="ghost" onClick={close} aria-label="Fermer la fiche">
          Fermer ×
        </Button>
        {queueMode && (
          <Button
            type="button"
            variant="outline"
            disabled={!onNext || busy}
            onClick={() => {
              if (onNext) leave(onNext);
            }}
          >
            Fiche suivante
          </Button>
        )}
      </div>
      <div className="admin-drawer-body admin-flow">
        <nav className="admin-tabs" aria-label="Sections de la fiche">
          {["Informations", "Audio", "Illustration", "Droits"].map((name) => (
            <Button
              key={name}
              size="sm"
              variant={!advanced && tab === name ? "default" : "outline"}
              aria-pressed={!advanced && tab === name}
              onClick={() => {
                if (
                  name !== tab &&
                  sandboxDirty &&
                  !window.confirm(
                    "Quitter l’aperçu sans enregistrer le contrôle vidéo ?",
                  )
                )
                  return;
                if (advanced && raw !== JSON.stringify(draft, null, 2)) {
                  try {
                    const value = JSON.parse(raw);
                    if (
                      !value ||
                      !Array.isArray(value.clips) ||
                      !Array.isArray(value.categories) ||
                      !Array.isArray(value.aliases) ||
                      !Array.isArray(value.important_words)
                    )
                      throw new Error();
                    setDraft(value);
                  } catch {
                    setError(
                      "Corrigez le JSON avant de revenir au formulaire.",
                    );
                    return;
                  }
                }
                setAdvanced(false);
                setTab(name);
                setError("");
              }}
            >
              {name}
            </Button>
          ))}
        </nav>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {advanced ? (
          <label>
            JSON de la fiche
            <textarea
              rows={12}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
            />
          </label>
        ) : tab === "Informations" ? (
          <div className="admin-flow">
            <label>
              Titre
              <input
                value={draft.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label>
              Alias (un par ligne)
              <textarea
                rows={3}
                value={draft.aliases.join("\n")}
                onChange={(event) =>
                  update({ aliases: event.target.value.split("\n") })
                }
              />
            </label>
            <label>
              Année de sortie
              <input
                type="number"
                value={draft.release_year ?? ""}
                onChange={(event) =>
                  update({
                    release_year: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <fieldset className="admin-check-grid">
              <legend>Catégories</legend>
              {categories.map((category) => (
                <label className="admin-check" key={category.id}>
                  <input
                    type="checkbox"
                    checked={draft.categories.includes(category.id)}
                    onChange={(event) =>
                      update({
                        categories: event.target.checked
                          ? [...draft.categories, category.id]
                          : draft.categories.filter((id) => id !== category.id),
                      })
                    }
                  />
                  {category.name}
                </label>
              ))}
            </fieldset>
            <label>
              Mots importants (un par ligne)
              <textarea
                rows={2}
                value={draft.important_words.join("\n")}
                onChange={(event) =>
                  update({ important_words: event.target.value.split("\n") })
                }
              />
            </label>
            {work?.research && (
              <details>
                <summary>Références documentaires</summary>
                {work.research.full_listening_review === "pending" && (
                  <p className="small muted">
                    Lecture technique vérifiée. L’écoute intégrale de ce
                    générique reste à confirmer.
                  </p>
                )}
                {work.research.verified_reference && (
                  <p>
                    <a
                      className="link"
                      href={work.research.verified_reference.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Notice de diffusion
                    </a>{" "}
                    — {work.research.verified_reference.note}
                  </p>
                )}
                {work.research.documented_theme_url && (
                  <p>
                    <a
                      className="link"
                      href={work.research.documented_theme_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source du générique
                    </a>
                  </p>
                )}
                {work.research.youtube_search && (
                  <p>
                    <a
                      className="link"
                      href={work.research.youtube_search}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Recherche du générique
                    </a>
                  </p>
                )}
                {work.research.wikimedia_image_search && (
                  <p>
                    <a
                      className="link"
                      href={work.research.wikimedia_image_search}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Recherche d’illustration
                    </a>
                  </p>
                )}
              </details>
            )}
          </div>
        ) : tab === "Audio" ? (
          <div className="admin-flow">
            {work &&
              (videoSandbox ||
                work.audio_clips.some((clip) =>
                  isSandboxVideo(clip.audio_path),
                )) && <ClipReports work={work} />}
            {!draft.clips.length && <p>Aucun extrait associé.</p>}
            {draft.clips.map((clip, index) =>
              videoSandbox &&
              work &&
              !work.is_active &&
              clip.rights_status === "pending" &&
              isSandboxVideo(clip.audio_path) &&
              work.audio_clips.some(
                (stored) => stored.audio_path === clip.audio_path,
              ) ? (
                <SandboxPreview
                  key={clip.audio_path}
                  workId={work.id}
                  path={clip.audio_path}
                  initialMs={clip.start_ms}
                  maximumMs={clip.start_ms + clip.usable_duration_ms - 10000}
                  review={
                    work.research?.sandbox_review?.path === clip.audio_path
                      ? work.research.sandbox_review
                      : undefined
                  }
                  refresh={onSave}
                  onDirtyChange={setSandboxDirty}
                />
              ) : (
                <fieldset className="admin-flow admin-fieldset" key={index}>
                  <legend>Extrait {index + 1}</legend>
                  <label>
                    Fichier audio
                    <input
                      value={clip.audio_path}
                      onChange={(event) =>
                        updateClip(index, {
                          audio_path: event.target.value,
                          previewed: false,
                          rights_status: "pending",
                          license_reference: null,
                          is_active: false,
                        })
                      }
                    />
                  </label>
                  <div className="admin-fields">
                    <label>
                      Difficulté
                      <select
                        value={clip.difficulty}
                        onChange={(event) =>
                          updateClip(index, { difficulty: event.target.value })
                        }
                      >
                        <option value="easy">Facile</option>
                        <option value="normal">Normal</option>
                        <option value="hard">Difficile</option>
                      </select>
                    </label>
                    <label>
                      Début (ms)
                      <input
                        type="number"
                        min={0}
                        value={clip.start_ms}
                        onChange={(event) =>
                          updateClip(index, {
                            start_ms: Number(event.target.value),
                            previewed: false,
                          })
                        }
                      />
                    </label>
                    <label>
                      Durée (ms)
                      <input
                        type="number"
                        min={5000}
                        value={clip.usable_duration_ms}
                        onChange={(event) =>
                          updateClip(index, {
                            usable_duration_ms: Number(event.target.value),
                            previewed: false,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="row">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!clip.audio_path}
                      onClick={() => void listen(index)}
                    >
                      Écouter l’extrait {index + 1}
                    </Button>
                    <span className="small muted">
                      {clip.previewed ? "Aperçu validé" : "Aperçu à valider"}
                    </span>
                  </div>
                  {preview?.index === index && (
                    <div className="admin-flow">
                      <audio
                        key={preview.url}
                        controls
                        src={preview.url}
                        onLoadedMetadata={(event) => {
                          const audio = event.currentTarget;
                          if (audio.duration + 0.05 < preview.end)
                            setError(
                              "Le fichier est plus court que l’extrait demandé.",
                            );
                          else audio.currentTime = preview.start;
                        }}
                        onTimeUpdate={(event) => {
                          const audio = event.currentTarget;
                          if (
                            audio.currentTime >= preview.end &&
                            audio.duration + 0.05 >= preview.end
                          ) {
                            audio.pause();
                            setPlayed(true);
                          }
                        }}
                        onEnded={(event) => {
                          if (
                            event.currentTarget.duration + 0.05 >=
                            preview.end
                          )
                            setPlayed(true);
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={
                          !played ||
                          clip.audio_path !== preview.path ||
                          clip.start_ms / 1000 !== preview.start ||
                          (clip.start_ms + clip.usable_duration_ms) / 1000 !==
                            preview.end
                        }
                        onClick={() => updateClip(index, { previewed: true })}
                      >
                        Valider l’aperçu
                      </Button>
                    </div>
                  )}
                </fieldset>
              ),
            )}
            <Button
              variant="outline"
              disabled={draft.clips.length >= 30}
              onClick={() => update({ clips: [...draft.clips, emptyClip] })}
            >
              Ajouter un extrait
            </Button>
            <details>
              <summary>Téléverser des extraits</summary>
              <MediaPicker
                onUpload={(files) =>
                  setDraft((previous) => ({
                    ...previous,
                    clips: [
                      ...previous.clips,
                      ...files
                        .filter((file) => !file.image)
                        .map((file) => ({
                          ...emptyClip,
                          audio_path: file.path,
                        })),
                    ].slice(0, 30),
                  }))
                }
              />
            </details>
          </div>
        ) : tab === "Illustration" ? (
          <div className="admin-flow">
            <label>
              URL de l’illustration
              <input
                type="url"
                value={draft.image_path ?? ""}
                onChange={(event) =>
                  update({
                    image_path: event.target.value || null,
                    image_license: null,
                    image_attribution: null,
                  })
                }
              />
            </label>
            {draft.image_path && (
              <RevealImage
                key={draft.image_path}
                src={draft.image_path}
                title={draft.title}
              />
            )}
            <details>
              <summary>Téléverser une illustration</summary>
              <MediaPicker
                onUpload={(files) => {
                  const image = files.find((file) => file.image);
                  if (image)
                    update({
                      image_path: image.path,
                      image_license: null,
                      image_attribution: null,
                    });
                }}
              />
            </details>
          </div>
        ) : (
          <div className="admin-flow">
            <label>
              Provenance et droits de l’œuvre
              <textarea
                rows={3}
                value={draft.rights_source}
                onChange={(event) =>
                  update({ rights_source: event.target.value })
                }
              />
            </label>
            <label>
              Licence de l’illustration
              <input
                value={draft.image_license ?? ""}
                onChange={(event) =>
                  update({ image_license: event.target.value })
                }
              />
            </label>
            <label>
              Crédit de l’illustration
              <input
                value={draft.image_attribution ?? ""}
                onChange={(event) =>
                  update({ image_attribution: event.target.value })
                }
              />
            </label>
            {draft.clips.map((clip, index) => (
              <fieldset className="admin-flow admin-fieldset" key={index}>
                <legend>
                  Extrait {index + 1} · {clip.difficulty}
                </legend>
                <label>
                  Justificatif audio
                  <input
                    value={clip.license_reference ?? ""}
                    onChange={(event) =>
                      updateClip(index, {
                        license_reference: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Autorisation
                  <select
                    value={clip.rights_status}
                    onChange={(event) =>
                      updateClip(index, { rights_status: event.target.value })
                    }
                  >
                    <option value="pending">À vérifier</option>
                    <option value="authorized">Autorisé</option>
                    <option value="denied">Refusé</option>
                  </select>
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={clip.is_active}
                    onChange={(event) =>
                      updateClip(index, { is_active: event.target.checked })
                    }
                  />
                  Extrait actif
                </label>
              </fieldset>
            ))}
            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) =>
                  update({ is_active: event.target.checked })
                }
              />
              Œuvre active
            </label>
          </div>
        )}
        {!advanced && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRaw(JSON.stringify(draft, null, 2));
              setAdvanced(true);
            }}
          >
            Mode avancé · JSON
          </Button>
        )}
      </div>
      <div className="admin-drawer-footer row between">
        <span role="status" className="small muted">
          {saved
            ? "Enregistrement terminé."
            : dirty
              ? "Modifications non enregistrées"
              : ""}
        </span>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "Enregistrement…" : "Enregistrer la fiche"}
        </Button>
      </div>
    </dialog>
  );
}

function Imports({
  works,
  categories,
  save,
}: {
  works: Work[];
  categories: Category[];
  save: (body: unknown) => Promise<boolean>;
}) {
  const [mode, setMode] = useState("JSON");
  const [editor, setEditor] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [filename, setFilename] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(body: unknown) {
    setBusy(true);
    try {
      return await save(body);
    } finally {
      setBusy(false);
    }
  }
  async function associate() {
    const candidates = works
      .filter((work) => work.editorial_id && !work.is_active)
      .map(editable);
    const { drafts, results } = associateDraftMedia(candidates, uploads);
    setResults(results);
    if (!Array.isArray(drafts)) return;
    const changed = drafts.filter(
      (draft, index) =>
        JSON.stringify(draft) !== JSON.stringify(candidates[index]),
    );
    if (!changed.length) return;
    const saved = await submit({ works: changed });
    if (saved) setUploads([]);
  }
  return (
    <section className="panel admin-flow">
      <nav className="admin-tabs" aria-label="Type d’import">
        {["JSON", "Médias"].map((name) => (
          <Button
            variant={mode === name ? "default" : "outline"}
            aria-pressed={mode === name}
            disabled={busy}
            key={name}
            onClick={() => setMode(name)}
          >
            Import {name}
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div hidden={mode !== "JSON"} className="admin-flow">
        <h2>Importer des fiches JSON</h2>
        <p className="muted">
          Sélectionnez un fichier avec une fiche ou un lot de 100 œuvres
          maximum.
        </p>
        <label>
          Charger un fichier JSON
          <input
            id="import-file"
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setError("");
              if (file.size > 1024 * 1024) {
                setError("Le fichier JSON dépasse 1 Mo.");
                return;
              }
              try {
                setEditor(await file.text());
                setFilename(file.name);
              } catch {
                setError("Fichier illisible.");
              }
            }}
          />
        </label>
        {filename && <p>{filename}</p>}
        <Button
          variant="outline"
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? "Masquer le JSON" : "Afficher ou coller le JSON"}
        </Button>
        {advanced && (
          <label>
            Données JSON
            <textarea
              rows={8}
              value={editor}
              onChange={(event) => setEditor(event.target.value)}
            />
          </label>
        )}
        <Button
          disabled={busy || !editor.trim()}
          onClick={() => {
            try {
              const parsed = JSON.parse(editor);
              setError("");
              void submit({ works: Array.isArray(parsed) ? parsed : [parsed] });
            } catch {
              setError("Le fichier ne contient pas de JSON valide.");
            }
          }}
        >
          Valider et enregistrer
        </Button>
        <details>
          <summary>Identifiants des catégories</summary>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>
                {category.name} · <code>{category.id}</code>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div hidden={mode !== "Médias"} className="admin-flow">
        <h2>Importer des médias</h2>
        <p className="muted">
          Nommez les fichiers comme <code>da-001.easy.wav</code> ou{" "}
          <code>da-001.webp</code> pour les associer aux brouillons existants.
        </p>
        <MediaPicker
          onUpload={(files) =>
            setUploads((previous) => [...previous, ...files])
          }
        />
        <Button
          disabled={busy || uploads.length === 0}
          onClick={() => void associate()}
        >
          Associer les fichiers par leur nom
        </Button>
        {results.length > 0 && (
          <ul
            className="admin-upload-results"
            aria-label="Bilan des associations"
          >
            {results.map((result, index) => (
              <li key={index}>{result}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function Admin({
  section = "works",
  videoSandbox = false,
}: {
  section?: "works" | "categories" | "import";
  videoSandbox?: boolean;
}) {
  const [catalogue, setCatalogue] = useState<{
    works: Work[];
    categories: Category[];
  } | null>(null);
  const [selected, setSelected] = useState<Work | null | undefined>(undefined);
  const [queue, setQueue] = useState<string[]>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    setCatalogue(await api("/api/admin"));
  }, []);
  useEffect(() => {
    let active = true;
    void api("/api/admin").then(
      (data) => {
        if (active) setCatalogue(data);
      },
      (error) => {
        if (active) setError(error.message);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  async function save(body: unknown) {
    setError("");
    setMessage("");
    try {
      await api("/api/admin", body);
      await refresh();
      setMessage("Enregistrement terminé.");
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
      return false;
    }
  }
  const nextReview =
    selected && queue && catalogue
      ? queue
          .slice(queue.indexOf(selected.id) + 1)
          .map((id) => catalogue.works.find((work) => work.id === id))
          .find((work) => work && needsFrenchReview(work))
      : undefined;
  return (
    <main className="admin-shell admin-flow">
      <header>
        <span className="eyebrow">Administration</span>
        <h1>Les coulisses du jeu</h1>
        <nav className="admin-tabs" aria-label="Administration">
          {(
            [
              ["works", "Œuvres"],
              ["categories", "Catégories"],
              ["import", "Importer"],
            ] as const
          ).map(([path, label]) => (
            <Link
              key={path}
              href={"/admin/" + path}
              aria-current={section === path ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {!catalogue && !error && <p role="status">Chargement du catalogue…</p>}
      {catalogue && section === "works" && (
        <Works
          {...catalogue}
          videoSandbox={videoSandbox}
          onOpen={(work, ids) => {
            setQueue(ids);
            setSelected(work);
          }}
        />
      )}
      {catalogue && section === "import" && (
        <Imports {...catalogue} save={save} />
      )}
      {catalogue && section === "categories" && (
        <section className="panel admin-flow">
          <h2>Catégories</h2>
          <ul className="admin-work-list">
            {catalogue.categories.map((category) => (
              <li className="row between" key={category.id}>
                <span>
                  {category.name} · <code>{category.id}</code>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void save({
                      type: "category",
                      category: { ...category, is_active: !category.is_active },
                    })
                  }
                >
                  {category.is_active ? "Désactiver" : "Activer"}
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="admin-flow"
            action={async (form) => {
              await save({
                type: "category",
                category: {
                  name: form.get("name"),
                  slug: form.get("slug"),
                  is_active: true,
                },
              });
            }}
          >
            <label>
              Nouvelle catégorie
              <input name="name" required />
            </label>
            <label>
              Identifiant lisible
              <input name="slug" pattern="[a-z0-9-]+" required />
            </label>
            <Button>Ajouter</Button>
          </form>
        </section>
      )}
      {catalogue && selected !== undefined && (
        <WorkEditor
          key={selected?.id ?? "new"}
          work={
            selected
              ? (catalogue.works.find((item) => item.id === selected.id) ??
                selected)
              : selected
          }
          videoSandbox={videoSandbox}
          queueMode={Boolean(queue)}
          onNext={nextReview ? () => setSelected(nextReview) : undefined}
          categories={catalogue.categories}
          onClose={() => setSelected(undefined)}
          onSave={refresh}
        />
      )}
    </main>
  );
}
