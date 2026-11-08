import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  )
)
  throw new Error("Local Supabase only.");
const secret = process.env.RECOVERY_SECRET ?? randomBytes(32).toString("hex");
if (!process.env.RECOVERY_SECRET)
  appendFileSync(".env.local", `\nRECOVERY_SECRET=${secret}\n`);
const sql = `select vault.create_secret('http://host.docker.internal:3000/api/recover','blindtest_recovery_url') where not exists(select 1 from vault.secrets where name='blindtest_recovery_url');
select vault.create_secret('${secret}','blindtest_recovery_secret') where not exists(select 1 from vault.secrets where name='blindtest_recovery_secret');
${readFileSync("supabase/recovery.sql", "utf8")}`;
const result = spawnSync(
  "psql",
  [
    "-h",
    "127.0.0.1",
    "-p",
    "54322",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  },
);
if (result.status !== 0) throw new Error(result.stderr);
console.log(
  "Local recovery scheduled every 5 seconds. Restart the dev server if the secret was newly created.",
);
