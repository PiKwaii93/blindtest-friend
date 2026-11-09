"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { browserClient } from "@/lib/supabase/browser";
import { associateDraftMedia } from "@/domain/catalogue-batch";
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
    verified_reference?: { url: string; note: string };
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
const example = {
  title: "Mon œuvre",
  aliases: [],
  categories: ["UUID_DE_CATEGORIE"],
  important_words: [],
  rights_source: "Source et licence autorisant cette utilisation",
  image_path: null,
  release_year: null,
  is_active: true,
  clips: [
    {
      audio_path: "IDENTIFIANT.wav",
      difficulty: "normal",
      start_ms: 0,
      usable_duration_ms: 30000,
      is_active: true,
      rights_status: "authorized",
    },
  ],
};
export function Admin({
  section = "works",
}: {
  section?: "works" | "categories" | "import";
}) {
  const [works, setWorks] = useState<Work[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(JSON.stringify(example, null, 2));
  const [uploads, setUploads] = useState<{ name: string; path: string }[]>([]);
  const [preview, setPreview] = useState<{
    url: string;
    path: string;
    index: number;
    start: number;
    end: number;
  } | null>(null);
  const [previewComplete, setPreviewComplete] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selected, setSelected] = useState<Work | null>(null);
  const [filter, setFilter] = useState("");
  const [batchResults, setBatchResults] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  let selectedDraft: ReturnType<typeof editable> | null = null;
  try {
    const value = JSON.parse(editor);
    if (value?.editorial_id && Array.isArray(value.clips))
      selectedDraft = value;
  } catch {
    /* The JSON editor remains available while a draft is incomplete. */
  }
  function updateDraft(changes: Partial<ReturnType<typeof editable>>) {
    if (selectedDraft)
      setEditor(JSON.stringify({ ...selectedDraft, ...changes }, null, 2));
  }
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setWorks(data.works);
    setCategories(data.categories);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  async function save(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
      setMessage("Enregistrement terminé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <div className="page-title">
        <span className="eyebrow">Administration</span>
        <h1>Les coulisses du jeu.</h1>
        <div className="row">
          <Link className="link" href="/admin/works">
            Œuvres
          </Link>
          <Link className="link" href="/admin/categories">
            Catégories
          </Link>
          <Link className="link" href="/admin/import">
            Importer
          </Link>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {section === "categories" ? (
        <div className="panel stack">
          <h2>Catégories</h2>
          {categories.map((c) => (
            <div className="row between" key={c.id}>
              <span>
                {c.name} <code className="small muted">{c.id}</code>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  save({
                    type: "category",
                    category: { ...c, is_active: !c.is_active },
                  })
                }
              >
                {c.is_active ? "Désactiver" : "Activer"}
              </Button>
            </div>
          ))}
          <form
            className="stack"
            action={async (f) => {
              await save({
                type: "category",
                category: {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  is_active: true,
                },
              });
            }}
          >
            <label htmlFor="category-name">Nouvelle catégorie</label>
            <input name="name" id="category-name" placeholder="Nom" required />
            <label htmlFor="slug">Identifiant lisible</label>
            <input
              name="slug"
              id="slug"
              placeholder="exemple-categorie"
              pattern="[a-z0-9-]+"
              required
            />
            <Button disabled={busy}>Ajouter</Button>
          </form>
        </div>
      ) : (
        <div className="columns">
          <div className="panel stack">
            <h2>
              {section === "import"
                ? "Import JSON transactionnel"
                : "Ajouter ou modifier une œuvre"}
            </h2>
            <p className="muted small">
              Renseignez les droits, les catégories et les extraits. Pour
              modifier une œuvre, sélectionnez-la dans la liste. L’import
              accepte un objet ou un tableau de 100 œuvres maximum.
            </p>
            <label htmlFor="json">Données de l’œuvre</label>
            {selectedDraft && (
              <fieldset className="stack">
                <legend>
                  Médias de {selectedDraft.title} · {selectedDraft.editorial_id}
                </legend>
                <label>
                  Illustration (URL du bucket images)
                  <input
                    value={selectedDraft.image_path ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        image_path: e.target.value || null,
                        image_license: null,
                        image_attribution: null,
                      })
                    }
                  />
                </label>
                <label>
                  Source et licence de l’illustration
                  <input
                    value={selectedDraft.image_license ?? ""}
                    onChange={(e) =>
                      updateDraft({ image_license: e.target.value })
                    }
                  />
                </label>
                <label>
                  Crédit affiché à la révélation
                  <input
                    value={selectedDraft.image_attribution ?? ""}
                    onChange={(e) =>
                      updateDraft({ image_attribution: e.target.value })
                    }
                  />
                </label>
                {selectedDraft.clips.map((clip, index) => {
                  const update = (changes: Partial<typeof clip>) =>
                    updateDraft({
                      clips: selectedDraft.clips.map((current, i) =>
                        i === index ? { ...current, ...changes } : current,
                      ),
                    });
                  return (
                    <fieldset className="stack" key={index}>
                      <legend>
                        Extrait {index + 1} · {clip.difficulty}
                      </legend>
                      <label>
                        Début (ms)
                        <input
                          type="number"
                          min={0}
                          value={clip.start_ms}
                          onChange={(e) =>
                            update({
                              start_ms: Number(e.target.value),
                              previewed: false,
                            })
                          }
                        />
                      </label>
                      <label>
                        Durée jouable (ms)
                        <input
                          type="number"
                          min={10000}
                          value={clip.usable_duration_ms}
                          onChange={(e) =>
                            update({
                              usable_duration_ms: Number(e.target.value),
                              previewed: false,
                            })
                          }
                        />
                      </label>
                      <label>
                        Justificatif de l’autorisation audio
                        <input
                          value={clip.license_reference ?? ""}
                          onChange={(e) =>
                            update({ license_reference: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={clip.rights_status === "authorized"}
                          onChange={(e) =>
                            update({
                              rights_status: e.target.checked
                                ? "authorized"
                                : "pending",
                            })
                          }
                        />{" "}
                        Audio autorisé pour Encore
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={clip.is_active}
                          onChange={(e) =>
                            update({ is_active: e.target.checked })
                          }
                        />{" "}
                        Extrait actif
                      </label>
                      <Button
                        variant="outline"
                        onClick={() => setPreviewIndex(index)}
                      >
                        Sélectionner pour l’aperçu
                      </Button>
                    </fieldset>
                  );
                })}
                <label>
                  <input
                    type="checkbox"
                    checked={selectedDraft.is_active}
                    onChange={(e) =>
                      updateDraft({ is_active: e.target.checked })
                    }
                  />{" "}
                  Activer cette œuvre après validation des médias
                </label>
              </fieldset>
            )}
            <textarea
              id="json"
              rows={22}
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              spellCheck={false}
            />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const work = JSON.parse(editor);
                  const clip = work.clips?.[previewIndex];
                  const path = clip?.audio_path;
                  if (!path)
                    throw new Error(
                      "Ajoutez un extrait avant de le prévisualiser.",
                    );
                  const response = await fetch(
                    "/api/admin/preview?path=" + encodeURIComponent(path),
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  const start = Number(clip.start_ms) / 1000;
                  const end = start + Number(clip.usable_duration_ms) / 1000;
                  if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    start < 0 ||
                    end <= start
                  )
                    throw new Error("Début ou durée invalide.");
                  setPreviewComplete(false);
                  setPreview({
                    url: data.url,
                    path,
                    index: previewIndex,
                    start,
                    end,
                  });
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Prévisualisation impossible.",
                  );
                }
              }}
            >
              Écouter l’extrait sélectionné
            </Button>
            <label htmlFor="preview-index">
              Numéro de l’extrait dans le JSON
            </label>
            <input
              id="preview-index"
              type="number"
              min={1}
              max={30}
              value={previewIndex + 1}
              onChange={(e) =>
                setPreviewIndex(Math.max(0, Number(e.target.value) - 1))
              }
            />
            {preview && (
              <>
                <audio
                  key={preview.url}
                  controls
                  src={preview.url}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const audio = event.currentTarget;
                    if (audio.duration + 0.05 < preview.end) {
                      setError(
                        "Le fichier est plus court que l’extrait demandé.",
                      );
                      return;
                    }
                    audio.currentTime = preview.start;
                  }}
                  onTimeUpdate={(event) => {
                    const audio = event.currentTarget;
                    if (
                      audio.currentTime >= preview.end &&
                      audio.duration + 0.05 >= preview.end
                    ) {
                      audio.pause();
                      setPreviewComplete(true);
                    }
                  }}
                  onEnded={(event) => {
                    if (event.currentTarget.duration + 0.05 >= preview.end)
                      setPreviewComplete(true);
                  }}
                />
                <Button
                  variant="outline"
                  disabled={!previewComplete}
                  onClick={() => {
                    try {
                      const work = JSON.parse(editor);
                      const clip = work.clips?.[preview.index];
                      if (
                        !clip ||
                        clip.audio_path !== preview.path ||
                        clip.start_ms / 1000 !== preview.start ||
                        preview.start + clip.usable_duration_ms / 1000 !==
                          preview.end
                      )
                        throw new Error(
                          "L’extrait a changé. Écoutez-le à nouveau.",
                        );
                      clip.previewed = true;
                      setEditor(JSON.stringify(work, null, 2));
                      setMessage(
                        "Aperçu validé. Enregistrez la fiche pour conserver la validation.",
                      );
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Impossible de valider l’aperçu.",
                      );
                    }
                  }}
                >
                  Valider l’aperçu
                </Button>
              </>
            )}
            <div className="row">
              <Button
                disabled={busy}
                onClick={() => {
                  try {
                    const data = JSON.parse(editor);
                    void save({ works: Array.isArray(data) ? data : [data] });
                  } catch {
                    setError("JSON invalide.");
                  }
                }}
              >
                Valider et enregistrer
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditor(JSON.stringify(example, null, 2))}
              >
                Nouvelle œuvre
              </Button>
            </div>
            <label htmlFor="import-file">Charger un fichier JSON</label>
            <input
              id="import-file"
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && file.size < 1024 * 1024)
                  setEditor(await file.text());
                else setError("Fichier trop volumineux (1 Mo maximum).");
              }}
            />
            <h3>Médias autorisés</h3>
            <p className="small muted">
              Nommez les fichiers da-001.easy.wav, da-001.normal.mp3,
              da-001.hard.ogg ou da-001.webp. L’association prépare des extraits
              inactifs dont les droits restent à vérifier.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setEditor(
                  JSON.stringify(
                    works
                      .filter((w) => w.editorial_id && !w.is_active)
                      .map(editable),
                    null,
                    2,
                  ),
                );
              }}
            >
              Charger les brouillons dessins animés dans l’éditeur
            </Button>
            <label htmlFor="upload">Audio (20 Mo) ou image (5 Mo)</label>
            <input
              id="upload"
              type="file"
              multiple
              disabled={busy}
              accept="audio/mpeg,audio/wav,audio/ogg,image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                setBusy(true);
                setError("");
                setBatchResults([]);
                const names = new Set(
                  uploads.map((upload) => upload.name.toLowerCase()),
                );
                for (const [index, file] of files.entries()) {
                  setUploadProgress(
                    `${index + 1}/${files.length} — ${file.name}`,
                  );
                  try {
                    if (names.has(file.name.toLowerCase()))
                      throw new Error("Nom de fichier déjà envoyé.");
                    let path: string;
                    if (file.size >= 4 * 1024 * 1024) {
                      const response = await fetch("/api/admin/upload-ticket", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: file.type,
                          size: file.size,
                        }),
                      });
                      const ticket = await response.json();
                      if (!response.ok) throw new Error(ticket.error);
                      const { error } = await browserClient()
                        .storage.from(ticket.bucket)
                        .uploadToSignedUrl(ticket.path, ticket.token, file, {
                          contentType: file.type,
                        });
                      if (error) throw error;
                      path = ticket.url ?? ticket.path;
                    } else {
                      const form = new FormData();
                      form.set("file", file);
                      const response = await fetch("/api/admin/upload", {
                        method: "POST",
                        body: form,
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error);
                      path = data.url ?? data.path;
                    }
                    names.add(file.name.toLowerCase());
                    setUploads((previous) => [
                      ...previous,
                      { name: file.name, path },
                    ]);
                  } catch (e) {
                    setBatchResults((previous) => [
                      ...previous,
                      `${file.name} : ${e instanceof Error ? e.message : "Upload impossible"}`,
                    ]);
                  }
                }
                setBusy(false);
                setUploadProgress("");
              }}
            />
            {uploadProgress && <p role="status">{uploadProgress}</p>}
            {batchResults.length > 0 && (
              <ul aria-label="Bilan par fichier">
                {batchResults.map((result, i) => (
                  <li key={i}>{result}</li>
                ))}
              </ul>
            )}
            {uploads.length > 0 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  try {
                    const { drafts, results } = associateDraftMedia(
                      JSON.parse(editor),
                      uploads,
                    );
                    setEditor(JSON.stringify(drafts, null, 2));
                    setBatchResults(results);
                  } catch {
                    setError(
                      "Le JSON doit contenir une fiche ou un lot de brouillons.",
                    );
                  }
                }}
              >
                Associer les fichiers par leur nom
              </Button>
            )}
            {uploads.length > 0 && (
              <div className="success">
                <p>
                  Chemins à reporter dans le JSON (audio_path / image_path) :
                </p>
                {uploads.map((u, i) => (
                  <p key={i}>
                    {u.name} →{" "}
                    <code style={{ overflowWrap: "anywhere" }}>{u.path}</code>
                  </p>
                ))}
              </div>
            )}
          </div>
          <aside className="stack">
            <div className="panel">
              <h3>Catégories disponibles</h3>
              {categories.map((c) => (
                <p key={c.id} className="small">
                  {c.name}
                  <br />
                  <code style={{ overflowWrap: "anywhere" }}>{c.id}</code>
                </p>
              ))}
            </div>
            <div className="panel">
              <h3>{works.length} œuvres</h3>
              <label htmlFor="work-filter">
                Rechercher une œuvre ou un identifiant
              </label>
              <input
                id="work-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {selected?.research && (
                <div className="notice">
                  <strong>Références pour {selected.title}</strong>
                  <p>
                    Vérifiez la version française et l’autorisation de chaque
                    fichier.
                  </p>
                  {selected.research.verified_reference && (
                    <p>
                      <a
                        className="link"
                        href={selected.research.verified_reference.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Notice officielle
                      </a>{" "}
                      — {selected.research.verified_reference.note}
                    </p>
                  )}
                  {selected.research.documented_theme_url && (
                    <p>
                      <a
                        className="link"
                        href={selected.research.documented_theme_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Exposition Sacem
                      </a>
                    </p>
                  )}
                  {selected.research.youtube_search && (
                    <p>
                      <a
                        className="link"
                        href={selected.research.youtube_search}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Piste de recherche du générique
                      </a>
                    </p>
                  )}
                  {selected.research.wikimedia_image_search && (
                    <p>
                      <a
                        className="link"
                        href={selected.research.wikimedia_image_search}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Piste de recherche d’illustration
                      </a>
                    </p>
                  )}
                </div>
              )}
              {works
                .filter((w) =>
                  `${w.title} ${w.editorial_id ?? ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((w) => (
                  <button
                    className="button button-ghost full"
                    key={w.id}
                    onClick={() => {
                      setSelected(w);
                      setPreview(null);
                      setPreviewIndex(0);
                      setEditor(JSON.stringify(editable(w), null, 2));
                    }}
                  >
                    {w.title}
                    {w.editorial_id ? ` · ${w.editorial_id}` : ""}
                    {!w.is_active ? " · Brouillon" : ""}
                  </button>
                ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
