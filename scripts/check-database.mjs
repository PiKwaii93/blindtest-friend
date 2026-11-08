import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url ?? ""))
  throw new Error("Disposable local Supabase only.");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const client = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const email = `security-${randomUUID()}@example.test`,
  password = randomUUID();
const { data: user, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { is_admin: true },
});
if (error) throw error;
const workId = randomUUID();
const title = "Security test " + workId;
try {
  const { error: login } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(login, null);
  for (const table of [
    "rooms",
    "works",
    "work_aliases",
    "audio_clips",
    "games",
    "game_players",
    "administrators",
  ]) {
    const { error } = await client.from(table).select("*");
    assert.ok(error, `${table} must be inaccessible directly`);
  }
  const { error: rpc } = await client.rpc("read_room_clock", {
    p_code: "NONEXISTENT",
  });
  assert.ok(rpc, "private RPC must reject players");
  const { error: elevate } = await client
    .from("administrators")
    .insert({ user_id: user.user.id });
  assert.ok(elevate, "self-promotion must fail");
  const { data: cats } = await admin.from("categories").select("id").limit(1);
  const work = {
    id: workId,
    title,
    aliases: [{ alias: "Test alias", normalized_alias: "test alias" }],
    categories: [cats[0].id],
    important_words: [],
    rights_source: "Original test data CC0",
    image_path: null,
    release_year: null,
    is_active: true,
    clips: [
      {
        audio_path: "test.wav",
        difficulty: "normal",
        start_ms: 0,
        usable_duration_ms: 10000,
        is_active: true,
        rights_status: "authorized",
      },
    ],
  };
  const saved = await admin.rpc("save_works", { p_works: [work] });
  assert.equal(saved.error, null, JSON.stringify(saved.error));
  const { data: stored } = await admin
    .from("works")
    .select("title,work_aliases(alias),audio_clips(audio_path)")
    .eq("id", workId)
    .single();
  assert.equal(stored.title, title);
  assert.equal(stored.work_aliases[0].alias, "Test alias");
  assert.equal(stored.audio_clips.length, 1);
  const duplicate = await admin.rpc("save_works", {
    p_works: [
      { ...work, id: randomUUID(), title: "Rollback " + workId },
      { ...work, id: randomUUID() },
    ],
  });
  assert.ok(duplicate.error, "duplicate title must abort complete batch");
  const { data: rolledBack } = await admin
    .from("works")
    .select("id")
    .eq("title", "Rollback " + workId);
  assert.equal(rolledBack.length, 0);
  const updated = await admin.rpc("save_works", {
    p_works: [{ ...work, aliases: [], is_active: false }],
  });
  assert.equal(updated.error, null, JSON.stringify(updated.error));
  const { data: aliases } = await admin
    .from("work_aliases")
    .select("id")
    .eq("work_id", workId);
  assert.equal(aliases.length, 0);
  console.log(
    "PASS: protected tables/RPCs, self-promotion denied, transactional import, duplicate rollback, alias update.",
  );
} finally {
  await admin.from("works").delete().eq("id", workId);
  await admin.auth.admin.deleteUser(user.user.id);
}
