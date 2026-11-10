import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const items = z
  .array(
    z.object({
      editorialId: z.string().regex(/^[a-z]{2,8}-\d{3,6}$/),
      title: z.string().trim().min(2).max(180),
      query: z.string().trim().min(2).max(300).optional(),
      videoId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{11}$/)
        .optional(),
      file: z.string().min(1).optional(),
      source: z
        .string()
        .regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/)
        .optional(),
      replaces: z
        .string()
        .regex(/^sandbox-video\/[a-z]{2,8}-\d{3,6}\/[a-f0-9]{64}\.mp4$/)
        .optional(),
      startSeconds: z.number().min(0).max(3600).default(0),
      freezeOnReveal: z.boolean().default(false),
    }),
  )
  .min(1)
  .max(500)
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.editorialId)).size ===
      entries.length,
    "Identifiant éditorial en double.",
  );

function run(program, args) {
  try {
    return execFileSync(program, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(`${program}: ${error.stderr?.trim() || error.message}`);
  }
}

function youtube(args) {
  return run("python", [
    "-m",
    "yt_dlp",
    "--ignore-config",
    "--compat-options",
    "no-certifi",
    "--js-runtimes",
    "node",
    "--socket-timeout",
    "20",
    ...args,
  ]);
}

async function prepare(item, base, output) {
  await mkdir(output, { recursive: true });
  let source = item.file ? resolve(base, item.file) : null;
  let reference = item.source ?? "Fichier fourni localement";
  let candidateTitle;
  if (!source) {
    const candidate = item.videoId
      ? null
      : JSON.parse(
          youtube([
            "--flat-playlist",
            "--dump-single-json",
            "--",
            `ytsearch8:${item.query ?? item.title + " générique français"}`,
          ]),
        ).entries?.find(
          (entry) =>
            entry.duration >= 20 &&
            entry.duration <= 240 &&
            !/karaok[eé]|parodie|fan[ -]?(?:made|intro)|(?:^|\s)cover(?:\s|$)|remix|compilation|bande annonce|trailer/i.test(
              entry.title ?? "",
            ),
        );
    candidateTitle = candidate?.title;
    const videoId = item.videoId ?? candidate?.id;
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId ?? ""))
      throw new Error("Aucune vidéo candidate.");
    reference = `https://www.youtube.com/watch?v=${videoId}`;
    const download = youtube([
      "--no-playlist",
      "--no-progress",
      "--print",
      "after_move:filepath",
      "-f",
      "bv*[height<=480]+ba/b[height<=480]",
      "--merge-output-format",
      "mp4",
      "--match-filter",
      "duration <= 1800 & !is_live",
      "--max-filesize",
      "100M",
      "-o",
      join(output, `source-${videoId}.%(ext)s`),
      "--",
      reference,
    ]).trim();
    if (!download) throw new Error("Téléchargement ignoré ou fichier absent.");
    source = download;
  }
  const target = join(output, "extrait.mp4");
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(item.startSeconds),
    "-i",
    source,
    "-t",
    "45",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-vf",
    "scale=-2:trunc(min(480\\,ih)/2)*2",
    "-c:v",
    "libx264",
    "-threads",
    "2",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "23",
    "-maxrate",
    "2M",
    "-bufsize",
    "4M",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    target,
  ]);
  const probe = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      target,
    ]),
  );
  const video = probe.streams.find((stream) => stream.codec_name === "h264");
  const audio = probe.streams.find((stream) => stream.codec_name === "aac");
  const durationMs = Math.floor(
    Number(item.freezeOnReveal ? video?.duration : probe.format.duration) *
      1000,
  );
  const minimumMs = item.freezeOnReveal
    ? 5000
    : item.replaces || process.env.ENCORE_SANDBOX_FULL_REVEAL === "1"
      ? 20000
      : 15000;
  if (
    !Number.isFinite(durationMs) ||
    durationMs < minimumMs ||
    !video ||
    !audio
  )
    throw new Error(
      "Le fichier est trop court ou ne contient pas de vidéo H.264 et d’audio AAC.",
    );
  const bytes = await readFile(target);
  if (bytes.length > 20 * 1024 * 1024)
    throw new Error("MP4 supérieur à 20 Mio.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return {
    target,
    candidateTitle,
    bytes,
    durationMs,
    reference,
    candidate: !item.videoId && !item.file,
    path: `sandbox-video/${item.editorialId}/${hash}.mp4`,
  };
}

