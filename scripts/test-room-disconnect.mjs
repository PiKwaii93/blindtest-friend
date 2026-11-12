// Two disposable accounts: short outage, closed browser, reconnection, then a second disconnection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const origin = process.env.ENCORE_TEST_ORIGIN ?? "http://localhost:3000";
const production = origin === "https://blindtest-friend.vercel.app";
assert.ok(production || /^http:\/\/localhost:\d+$/.test(origin));
if (production) assert.ok(process.argv.includes("--production"));
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  production ? "lfxqunzxpagpuwsxlatx.supabase.co" : "127.0.0.1",
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const users = [];
let code;
async function json(response) {
  const body = await response.text();
  assert.ok(response.ok(), response.status() + ": " + body);
  return JSON.parse(body);
}
async function account() {
  const suffix = randomUUID().slice(0, 10),
    email = `encore-connection-${suffix}@example.com`,
    password = `Encore!${randomUUID()}`;
  const result = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  const id = result.data.user.id;
  users.push(id);
  const profile = await db
    .from("profiles")
    .insert({ id, username: `Test ${suffix}` });
  if (profile.error) throw profile.error;
  const page = await (await browser.newContext()).newPage();
  await page.goto(origin + "/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30000 });
  return { page, id };
}
try {
  const [a, b] = await Promise.all([account(), account()]);
  ({ code } = await json(
    await a.page.request.post(origin + "/api/rooms", {
      headers: { origin },
      data: { name: "Test déconnexion réelle" },
    }),
  ));
  const endpoint = origin + "/api/rooms/" + code;
  const snapshot = async () => json(await a.page.request.get(endpoint));
  const stored = async () => {
    const r = await db
      .from("rooms")
      .select("id,state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (r.error) throw r.error;
    return r.data;
  };
  const lastSeen = async () => {
    const room = await stored();
    const r = await db
      .from("room_connections")
      .select("last_seen")
      .eq("room_id", room.id)
      .eq("user_id", b.id)
      .single();
    if (r.error) throw r.error;
    return Date.parse(r.data.last_seen);
  };
  const answer = async (title) => {
    await a.page.locator("#answer").fill(title);
    await a.page.locator("#answer").press("Enter");
  };
  await Promise.all(
    [a, b].map(({ page }) => page.goto(origin + "/rooms/" + code)),
  );
  await expect.poll(async () => (await snapshot()).players.length).toBe(2);
  const stranger = await db.rpc("read_room_for_player", {
    p_code: code,
    p_user: randomUUID(),
  });
  assert.ok(stranger.error, "Non-participants cannot record a heartbeat");
  await a.page.getByLabel("Mode de jeu", { exact: true }).selectOption("open");
  await a.page.locator("#rounds").fill("2");
  await a.page
    .getByRole("button", { name: "Enregistrer les règles", exact: true })
    .click();
  for (const { page } of [a, b]) {
    await page
      .getByRole("button", { name: "Activer le son", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Je suis prêt", exact: true })
      .click();
  }
  await a.page
    .getByRole("button", { name: "Lancer la partie", exact: true })
    .click();
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 30000 });
  const initial = (await stored()).state.game,
    title = initial.playlist[0].title;
  await answer(title);
  await expect(a.page.getByText(/Bonne réponse !/)).toBeVisible();
  const savedSession = await b.page.context().storageState();
  const beforeOutage = await lastSeen();
  await b.page.context().setOffline(true);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const short = await snapshot();
  assert.equal(short.game.phase, "PLAYING");
  assert.ok(!short.game.disconnected?.includes(b.id));
  await b.page.context().setOffline(false);
  await expect.poll(lastSeen, { timeout: 6000 }).toBeGreaterThan(beforeOutage);
  await b.page.context().close();
  await expect
    .poll(async () => (await snapshot()).game.phase, { timeout: 18000 })
    .toBe("REVEAL");
  const first = (await stored()).state.game;
  assert.ok(first.disconnected.includes(b.id));
  assert.ok(!first.departed?.includes(b.id));
  assert.ok(first.startedAt < initial.deadline);
  assert.equal(first.deadline - first.startedAt, 10000);
  const detectionMs = first.startedAt - (await lastSeen());
  assert.ok(detectionMs >= 10000 && detectionMs < 17000);
  assert.ok(first.players.find((p) => p.id === a.id).score > 0);
  assert.equal(first.players.find((p) => p.id === b.id).score, 0);
  await expect(
    a.page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(a.page.getByText("1 en ligne", { exact: true })).toBeVisible();
  console.log(
    JSON.stringify({
      origin,
      case: "close-after-other-player-solved",
      detectionMs,
      revealMs: first.deadline - first.startedAt,
      shortOutageTolerated: true,
    }),
  );
  b.page = await (
    await browser.newContext({ storageState: savedSession })
  ).newPage();
  await b.page.goto(origin + "/rooms/" + code);
  await expect
    .poll(async () => (await snapshot()).game.disconnected ?? [], {
      timeout: 6000,
    })
    .toEqual([]);
  await b.page
    .getByRole("button", { name: "Activer le son", exact: true })
    .click();
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 20000 });
  const second = (await stored()).state.game;
  assert.equal(second.round, 1);
  await b.page.context().close();
  await expect
    .poll(async () => (await snapshot()).game.disconnected ?? [], {
      timeout: 18000,
    })
    .toContain(b.id);
  assert.equal(
    (await snapshot()).game.phase,
    "PLAYING",
    "An offline player alone must not trigger reveal while the connected player is still searching",
  );
  await answer(second.playlist[1].title);
  await expect(
    a.page.getByRole("heading", {
      name: second.playlist[1].title,
      exact: true,
    }),
  ).toBeVisible();
  const final = (await stored()).state.game;
  assert.equal(final.phase, "REVEAL");
  assert.ok(final.startedAt < second.deadline);
  assert.equal(final.deadline - final.startedAt, 10000);
  console.log(
    JSON.stringify({
      origin,
      case: "close-before-other-player-solved",
      reconnectionRestoredParticipation: true,
      revealMs: 10000,
    }),
  );
  await expect
    .poll(async () => (await snapshot()).game.phase, { timeout: 18000 })
    .toBe("FINISHED");
  console.log(
    "PASS: two-player real browser closures, short outage grace, reconnection, next-round preparation and ten-second reveals.",
  );
} finally {
  await browser.close();
  if (code) {
    const r = await db
      .from("rooms")
      .delete()
      .eq("code", code)
      .in("owner_id", users);
    if (r.error) console.error(r.error.message);
  }
  for (const id of users) {
    const r = await db.auth.admin.deleteUser(id);
    if (r.error) console.error(r.error.message);
  }
}
