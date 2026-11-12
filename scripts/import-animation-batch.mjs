// Additive imports: other releases are untouched and original media files are retained.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { normalize } from "../src/domain/answers.ts";
const [manifestFile, mediaDirectory, target, action] = process.argv.slice(2);
assert.ok(["local", "production"].includes(target));
assert.ok(["stage", "activate"].includes(action));
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
const release = "animation-1995-2020-100-v1";
const items = JSON.parse(await readFile(manifestFile, "utf8"));
assert.equal(new Set(items.map((x) => x.editorialId)).size, items.length);
const results = JSON.parse(
  await readFile(mediaDirectory + "/results.json", "utf8"),
);
async function take(p) {
  const { data, error } = await p;
  if (error) throw Error(error.message);
  return data;
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const category = await take(
  db
    .from("categories")
    .select("id")
    .eq("slug", "dessins-animes")
    .eq("is_active", true)
    .single(),
);
const before = await take(
  db
    .from("works")
    .select("id,editorial_id,title,is_active,research")
    .order("created_at"),
);
await writeFile(
  mediaDirectory + "/before-" + target + ".json",
  JSON.stringify(before, null, 2),
  { flag: "wx" },
).catch((e) => {
  if (e.code !== "EEXIST") throw e;
});
let verification;
if (action === "activate")
  verification = JSON.parse(
    await readFile(mediaDirectory + "/verified-" + target + ".json", "utf8"),
  );
const imported = [];
for (const item of items) {
  assert.match(item.editorialId, /^da-\d{3}$/);
  assert.ok(
    Number(item.editorialId.slice(3)) >= 301 &&
      Number(item.editorialId.slice(3)) <= 400,
  );
  assert.ok(item.firstFrance.year >= 1995 && item.firstFrance.year <= 2020);
  assert.ok(new URL(item.firstFrance.source).protocol === "https:");
  const result = results.find(
    (r) => r.editorialId === item.editorialId && r.status === "prepared",
  );
  let work = before.find((w) => w.editorial_id === item.editorialId);
  if (work) {
    assert.equal(work.title, item.title);
    assert.equal(
      work.research?.encore_release,
      release,
      "Refusing to replace a different release",
    );
  }
  if (action === "activate") {
    if (
      !result ||
      !verification.some(
        (v) =>
          v.editorialId === item.editorialId &&
          v.sha256 === result.sha256 &&
          v.played &&
          v.imageLoaded,
      )
    )
      continue;
    assert.ok(work, "Stage before activating");
    const allClips = await take(
      db.from("audio_clips").select("*").eq("work_id", work.id),
    );
    const clips = allClips.filter((c) => c.audio_path.includes(result.sha256));
    assert.ok(
      allClips.filter((c) => !clips.includes(c)).every((c) => !c.is_active),
    );
    assert.equal(clips.length, 1);
    assert.ok(clips[0].audio_path.includes(result.sha256));
    assert.equal(clips[0].rights_status, "authorized");
    await take(
      db
        .from("audio_clips")
        .update({ is_active: true, previewed: true })
        .eq("id", clips[0].id)
        .eq("work_id", work.id),
    );
    await take(
      db
        .from("works")
        .update({ is_active: true })
        .eq("id", work.id)
        .eq("editorial_id", item.editorialId),
    );
    imported.push(item.editorialId);
    continue;
  }
  const research = {
    encore_release: release,
    animation_origin: item.origin,
    first_france_broadcast: item.firstFrance,
    verified_reference: {
      url: item.firstFrance.source,
      note: item.firstFrance.note,
    },
    documented_theme_url: item.source,
    theme_source: {
      url: item.source,
      title: item.sourceTitle,
      channel: item.sourceChannel,
      version_note: item.versionNote,
    },
    full_listening_review: "pending",
    rights_confirmation: {
      date: "2026-11-11",
      declared_by: "project-owner",
      scope: "Encore online audio and illustrations",
    },
  };
  const rights =
    "Autorisation de diffusion des médias déclarée par le responsable du projet le 11 novembre 2026.";
  if (!work) {
    const collision = before.find(
      (w) => normalize(w.title) === normalize(item.title),
    );
    assert.ok(!collision, "Title already exists: " + item.title);
    work = await take(
      db
        .from("works")
        .insert({
          editorial_id: item.editorialId,
          title: item.title,
          is_active: false,
          rights_source: rights,
          research,
        })
        .select()
        .single(),
    );
  }
  await take(
    db
      .from("work_categories")
      .upsert(
        { work_id: work.id, category_id: category.id },
        { onConflict: "work_id,category_id", ignoreDuplicates: true },
      ),
  );
  const aliases = [
    ...new Map(item.aliases.map((alias) => [normalize(alias), alias])).values(),
  ].map((alias) => ({
    work_id: work.id,
    alias,
    normalized_alias: normalize(alias),
  }));
  if (aliases.length)
    await take(
      db.from("work_aliases").upsert(aliases, {
        onConflict: "work_id,normalized_alias",
        ignoreDuplicates: true,
      }),
    );
  if (!result) {
    imported.push({ editorialId: item.editorialId, status: "draft-no-media" });
    continue;
  }
  assert.equal(result.source, item.source);
  const bytes = await readFile(result.file);
  assert.equal(hash(bytes), result.sha256);
  const path =
    "sandbox-video/" + item.editorialId + "/" + result.sha256 + ".mp4";
  const image = await readFile(result.image),
    imagePath = "animation/" + item.editorialId + "/" + hash(image) + ".jpg";
  async function upload(bucket, path, bytes, contentType) {
    const found = await db.storage.from(bucket).exists(path);
    if (
      found.error &&
      ![400, 404].includes(Number(found.error.status ?? found.error.statusCode))
    )
      throw Error(found.error.message);
    if (!found.data)
      await take(
        db.storage
          .from(bucket)
          .upload(path, bytes, { contentType, upsert: false }),
      );
  }
  await upload("audio", path, bytes, "video/mp4");
  await upload("images", imagePath, image, "image/jpeg");
  const existing = await take(
    db.from("audio_clips").select("*").eq("work_id", work.id),
  );
  assert.ok(
    existing.every(
      (c) => c.audio_path === path || (!c.is_active && !work.is_active),
    ),
    "Active different media exists; explicit review required",
  );
  const startMs = item.playbackStartMs ?? 0;
  assert.ok(
    Number.isInteger(startMs) &&
      startMs >= 0 &&
      result.durationMs - startMs >= 5000,
  );
  const matching = existing.find((c) => c.audio_path === path);
  if (!matching && existing.length) {
    assert.equal(existing.length, 1);
    assert.ok(!work.is_active && !existing[0].is_active);
    research.previous_media = [
      ...(work.research?.previous_media ?? []),
      existing[0],
    ];
    await take(
      db
        .from("audio_clips")
        .update({
          audio_path: path,
          start_ms: startMs,
          usable_duration_ms: result.durationMs - startMs,
          license_reference: item.source,
          previewed: false,
        })
        .eq("id", existing[0].id)
        .eq("work_id", work.id)
        .eq("is_active", false),
    );
  } else if (!matching)
    await take(
      db.from("audio_clips").insert({
        work_id: work.id,
        audio_path: path,
        difficulty: "normal",
        start_ms: startMs,
        usable_duration_ms: result.durationMs - startMs,
        is_active: false,
        rights_status: "authorized",
        license_reference: item.source,
        previewed: false,
      }),
    );
  else {
    assert.ok(
      !work.is_active,
      "Timing changes must be reviewed before activation",
    );
    await take(
      db
        .from("audio_clips")
        .update({
          start_ms: startMs,
          usable_duration_ms: result.durationMs - startMs,
        })
        .eq("id", matching.id)
        .eq("work_id", work.id)
        .eq("audio_path", path),
    );
  }
  if (!research.previous_media && work.research?.previous_media)
    research.previous_media = work.research.previous_media;
  if (result.durationMs < 10000) research.sandbox_freeze_reveal = { path };
  await take(
    db
      .from("works")
      .update({
        image_path: db.storage.from("images").getPublicUrl(imagePath).data
          .publicUrl,
        image_license: rights,
        image_attribution:
          (item.sourceChannel ?? "Source référencée") + " — " + item.source,
        research,
      })
      .eq("id", work.id)
      .eq("editorial_id", item.editorialId),
  );
  imported.push({
    editorialId: item.editorialId,
    status: "staged",
    path,
    sha256: result.sha256,
  });
  if (imported.length % 10 === 0)
    console.log(target, action, imported.length, "/", items.length);
}
await writeFile(
  mediaDirectory + "/" + action + "-" + target + ".json",
  JSON.stringify(imported, null, 2),
);
const after = await take(
  db.from("works").select("id,editorial_id,title,is_active,research"),
);
const old = before.filter(
  (w) => !items.some((i) => i.editorialId === w.editorial_id),
);
for (const w of old) {
  const current = after.find((x) => x.id === w.id);
  assert.deepEqual(current, w, "Existing work changed");
}
console.log(
  JSON.stringify({
    target,
    action,
    imported: imported.length,
    existingWorksPreserved: old.length,
  }),
);
