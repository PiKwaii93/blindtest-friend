// Dry run by default. Example: node --env-file=.env.local scripts/sync-conjunction-aliases.mjs --target http://127.0.0.1:54321 --apply
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalize, validateAnswer } from "../src/domain/answers.ts";

const target = process.argv[process.argv.indexOf("--target") + 1];
assert.ok(process.argv.includes("--target"), "Specify --target explicitly");
assert.equal(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  target,
  "Environment/target mismatch",
);
const db = createClient(target, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const manifest = JSON.parse(
  fs.readFileSync(
    new URL("../catalogue/conjunction-aliases.json", import.meta.url),
    "utf8",
  ),
);
const works = [];
for (let offset = 0; ; offset += 500) {
  const { data, error } = await db
    .from("works")
    .select(
      "id,editorial_id,title,important_words,work_aliases(alias,normalized_alias)",
    )
    .order("id")
    .range(offset, offset + 499);
  if (error) throw error;
  works.push(...data);
  if (data.length < 500) break;
}
const rows = [];
const checks = [];
for (const [id, aliases] of Object.entries(manifest)) {
  const work = works.find((w) => w.editorial_id === id);
  assert.ok(work, `Missing work ${id}`);
  const keys = new Set(work.work_aliases.map((a) => a.normalized_alias));
  for (const alias of aliases) {
    const normalized = normalize(alias);
    for (const difficulty of ["easy", "normal", "hard"])
      assert.ok(
        validateAnswer(
          alias,
          [work.title, ...work.work_aliases.map((a) => a.alias)],
          difficulty,
          work.important_words,
        ),
        `${id}: ${alias}`,
      );
    const collisions = works.filter(
      (w) =>
        w.id !== work.id &&
        [w.title, ...w.work_aliases.map((a) => a.alias)].some(
          (name) => normalize(name) === normalized,
        ),
    );
    assert.equal(collisions.length, 0, `Ambiguous alias ${id}: ${alias}`);
    checks.push({ work_id: work.id, normalized_alias: normalized });
    if (!keys.has(normalized)) {
      rows.push({ work_id: work.id, alias, normalized_alias: normalized });
      keys.add(normalized);
    }
  }
}
console.log(
  JSON.stringify({
    checkedWorks: Object.keys(manifest).length,
    checkedVariants: checks.length,
    newAliases: rows.length,
    apply: process.argv.includes("--apply"),
  }),
);
if (process.argv.includes("--apply")) {
  if (rows.length) {
    const { error } = await db
      .from("work_aliases")
      .upsert(rows, {
        onConflict: "work_id,normalized_alias",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  const ids = [...new Set(checks.map((c) => c.work_id))];
  const { data, error } = await db
    .from("work_aliases")
    .select("work_id,alias,normalized_alias")
    .in("work_id", ids);
  if (error) throw error;
  for (const check of checks)
    assert.ok(
      data.some(
        (a) =>
          a.work_id === check.work_id &&
          a.normalized_alias === check.normalized_alias,
      ),
    );
  for (const work of works.filter((w) => ids.includes(w.id)))
    for (const before of work.work_aliases)
      assert.ok(
        data.some(
          (a) =>
            a.work_id === work.id &&
            a.alias === before.alias &&
            a.normalized_alias === before.normalized_alias,
        ),
        "Existing alias changed",
      );
  console.log(
    "Verified: conjunction aliases present; all existing aliases preserved.",
  );
}
