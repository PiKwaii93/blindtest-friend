import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const asset = z
  .object({
    file: z.string().min(1).optional(),
    downloadUrl: z.url().optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.url().pipe(z.string().max(350)),
    license: z.enum([
      "CC0-1.0",
      "CC-BY-4.0",
      "CC-BY-SA-4.0",
      "public-domain",
      "written-permission",
    ]),
    evidence: z.string().trim().min(10).max(1400),
    credit: z.string().trim().min(2).max(170),
    permissions: z.object({
      download: z.literal(true),
      adapt: z.literal(true),
      redistributeInEncore: z.literal(true),
    }),
  })
  .refine(
    (value) => Boolean(value.file) !== Boolean(value.downloadUrl),
    "Indiquez un fichier local ou une URL de téléchargement.",
  );
export const manifestSchema = z
  .object({
    works: z
      .array(
        z.object({
          workId: z.uuid(),
          editorialId: z.string().min(1).nullable(),
          title: z.string().min(1),
          edition: z.string().min(4),
          audio: asset,
          image: asset,
          segments: z
            .array(
              z.object({
                difficulty: z.enum(["easy", "normal", "hard"]),
                startMs: z.number().int().nonnegative(),
                durationMs: z.number().int().min(10000).max(30000),
              }),
            )
            .min(1)
            .max(3),
        }),
      )
      .max(100),
  })
  .superRefine(({ works }, context) => {
    const ids = new Set();
    for (const [index, work] of works.entries()) {
      if (ids.has(work.workId))
        context.addIssue({
          code: "custom",
          path: ["works", index, "workId"],
          message: "Fiche dupliquée",
        });
      ids.add(work.workId);
      if (
        new Set(work.segments.map((segment) => segment.difficulty)).size !==
        work.segments.length
      )
        context.addIssue({
          code: "custom",
          path: ["works", index, "segments"],
          message: "Difficulté dupliquée",
        });
    }
  });

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const maxSource = 100 * 1024 * 1024;
const prohibitedHosts = [
  "youtube.com",
  "youtu.be",
  "googlevideo.com",
  "spotify.com",
  "scdn.co",
  "apple.com",
  "mzstatic.com",
  "deezer.com",
  "dzcdn.net",
];

export function approvedDownloadUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    prohibitedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
  )
    throw new Error(
      "Hôte de téléchargement refusé. Fournissez le fichier autorisé par son détenteur.",
    );
  return url;
}

