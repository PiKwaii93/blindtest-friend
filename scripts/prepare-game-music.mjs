import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalize, validateAnswer } from "../src/domain/answers.ts";

const run = promisify(execFile);
const directory = resolve(".deployment-config/game-music");
const stage = process.argv.includes("--stage");
const researchOnly = process.argv.includes("--research-only");
const workers = 4;
const sources = new Map(
  (await readFile("catalogue/jeux-video-100.sources.tsv", "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [id, videoId, startSeconds] = line.split("\t");
      assert.match(videoId, /^[\w-]{11}$/);
      return [id, { videoId, startSeconds: Number(startSeconds) }];
    }),
);
await mkdir(directory, { recursive: true });
const selection = (
  await readFile("catalogue/jeux-video-100.selection.tsv", "utf8")
)
  .trim()
  .split(/\r?\n/)
  .map((line, index) => {
    const [title, theme, year, variants] = line.split("\t");
    assert.ok(title && theme && Number(year), line);
    const aliases = [
      ...new Map(
        (variants ?? "")
          .split("|")
          .filter((alias) => alias && normalize(alias) !== normalize(title))
          .map((alias) => [normalize(alias), alias]),
      ).values(),
    ];
    return {
      editorialId: `vg-${String(index + 1).padStart(3, "0")}`,
      title,
      theme,
      year: Number(year),
      aliases,
      query: `${title} ${theme} original soundtrack`,
    };
  });
assert.equal(selection.length, 100);
assert.equal(sources.size, 100);
assert.equal(
  new Set([...sources.values()].map((source) => source.videoId)).size,
  100,
);
assert.equal(new Set(selection.map((work) => normalize(work.title))).size, 100);
const owners = new Map();
for (const work of selection) {
  assert.ok(sources.has(work.editorialId), `Source manquante : ${work.title}`);
  for (const alias of [work.title, ...work.aliases]) {
    const key = normalize(alias);
    assert.ok(
      !owners.has(key) || owners.get(key) === work.title,
      `Alias partagé : ${alias}`,
    );
    owners.set(key, work.title);
    for (const difficulty of ["easy", "normal", "hard"])
      assert.ok(
        validateAnswer(alias, [work.title, ...work.aliases], difficulty),
        alias,
      );
  }
}

