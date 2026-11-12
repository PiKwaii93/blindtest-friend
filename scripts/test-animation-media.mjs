// Verify stored bytes through actual browser media decoding, seeking and image loading.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
const [manifestFile, mediaDirectory, target] = process.argv.slice(2);
assert.ok(["local", "production"].includes(target));
const env = parseEnv(
  await readFile(
    target === "local" ? ".env.local" : ".env.production.local",
    "utf8",
  ),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  target === "local" ? "127.0.0.1" : "lfxqunzxpagpuwsxlatx.supabase.co",
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const items = JSON.parse(await readFile(manifestFile, "utf8"));
const prepared = JSON.parse(
  await readFile(mediaDirectory + "/results.json", "utf8"),
);
const { data: works, error } = await db
  .from("works")
  .select("id,editorial_id,image_path,audio_clips(*)")
  .in(
    "editorial_id",
    items.map((x) => x.editorialId),
  );
assert.ok(!error);
assert.equal(works.length, items.length);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const queue = [...works],
  verified = [],
  failures = [];
async function worker() {
  const page = await browser.newPage();
  // A local document keeps signed URLs out of logs, traces and generated HTML files.
  await page.setContent("<main></main>");
  while (queue.length) {
    const work = queue.shift(),
      expected = prepared.find(
        (x) => x.editorialId === work.editorial_id && x.status === "prepared",
      );
    try {
      assert.ok(expected);
      const selected = work.audio_clips.filter((c) =>
        c.audio_path.includes(expected.sha256),
      );
      assert.equal(selected.length, 1);
      const clip = selected[0];
      assert.ok(clip.audio_path.includes(expected.sha256));
      assert.equal(
        clip.start_ms + clip.usable_duration_ms,
        expected.durationMs,
      );
      const { data, error } = await db.storage
        .from("audio")
        .createSignedUrl(clip.audio_path, 120);
      assert.ok(!error);
      const result = await page.evaluate(
        async ({ url, image, startMs, durationMs }) => {
          document.querySelector("main").replaceChildren();
          const video = document.createElement("video");
          video.controls = true;
          video.muted = true;
          video.style.width = "500px";
          video.src = url;
          const picture = new Image();
          picture.src = image;
          document.querySelector("main").append(video, picture);
          await Promise.race([
            Promise.all([
              new Promise((resolve, reject) => {
                video.onloadeddata = resolve;
                video.onerror = () => reject(Error("Video decode failed"));
              }),
              picture.decode(),
            ]),
            new Promise((_, reject) =>
              setTimeout(() => reject(Error("Media load timeout")), 20000),
            ),
          ]);
          video.currentTime = startMs / 1000;
          await video.play();
          await new Promise((resolve) => setTimeout(resolve, 1100));
          const played =
            video.currentTime > startMs / 1000 + 0.4 && video.readyState >= 2;
          video.pause();
          video.currentTime = Math.max(startMs / 1000, video.duration - 0.4);
          await new Promise((resolve) => {
            video.onseeked = resolve;
            setTimeout(resolve, 2000);
          });
          await video.play();
          await new Promise((resolve) => setTimeout(resolve, 850));
          return {
            played,
            imageLoaded: picture.naturalWidth > 0,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
            ended: video.ended,
            endTime: video.currentTime,
            expectedDurationMs: durationMs,
          };
        },
        {
          url: data.signedUrl,
          image: work.image_path,
          startMs: clip.start_ms,
          durationMs: expected.durationMs,
        },
      );
      assert.ok(result.played && result.imageLoaded && result.ended);
      // The budget uses the shorter stream; the MP4 may retain up to one AAC encoder tail.
      assert.ok(Math.abs(result.duration * 1000 - expected.durationMs) < 250);
      verified.push({
        editorialId: work.editorial_id,
        sha256: expected.sha256,
        ...result,
      });
    } catch (error) {
      failures.push({
        editorialId: work.editorial_id,
        error: String(error.message).split("\n")[0],
      });
    }
  }
  await page.close();
}
try {
  await Promise.all(Array.from({ length: 4 }, worker));
} finally {
  await browser.close();
}
verified.sort((a, b) => a.editorialId.localeCompare(b.editorialId));
await writeFile(
  mediaDirectory + "/verified-" + target + ".json",
  JSON.stringify(verified, null, 2),
);
await writeFile(
  mediaDirectory + "/failed-verification-" + target + ".json",
  JSON.stringify(failures, null, 2),
);
console.log(JSON.stringify({ target, verified: verified.length, failures }));
assert.equal(failures.length, 0);
assert.equal(verified.length, items.length);
