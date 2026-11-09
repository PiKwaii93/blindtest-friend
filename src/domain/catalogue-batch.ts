type UploadedMedia = { name: string; path: string };
type Draft = {
  editorial_id?: string;
  is_active?: boolean;
  image_path?: string | null;
  image_license?: string | null;
  clips?: { difficulty: string }[];
};

export function associateDraftMedia(
  input: Draft | Draft[],
  uploads: UploadedMedia[],
) {
  const drafts = structuredClone(input);
  const byId = new Map(
    (Array.isArray(drafts) ? drafts : [drafts]).map((work) => [
      work.editorial_id,
      work,
    ]),
  );
  const results = uploads.map(({ name, path }) => {
    const match =
      /^(da-\d{3})(?:\.(easy|normal|hard))?\.(wav|mp3|ogg|png|jpe?g|webp)$/i.exec(
        name,
      );
    if (!match) return `${name} — nom non reconnu.`;
    const [, id, level, extension] = match.map((value) => value?.toLowerCase());
    const draft = byId.get(id);
    if (!draft || draft.is_active !== false)
      return `${name} — brouillon absent de l’éditeur.`;
    if (level && ["wav", "mp3", "ogg"].includes(extension)) {
      draft.clips ??= [];
      if (draft.clips.some((clip) => clip.difficulty === level))
        return `${name} — difficulté déjà renseignée.`;
      const clip = {
        audio_path: path,
        difficulty: level,
        start_ms: 0,
        usable_duration_ms: 10000,
        rights_status: "pending",
        is_active: false,
        previewed: false,
        license_reference: null,
      };
      draft.clips.push(clip);
    } else if (!level && ["png", "jpg", "jpeg", "webp"].includes(extension)) {
      if (draft.image_path) return `${name} — illustration déjà renseignée.`;
      draft.image_path = path;
      draft.image_license = null;
    } else return `${name} — nom et format incompatibles.`;
    return `${name} — associé à ${id}.`;
  });
  return { drafts, results };
}