async function stage(db, item, media) {
  const previous = item.replaces;
  if (previous && !previous.startsWith(`sandbox-video/${item.editorialId}/`))
    throw new Error("Le fichier à remplacer appartient à une autre fiche.");
  const { data: work, error } = await db
    .from("works")
    .select("id,title,is_active,research,audio_clips(audio_path)")
    .eq("editorial_id", item.editorialId)
    .single();
  if (
    error ||
    work.title !== item.title ||
    work.is_active ||
    (previous && work.audio_clips.length !== 1) ||
    work.audio_clips.some(
      (clip) => clip.audio_path !== media.path && clip.audio_path !== previous,
    )
  )
    throw new Error(
      "La fiche locale doit exister, être inactive et sans média différent.",
    );
  const storage = db.storage.from("audio");
  const exists = await storage.exists(media.path);
  if (
    exists.error &&
    ![400, 404].includes(
      Number(exists.error.status ?? exists.error.originalError?.status),
    )
  )
    throw exists.error;
  if (!exists.data) {
    const ticket = await storage.createSignedUploadUrl(media.path);
    if (ticket.error) throw ticket.error;
    const upload = await storage.uploadToSignedUrl(
      media.path,
      ticket.data.token,
      media.bytes,
      { contentType: "video/mp4" },
    );
    if (upload.error) throw upload.error;
  }
  if (
    item.freezeOnReveal &&
    work.research?.sandbox_freeze_reveal?.path !== media.path
  ) {
    const { error: marked } = await db
      .from("works")
      .update({
        research: {
          ...work.research,
          sandbox_freeze_reveal: { path: media.path },
        },
      })
      .eq("id", work.id)
      .eq("is_active", false)
      .filter("research", "eq", JSON.stringify(work.research))
      .select("id")
      .single();
    if (marked) throw marked;
  }
  const usableMs = item.freezeOnReveal
    ? media.durationMs
    : media.durationMs - 5000;
  if (
    previous &&
    work.audio_clips.some((clip) => clip.audio_path === previous) &&
    previous !== media.path
  ) {
    const { error: replaced, data } = await db
      .from("audio_clips")
      .update({
        audio_path: media.path,
        ...(item.freezeOnReveal ? { start_ms: 0 } : {}),
        usable_duration_ms: usableMs,
        license_reference: media.reference,
        previewed: false,
      })
      .eq("work_id", work.id)
      .eq("audio_path", previous)
      .eq("rights_status", "pending")
      .eq("is_active", false)
      .select("id")
      .single();
    if (replaced || !data)
      throw new Error(replaced?.message ?? "Aucune fiche locale remplacée.");
  } else if (!work.audio_clips.length && !previous) {
    const { error: inserted } = await db.from("audio_clips").insert({
      work_id: work.id,
      audio_path: media.path,
      difficulty: "normal",
      start_ms: 0,
      usable_duration_ms: usableMs,
      is_active: false,
      rights_status: "pending",
      license_reference: media.reference,
      previewed: false,
    });
    if (inserted) throw inserted;
  }
}

const [manifest, option] = process.argv.slice(2);
if (!manifest || (option && option !== "--stage"))
  throw new Error(
    "Usage : node scripts/sandbox-video.mjs manifeste.json [--stage]",
  );
const input = JSON.parse(await readFile(manifest, "utf8"));
const entries = items.parse(
  Array.isArray(input?.works)
    ? input.works.map((work) => ({
        editorialId: work.editorial_id,
        title: work.title,
        query: work.theme_search,
      }))
    : input,
);
const output = resolve(".deployment-config/sandbox-video");
const reportName = process.env.ENCORE_SANDBOX_REPORT ?? "results.json";
if (!/^[a-zA-Z0-9_-]+\.json$/.test(reportName))
  throw new Error("Nom du rapport invalide.");
await mkdir(output, { recursive: true });
let db;
if (option === "--stage") {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url))
    throw new Error(
      "Le téléversement sandbox exige une instance Supabase locale.",
    );
  db = createClient(
    url,
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
const results = [];
for (const item of entries) {
  try {
    const media = await prepare(
      item,
      dirname(resolve(manifest)),
      join(output, item.editorialId),
    );
    if (db) await stage(db, item, media);
    results.push({
      id: item.editorialId,
      status: db ? "staged-local" : "prepared",
      file: media.target,
      durationMs: media.durationMs,
      source: media.reference,
      candidateTitle: media.candidateTitle,
      candidate: media.candidate,
    });
  } catch (error) {
    results.push({
      id: item.editorialId,
      status: "failed",
      error: error.message,
    });
  }
  console.log(results.at(-1));
  await writeFile(join(output, reportName), JSON.stringify(results, null, 2));
}
if (results.some((result) => result.status === "failed")) process.exitCode = 1;
