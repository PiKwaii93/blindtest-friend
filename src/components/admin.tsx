"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
type Category = { id: string; name: string; slug: string; is_active: boolean };
type Work = {
  id: string;
  title: string;
  rights_source: string;
  image_path: string | null;
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
  }[];
};
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
  const [preview, setPreview] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setWorks(data.works);
    setCategories(data.categories);
  }, []);
  useEffect(() => {
    // Fetching external catalogue data; setState occurs after the HTTP response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                  const path = work.clips?.[0]?.audio_path;
                  if (!path)
                    throw new Error(
                      "Ajoutez un extrait avant de le prévisualiser.",
                    );
                  const response = await fetch(
                    "/api/admin/preview?path=" + encodeURIComponent(path),
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setPreview(data.url);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Prévisualisation impossible.",
                  );
                }
              }}
            >
              Écouter le premier extrait
            </Button>
            {preview && <audio controls src={preview} preload="metadata" />}
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
                for (const file of files) {
                  try {
                    const form = new FormData();
                    form.set("file", file);
                    const response = await fetch("/api/admin/upload", {
                      method: "POST",
                      body: form,
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    setUploads((previous) => [
                      ...previous,
                      { name: file.name, path: data.url ?? data.path },
                    ]);
                  } catch (e) {
                    setError(
                      `${file.name} : ${e instanceof Error ? e.message : "Upload impossible"}`,
                    );
                  }
                }
                setBusy(false);
              }}
            />
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
              {works.map((w) => (
                <button
                  className="button button-ghost full"
                  key={w.id}
                  onClick={() =>
                    setEditor(
                      JSON.stringify(
                        {
                          id: w.id,
                          title: w.title,
                          rights_source: w.rights_source,
                          image_path: w.image_path,
                          release_year: w.release_year,
                          is_active: w.is_active,
                          important_words: w.important_words,
                          aliases: w.work_aliases.map((a) => a.alias),
                          categories: w.work_categories.map(
                            (c) => c.category_id,
                          ),
                          clips: w.audio_clips.map((c) => ({
                            audio_path: c.audio_path,
                            difficulty: c.difficulty,
                            start_ms: c.start_ms,
                            usable_duration_ms: c.usable_duration_ms,
                            is_active: c.is_active,
                            rights_status: c.rights_status,
                          })),
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  {w.title}
                  {!w.is_active ? " (inactive)" : ""}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
