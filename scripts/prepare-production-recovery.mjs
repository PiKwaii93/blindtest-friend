import { readFileSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.production.local");
const secret = process.env.RECOVERY_SECRET;
if (!secret || !/^[a-f0-9]{64}$/.test(secret))
  throw new Error("Invalid recovery secret");
const url = process.env.NEXT_PUBLIC_SITE_URL;
if (url !== "https://blindtest-friend.vercel.app")
  throw new Error("Unexpected destination");
const sql = `select vault.create_secret('${url}/api/recover','blindtest_recovery_url') where not exists(select 1 from vault.secrets where name='blindtest_recovery_url');
select vault.create_secret('${secret}','blindtest_recovery_secret') where not exists(select 1 from vault.secrets where name='blindtest_recovery_secret');
${readFileSync("supabase/recovery.sql", "utf8").split("-- Retain completed game history;")[0]}`;
writeFileSync(".deployment-config/recovery-init.sql", sql);
console.log(
  "Recovery SQL prepared in ignored deployment configuration directory.",
);
