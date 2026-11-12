// Explicit, reviewed source IDs only. This never changes a database or downloads search results.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";

const run = promisify(execFile);
const input = process.argv[2];
assert.ok(
  input,
  "Usage: node scripts/prepare-animation-media.mjs manifest.json output-directory",
);
const output = resolve(process.argv[3] ?? ".deployment-config/animation-media");
const items = JSON.parse(await readFile(input, "utf8"));
assert.ok(items.length > 0 && items.length <= 500);
assert.equal(new Set(items.map((x) => x.editorialId)).size, items.length);
await mkdir(output, { recursive: true });
const results = [];
const queue = [...items];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function worker() {
  while (queue.length) {
    const item = queue.shift();
    assert.match(item.editorialId, /^[a-z]{2,8}-\d{3,6}$/);
    assert.match(item.videoId, /^[\w-]{11}$/);
    assert.equal(
      item.source,
      `https://www.youtube.com/watch?v=${item.videoId}`,
    );
    const dir = output + "/" + item.editorialId;
    await mkdir(dir, { recursive: true });
    const record = dir + "/result.json";
    try {
      const cached = JSON.parse(await readFile(record, "utf8"));
      if (
        cached.source === item.source &&
        cached.status === "prepared" &&
        cached.originalStartSeconds === (item.startSeconds ?? 0) &&
        (cached.maximumSeconds ?? 45) === (item.maximumSeconds ?? 45)
      ) {
        const bytes = await readFile(cached.file);
        assert.equal(hash(bytes), cached.sha256);
        results.push(cached);
        continue;
      }
    } catch {
      /* No completed, intact result to reuse. */
    }
    try {
      const downloaded = await run(
        "python",
        [
          "-m",
          "yt_dlp",
          "--ignore-config",
          "--compat-options",
          "no-certifi",
          "--js-runtimes",
          "node",
          "--socket-timeout",
          "20",
          "--retries",
          "2",
          "--no-playlist",
          "--no-progress",
          "--write-info-json",
          "--print",
          "after_move:filepath",
          "-f",
          item.mediaFormat ?? "bv*[height<=480]+ba/b[height<=480]",
          "--merge-output-format",
          "mp4",
          "--match-filter",
          "duration <= 1800 & !is_live",
          "--max-filesize",
          "100M",
          "-o",
          dir + "/source-" + item.videoId + ".%(ext)s",
          "--",
          item.source,
        ],
        { timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      );
      const original = downloaded.stdout.trim().split(/\r?\n/).at(-1);
      assert.ok(original, "Source absente ou ignorée.");
      await access(original);
      const start = item.startSeconds ?? 0;
      assert.ok(Number.isFinite(start) && start >= 0);
      const file = dir + "/excerpt.mp4";
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-y",
          "-ss",
          String(start),
          "-i",
          original,
          "-t",
          String(item.maximumSeconds ?? 45),
          "-map",
          "0:v:0",
          "-map",
          "0:a:0",
          "-vf",
          "scale=-2:trunc(min(360\\,ih)/2)*2",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-threads",
          "2",
          "-b:v",
          "310k",
          "-maxrate",
          "340k",
          "-bufsize",
          "550k",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "96k",
          "-ar",
          "44100",
          "-af",
          "loudnorm=I=-16:TP=-1.5:LRA=11",
          "-map_metadata",
          "-1",
          "-movflags",
          "+faststart",
          file,
        ],
        { windowsHide: true, timeout: 90000 },
      );
      const probe = JSON.parse(
        (
          await run(
            "ffprobe",
            ["-v", "error", "-show_streams", "-of", "json", file],
            { windowsHide: true },
          )
        ).stdout,
      );
      const video = probe.streams.find((s) => s.codec_name === "h264");
      const audio = probe.streams.find((s) => s.codec_name === "aac");
      assert.ok(video && audio, "Pistes H.264/AAC manquantes.");
      const durationMs = Math.floor(
        Math.min(Number(video.duration), Number(audio.duration)) * 1000,
      );
      assert.ok(durationMs >= 5000, "Extrait inférieur à cinq secondes.");
      const bytes = await readFile(file);
      assert.ok(bytes.length <= 2550000, "Extrait trop volumineux.");
      const image = dir + "/cover.jpg";
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-y",
          "-ss",
          String(Math.min(7, durationMs / 2000)),
          "-i",
          file,
          "-vf",
          "scale=-2:trunc(min(320\\,ih)/2)*2",
          "-frames:v",
          "1",
          "-q:v",
          "4",
          "-update",
          "1",
          image,
        ],
        { windowsHide: true, timeout: 30000 },
      );
      const result = {
        editorialId: item.editorialId,
        title: item.title,
        source: item.source,
        status: "prepared",
        file,
        image,
        sha256: hash(bytes),
        bytes: bytes.length,
        durationMs,
        originalStartSeconds: start,
        maximumSeconds: item.maximumSeconds ?? 45,
        codecs: [video.codec_name, audio.codec_name],
        fullListeningReview: "pending",
      };
      await writeFile(record, JSON.stringify(result, null, 2));
      results.push(result);
      console.log(item.editorialId + " prepared " + durationMs + "ms");
    } catch (error) {
      const result = {
        editorialId: item.editorialId,
        title: item.title,
        source: item.source,
        status: "failed",
        error: String(error.stderr ?? error.message).slice(-1200),
      };
      await writeFile(record, JSON.stringify(result, null, 2));
      results.push(result);
      console.log(
        item.editorialId + " failed: " + result.error.split(/\r?\n/).at(-1),
      );
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
results.sort((a, b) => a.editorialId.localeCompare(b.editorialId));
await writeFile(output + "/results.json", JSON.stringify(results, null, 2));
console.log(
  JSON.stringify({
    prepared: results.filter((x) => x.status === "prepared").length,
    failed: results.filter((x) => x.status === "failed").length,
  }),
);
