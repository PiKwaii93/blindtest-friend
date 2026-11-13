// Only inserts aliases from the reviewed 301–400 batch. No media, work or alias is removed.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  normalize,
  normalizeAnswer,
  validateAnswer,
} from "../src/domain/answers.ts";
const [target, action = "check"] = process.argv.slice(2);
assert.ok(["local", "production"].includes(target));
assert.ok(["check", "apply"].includes(action));
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
async function take(p) {
  const { data, error } = await p;
  if (error) throw Error(error.message);
  return data;
}
const manifest = JSON.parse(
  await readFile("catalogue/dessins-animes-400-extension.json", "utf8"),
);
const audit = JSON.parse(
  await readFile("catalogue/dessins-animes-400-aliases-controle.json", "utf8"),
);
const before = await take(
  db
    .from("works")
    .select(
      "id,editorial_id,title,is_active,important_words,work_aliases(alias,normalized_alias),audio_clips(id,audio_path,is_active,rights_status)",
    )
    .order("editorial_id")
    .range(0, 999),
);
assert.ok(
  before.length < 1000,
  "Implement pagination before syncing a larger catalogue",
);
const additions = [],
  variants = [];
for (const row of audit) {
  const work = before.find((w) => w.editorial_id === row.editorialId),
    expected = manifest.find((w) => w.editorialId === row.editorialId);
  assert.ok(work && expected);
  assert.equal(work.title, expected.title);
  assert.ok(
    /^da-(?:3\d\d|400)$/.test(row.editorialId) && row.editorialId !== "da-300",
  );
  for (const alias of row.accepted) {
    for (const other of before.filter((w) => w.id !== work.id)) {
      const otherAnswers = [
        other.title,
        ...other.work_aliases.map((a) => a.alias),
        ...(manifest.find((w) => w.editorialId === other.editorial_id)
          ?.aliases ?? []),
      ];
      assert.ok(
        !otherAnswers.some(
          (a) => normalizeAnswer(a) === normalizeAnswer(alias),
        ),
        `Ambiguous alias ${alias}: ${other.title}`,
      );
      // Check actual engine behavior at the most permissive level as well as exact collisions.
      assert.ok(
        !validateAnswer(alias, otherAnswers, "easy", other.important_words),
        `Alias ${alias} would also accept ${other.title}`,
      );
    }
    const normalized_alias = normalize(alias);
    if (!work.work_aliases.some((a) => a.normalized_alias === normalized_alias))
      additions.push({ work_id: work.id, alias, normalized_alias });
    variants.push({ work, alias });
  }
}
await mkdir(".deployment-config/alias-audit", { recursive: true });
await writeFile(
  `.deployment-config/alias-audit/${target}-before.json`,
  JSON.stringify(before, null, 2),
);
if (action === "apply" && additions.length)
  await take(
    db.from("work_aliases").upsert(additions, {
      onConflict: "work_id,normalized_alias",
      ignoreDuplicates: true,
    }),
  );
const after = await take(
  db
    .from("works")
    .select(
      "id,editorial_id,title,is_active,important_words,work_aliases(alias,normalized_alias),audio_clips(id,audio_path,is_active,rights_status)",
    )
    .order("editorial_id")
    .range(0, 999),
);
for (const old of before) {
  const current = after.find((w) => w.id === old.id);
  assert.ok(current);
  const { work_aliases: oldAliases, ...oldData } = old,
    { work_aliases: currentAliases, ...currentData } = current;
  assert.deepEqual(currentData, oldData);
  for (const alias of oldAliases)
    assert.ok(
      currentAliases.some(
        (a) =>
          a.alias === alias.alias &&
          a.normalized_alias === alias.normalized_alias,
      ),
    );
  if (
    !audit.some((r) => r.editorialId === old.editorial_id && r.accepted.length)
  )
    assert.equal(currentAliases.length, oldAliases.length);
}
if (action === "apply")
  for (const { work, alias } of variants) {
    const current = after.find((w) => w.id === work.id);
    for (const difficulty of ["easy", "normal", "hard"])
      assert.ok(
        validateAnswer(
          alias,
          [current.title, ...current.work_aliases.map((a) => a.alias)],
          difficulty,
          current.important_words,
        ),
        `${alias} refused at ${difficulty}`,
      );
  }
const result = {
  target,
  action,
  reviewed: audit.length,
  changedWorks: audit.filter((r) => r.accepted.length).length,
  variants: variants.length,
  newAliases: additions.length,
  preservedWorks: before.length,
};
await writeFile(
  `.deployment-config/alias-audit/${target}-${action}.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