let db;
if (stage) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  assert.match(url, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
  db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const category = await db
    .from("categories")
    .select("id")
    .eq("slug", "jeux-video")
    .single();
  if (category.error) throw category.error;
  for (const work of selection) {
    const inserted = await db.from("works").upsert(
      {
        title: work.title,
        editorial_id: work.editorialId,
        release_year: work.year,
        is_active: false,
        rights_source:
          "Bac à sable local. Autorisations audio et image à vérifier.",
        research: {
          query: work.query,
          theme: work.theme,
          media_license_status: "unverified",
        },
      },
      { onConflict: "editorial_id", ignoreDuplicates: true },
    );
    if (inserted.error) throw inserted.error;
    const existing = await db
      .from("works")
      .select("id,title,is_active")
      .eq("editorial_id", work.editorialId)
      .single();
    if (existing.error) throw existing.error;
    assert.equal(existing.data.title, work.title);
    assert.equal(existing.data.is_active, false);
    const linked = await db.from("work_categories").upsert(
      {
        work_id: existing.data.id,
        category_id: category.data.id,
      },
      { onConflict: "work_id,category_id", ignoreDuplicates: true },
    );
    if (linked.error) throw linked.error;
    if (work.aliases.length) {
      const aliases = await db.from("work_aliases").upsert(
        work.aliases.map((alias) => ({
          work_id: existing.data.id,
          alias,
          normalized_alias: normalize(alias),
        })),
        { onConflict: "work_id,normalized_alias", ignoreDuplicates: true },
      );
      if (aliases.error) throw aliases.error;
    }
  }
  console.log("100 fiches locales préparées dans Jeux vidéo.");
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < selection.length) {
    const work = selection[cursor++];
    const folder = resolve(directory, work.editorialId);
    await mkdir(folder, { recursive: true });
    let selected;
    try {
      let candidates;
      try {
        candidates = JSON.parse(
          await readFile(resolve(folder, "search.json"), "utf8"),
        );
      } catch {
        const { stdout } = await run(
          "python",
          [
            "-m",
            "yt_dlp",
            "--ignore-config",
            "--compat-options",
            "no-certifi",
            "--flat-playlist",
            "--dump-single-json",
            "--socket-timeout",
            "20",
            "--",
            `ytsearch8:${work.query}`,
          ],
          { timeout: 90000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        );
        candidates = JSON.parse(stdout).entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          duration: entry.duration,
          channel: entry.channel,
          url: `https://www.youtube.com/watch?v=${entry.id}`,
        }));
        await writeFile(
          resolve(folder, "search.json"),
          JSON.stringify(candidates, null, 2),
        );
      }
      const source = sources.get(work.editorialId);
      selected = candidates.find(
        (candidate) => candidate.id === source.videoId,
      );
      assert.ok(
        selected,
        "La référence sélectionnée manque dans les résultats.",
      );
      assert.ok(
        selected.duration >= source.startSeconds + 20 &&
          selected.duration <= 1800,
        "Durée de source incompatible.",
      );
      const result = {
        ...work,
        selected,
        startSeconds: source?.startSeconds ?? 0,
        reviewed: false,
        licenseStatus: "unverified",
      };
      if (!researchOnly) {
        const reportName = `games-${work.editorialId}.json`;
        let previous;
        try {
          previous = JSON.parse(
            await readFile(
              resolve(".deployment-config/sandbox-video", reportName),
              "utf8",
            ),
          )[0];
        } catch {}
        const markerFile = resolve(folder, "prepared-source.json");
        let marker;
        try {
          marker = JSON.parse(await readFile(markerFile, "utf8"));
        } catch {}
        if (
          previous?.status === (stage ? "staged-local" : "prepared") &&
          previous.source === selected.url &&
          marker?.videoId === source.videoId &&
          marker?.startSeconds === result.startSeconds
        ) {
          result.media = previous;
        } else {
          const manifest = resolve(folder, "import.json");
          let replaces;
          if (stage) {
            const existing = await db
              .from("works")
              .select("audio_clips(audio_path)")
              .eq("editorial_id", work.editorialId)
              .single();
            if (existing.error) throw existing.error;
            assert.ok(existing.data.audio_clips.length <= 1);
            replaces = existing.data.audio_clips[0]?.audio_path;
          }
          await writeFile(
            manifest,
            JSON.stringify(
              [
                {
                  editorialId: work.editorialId,
                  title: work.title,
                  videoId: selected.id,
                  startSeconds: result.startSeconds,
                  replaces,
                },
              ],
              null,
              2,
            ),
          );
          try {
            await run(
              process.execPath,
              [
                "scripts/sandbox-video.mjs",
                manifest,
                ...(stage ? ["--stage"] : []),
              ],
              {
                env: {
                  ...process.env,
                  ENCORE_SANDBOX_REPORT: reportName,
                  ENCORE_SANDBOX_FULL_REVEAL: "1",
                },
                timeout: 360000,
                maxBuffer: 4 * 1024 * 1024,
                windowsHide: true,
              },
            );
          } catch (error) {
            result.processError = (error.stderr ?? error.message).slice(-1500);
          }
          result.media = JSON.parse(
            await readFile(
              resolve(".deployment-config/sandbox-video", reportName),
              "utf8",
            ),
          )[0];
          if (result.media.status === "failed")
            throw new Error(result.media.error);
          assert.equal(
            result.media.source,
            selected.url,
            "Rapport média périmé.",
          );
          assert.equal(result.media.id, work.editorialId);
          await writeFile(markerFile, JSON.stringify(source));
        }
        const { stdout: probeText } = await run(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            result.media.file,
          ],
          { windowsHide: true, timeout: 30000 },
        );
        const probe = JSON.parse(probeText);
        assert.ok(probe.streams.some((stream) => stream.codec_name === "h264"));
        assert.ok(probe.streams.some((stream) => stream.codec_name === "aac"));
        const durationMs = Math.floor(Number(probe.format.duration) * 1000);
        assert.ok(
          durationMs >= 20000,
          "Extrait trop court pour dix secondes d'écoute et de révélation.",
        );
        const { stderr: levels } = await run(
          "ffmpeg",
          [
            "-hide_banner",
            "-i",
            result.media.file,
            "-t",
            "4",
            "-vn",
            "-af",
            "silencedetect=noise=-45dB:d=0.12,volumedetect",
            "-f",
            "null",
            "-",
          ],
          { windowsHide: true, timeout: 30000 },
        );
        const meanDb = Number(levels.match(/mean_volume: ([\d.-]+) dB/)?.[1]);
        assert.ok(
          Number.isFinite(meanDb) && meanDb > -45,
          "Début silencieux ou inaudible.",
        );
        const silenceStart = levels.match(/silence_start: ([\d.]+)/);
        const silenceEnd = levels.match(/silence_end: ([\d.]+)/);
        result.quality = {
          durationMs,
          meanDb,
          leadingSilenceSeconds:
            silenceStart && Number(silenceStart[1]) < 0.02
              ? Number(silenceEnd?.[1] ?? 4)
              : 0,
          codecs: ["h264", "aac"],
        };
        if (stage) {
          const current = await db
            .from("works")
            .select("id,research,audio_clips(id,audio_path,start_ms)")
            .eq("editorial_id", work.editorialId)
            .single();
          if (current.error) throw current.error;
          const clip = current.data.audio_clips.find((clip) =>
            clip.audio_path.startsWith(`sandbox-video/${work.editorialId}/`),
          );
          assert.ok(clip);
          const autoStartMs = Math.max(
            0,
            Math.ceil((result.quality.leadingSilenceSeconds - 0.05) * 1000),
          );
          result.playbackStartMs = clip.start_ms;
          if (
            autoStartMs > 0 &&
            clip.start_ms === 0 &&
            current.data.research?.sandbox_review?.path !== clip.audio_path
          ) {
            const adjusted = await db
              .from("audio_clips")
              .update({
                start_ms: autoStartMs,
                usable_duration_ms: durationMs - 5000 - autoStartMs,
              })
              .eq("id", clip.id)
              .eq("start_ms", 0)
              .eq("rights_status", "pending")
              .eq("is_active", false)
              .select("start_ms")
              .maybeSingle();
            if (adjusted.error) throw adjusted.error;
            result.playbackStartMs = adjusted.data?.start_ms ?? clip.start_ms;
          }
          const updated = await db
            .from("works")
            .update({
              research: {
                ...current.data.research,
                music_source: {
                  url: selected.url,
                  title: selected.title,
                  channel: selected.channel,
                  source_start_seconds: result.startSeconds,
                  playback_start_ms: result.playbackStartMs,
                  license_status: "unverified",
                  editorial_review: "metadata-checked-audio-review-pending",
                },
              },
            })
            .eq("id", current.data.id)
            .eq("is_active", false);
          if (updated.error) throw updated.error;
        }
        result.status = stage ? "staged-local" : "prepared";
      } else {
        result.status = "source-candidate";
      }
      results.push(result);
      console.log(
        `${work.editorialId} ${result.status} · ${work.title} · ${selected.title}`,
      );
    } catch (error) {
      results.push({
        ...work,
        selected,
        status: "failed",
        error: error.message,
      });
      console.log(
        `${work.editorialId} failed · ${work.title} · ${error.message.slice(-250)}`,
      );
    }
    // Every worker writes a separate progress file, avoiding concurrent report writes.
    await writeFile(
      resolve(folder, "result.json"),
      JSON.stringify(
        results.find((result) => result.editorialId === work.editorialId),
        null,
        2,
      ),
    );
  }
}
await Promise.all(Array.from({ length: workers }, worker));
results.sort((a, b) => a.editorialId.localeCompare(b.editorialId));
await writeFile(
  resolve(directory, "results.json"),
  JSON.stringify(results, null, 2) + "\n",
);
const summary = [
  "# Jeux vidéo — catalogue local de 100 thèmes",
  "",
  "Un thème sélectionné par jeu. Les références ont été contrôlées à partir de leurs titres et métadonnées. La vérification auditive complète des 100 sources reste à faire.",
  "",
  "Les fichiers sont réservés au bac à sable local. Les œuvres et extraits restent inactifs, les autorisations restent en attente. Le mode ENCORE_VIDEO_SANDBOX=1 permet leur lecture uniquement avec Supabase local.",
  "",
  "| Identifiant | Jeu | Thème | Source | Départ effectif dans la source | Durée du fichier | Résultat |",
  "|---|---|---|---|---:|---:|---|",
  ...results.map((result) => {
    const cell = (value) =>
      String(value ?? "")
        .replaceAll("|", "\\|")
        .replaceAll("\n", " ");
    const source = result.selected
      ? `[Vidéo](${result.selected.url})`
      : "Introuvable";
    const start =
      result.startSeconds === undefined
        ? "—"
        : (
            (result.startSeconds * 1000 + (result.playbackStartMs ?? 0)) /
            1000
          ).toFixed(2) + " s";
    return `| ${result.editorialId} | ${cell(result.title)} | ${cell(result.theme)} | ${source} | ${start} | ${result.media ? (result.media.durationMs / 1000).toFixed(1) + " s" : "—"} | ${result.status === "staged-local" ? "Importé localement · droits en attente" : cell(result.error ?? result.status)} |`;
  }),
  "",
];
await writeFile("catalogue/jeux-video-100.bilan.md", summary.join("\n"));
console.log(
  JSON.stringify({
    total: results.length,
    prepared: results.filter((result) => result.status !== "failed").length,
    failed: results.filter((result) => result.status === "failed").length,
  }),
);
if (results.some((result) => result.status === "failed")) process.exitCode = 1;