async function loadAsset(spec, base) {
  let bytes;
  if (spec.file) {
    const filename = resolve(base, spec.file);
    if ((await stat(filename)).size > maxSource)
      throw new Error("Fichier source supérieur à 100 Mo.");
    bytes = await readFile(filename);
  } else {
    const response = await fetch(approvedDownloadUrl(spec.downloadUrl), {
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Source indisponible (${response.status}).`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxSource)
        throw new Error("Fichier source supérieur à 100 Mo.");
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  }
  if (digest(bytes) !== spec.sha256)
    throw new Error(
      "Empreinte du fichier source différente de celle approuvée.",
    );
  return bytes;
}

function run(program, args) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `${program} : ${result.error?.message ?? result.stderr.trim().slice(-450)}`,
    );
  return result;
}
function probe(path) {
  return JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      path,
    ]).stdout,
  );
}
const proof = (spec) =>
  `${spec.license} · ${spec.source} · ${spec.evidence} · Crédit : ${spec.credit}`;

export async function prepareWork(work, base, output) {
  const directory = join(output, work.workId);
  await mkdir(directory, { recursive: true });
  const audioInput = join(directory, "source-audio");
  const imageInput = join(directory, "source-image");
  await writeFile(audioInput, await loadAsset(work.audio, base));
  await writeFile(imageInput, await loadAsset(work.image, base));
  const audioProbe = probe(audioInput);
  const imageProbe = probe(imageInput);
  if (
    !audioProbe.streams?.some((stream) => stream.codec_type === "audio") ||
    !imageProbe.streams?.some((stream) => stream.codec_type === "video")
  )
    throw new Error("Flux audio ou image introuvable.");
  const sourceDuration = Number(audioProbe.format?.duration);
  if (
    !Number.isFinite(sourceDuration) ||
    work.segments.some(
      (segment) =>
        (segment.startMs + segment.durationMs) / 1000 > sourceDuration,
    )
  )
    throw new Error("Un extrait dépasse la durée de la source.");
  const clips = [];
  for (const segment of work.segments) {
    const file = join(directory, segment.difficulty + ".mp3");
    const { stderr } = run("ffmpeg", [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      String(segment.startMs / 1000),
      "-i",
      audioInput,
      "-map",
      "0:a:0",
      "-t",
      String(segment.durationMs / 1000),
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "160k",
      file,
    ]);
    const loudness = JSON.parse(
      stderr.match(/\{\s*"input_i"[^}]+}/)?.[0] ?? "{}",
    );
    const checked = probe(file);
    const duration = Number(checked.format?.duration);
    if (
      !Number.isFinite(Number(loudness.output_i)) ||
      !Number.isFinite(duration) ||
      duration < segment.durationMs / 1000 ||
      duration > segment.durationMs / 1000 + 0.15 ||
      !checked.streams.some((stream) => stream.codec_name === "mp3")
    )
      throw new Error("Extrait silencieux, tronqué ou format inattendu.");
    const bytes = await readFile(file);
    clips.push({
      ...segment,
      file,
      sha256: digest(bytes),
      measuredMs: Math.round(duration * 1000),
      lufs: Number(loudness.output_i),
      truePeakDb: Number(loudness.output_tp),
      licenseReference: proof(work.audio),
    });
  }
  const imageFile = join(directory, "illustration.webp");
  run("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-loglevel",
    "error",
    "-y",
    "-i",
    imageInput,
    "-map",
    "0:v:0",
    "-frames:v",
    "1",
    "-vf",
    "scale=960:960:force_original_aspect_ratio=decrease",
    "-c:v",
    "libwebp",
    "-quality",
    "85",
    imageFile,
  ]);
  const imageBytes = await readFile(imageFile);
  const picture = probe(imageFile).streams[0];
  if (
    picture.codec_name !== "webp" ||
    imageBytes.length > 5 * 1024 * 1024 ||
    picture.width > 960 ||
    picture.height > 960
  )
    throw new Error("Illustration incompatible avec Storage.");
  return {
    workId: work.workId,
    editorialId: work.editorialId,
    title: work.title,
    edition: work.edition,
    clips,
    image: {
      file: imageFile,
      sha256: digest(imageBytes),
      license: proof(work.image),
      credit: `${work.image.credit} · ${work.image.license} · redimensionnée`,
      source: work.image.source,
    },
  };
}

async function upload(db, bucket, path, file, type) {
  const storage = db.storage.from(bucket);
  const exists = await storage.exists(path);
  const status = Number(
    exists.error?.status ?? exists.error?.originalError?.status,
  );
  if (exists.error && ![400, 404].includes(status)) throw exists.error;
  if (!exists.data) {
    const ticket = await storage.createSignedUploadUrl(path);
    if (ticket.error) throw ticket.error;
    const result = await storage.uploadToSignedUrl(
      path,
      ticket.data.token,
      await readFile(file),
      { contentType: type },
    );
    if (result.error) throw result.error;
  }
  return path;
}

// Writes only to an empty inactive fiche, or confirms an identical earlier stage.
export function stageSql(work) {
  const { workId, editorialId, title, imageUrl, image, clips } = work;
  const payload = Buffer.from(
    JSON.stringify({
      workId,
      editorialId,
      title,
      imageUrl,
      image: { license: image?.license, credit: image?.credit },
      clips: clips?.map(
        ({ storagePath, difficulty, durationMs, licenseReference }) => ({
          storagePath,
          difficulty,
          durationMs,
          licenseReference,
        }),
      ),
    }),
    "utf8",
  ).toString("hex");
  return `do $encore$
declare p jsonb := convert_from(decode('${payload}','hex'),'UTF8')::jsonb; w public.works%rowtype; c jsonb;
begin
  select * into strict w from public.works where id=(p->>'workId')::uuid for update;
  if w.is_active or w.title<>p->>'title' or w.editorial_id is distinct from p->>'editorialId' then
    raise exception 'Fiche différente ou déjà active';
  end if;
  if exists (select 1 from public.audio_clips where work_id=w.id) or w.image_path is not null then
    if w.image_path=p->>'imageUrl' and w.image_license=p->'image'->>'license'
       and (select count(*) from public.audio_clips where work_id=w.id)=jsonb_array_length(p->'clips')
       and not exists(select 1 from jsonb_array_elements(p->'clips') x where not exists(
         select 1 from public.audio_clips a where a.work_id=w.id and a.audio_path=x->>'storagePath' and a.difficulty=x->>'difficulty' and a.license_reference=x->>'licenseReference' and a.usable_duration_ms=(x->>'durationMs')::integer)) then return;
    end if;
    raise exception 'Médias déjà renseignés, aucune modification effectuée';
  end if;
  update public.works set image_path=p->>'imageUrl', image_license=p->'image'->>'license', image_attribution=p->'image'->>'credit' where id=w.id;
  for c in select value from jsonb_array_elements(p->'clips') loop
    insert into public.audio_clips(work_id,audio_path,difficulty,start_ms,usable_duration_ms,is_active,rights_status,license_reference,previewed)
    values(w.id,c->>'storagePath',c->>'difficulty',0,(c->>'durationMs')::integer,false,'authorized',c->>'licenseReference',false);
  end loop;
end $encore$;`;
}

async function main() {
  const [manifestFile, mode] = process.argv.slice(2);
  if (!manifestFile || (mode && mode !== "--stage"))
    throw new Error(
      "Usage : node scripts/catalogue-media.mjs manifeste.json [--stage]",
    );
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(manifestFile, "utf8")),
  );
  const output = resolve(".deployment-config/catalogue-media");
  await mkdir(output, { recursive: true });
  let db;
  let ref;
  if (mode === "--stage") {
    process.loadEnvFile(".env.production.local");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    ref = /^https:\/\/([a-z]{20})\.supabase\.co$/.exec(url ?? "")?.[1];
    if (!ref || ref !== process.env.CATALOGUE_PROJECT_REF)
      throw new Error("Renseignez CATALOGUE_PROJECT_REF avec le projet cible.");
    db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const results = [];
  for (const work of manifest.works) {
    try {
      if (db) {
        const { data, error } = await db
          .from("works")
          .select("title,editorial_id,is_active,audio_clips(audio_path)")
          .eq("id", work.workId)
          .single();
        if (
          error ||
          data.title !== work.title ||
          data.editorial_id !== work.editorialId ||
          data.is_active ||
          data.audio_clips.some((clip) => clip.audio_path.startsWith("demo/"))
        )
          throw new Error(
            "Fiche cible introuvable, différente, active ou de démonstration.",
          );
      }
      const prepared = await prepareWork(
        work,
        dirname(resolve(manifestFile)),
        output,
      );
      if (db) {
        for (const clip of prepared.clips)
          clip.storagePath = await upload(
            db,
            "audio",
            `catalogue/${work.workId}/${clip.sha256}.mp3`,
            clip.file,
            "audio/mpeg",
          );
        const imagePath = await upload(
          db,
          "images",
          `catalogue/${work.workId}/${prepared.image.sha256}.webp`,
          prepared.image.file,
          "image/webp",
        );
        prepared.imageUrl = db.storage
          .from("images")
          .getPublicUrl(imagePath).data.publicUrl;
        const sqlFile = `.deployment-config/catalogue-media/${work.workId}.sql`;
        await writeFile(sqlFile, stageSql(prepared));
        const args = [
          "supabase",
          "db",
          "query",
          `--remote=${ref}`,
          "--file",
          sqlFile,
          "--yes",
        ];
        if (process.platform === "win32")
          run("cmd.exe", ["/d", "/c", "npx", ...args]);
        else run("npx", args);
      }
      results.push({
        ...prepared,
        status: db ? "staged-inactive" : "prepared",
      });
      console.log(
        `${work.title} — ${db ? "intégré en brouillon" : "préparé localement"}`,
      );
    } catch (error) {
      results.push({
        workId: work.workId,
        title: work.title,
        status: "blocked",
        reason: error.message ?? String(error),
      });
      console.log(`${work.title} — bloqué : ${error.message ?? String(error)}`);
    }
  }
  await writeFile(
    join(output, "resultats.json"),
    JSON.stringify(results, null, 2) + "\n",
  );
  if (results.some((result) => result.status === "blocked"))
    process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
