// Real browser reconnections, existing points, concurrent duplicate packets and stale-round replies.
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
    email = `encore-reconnect-${suffix}@example.com`,
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
      data: { name: "Test points et reconnexion" },
    }),
  ));
  const endpoint = origin + "/api/rooms/" + code;
  const snapshot = async () => json(await a.page.request.get(endpoint));
  const stored = async () => {
    const r = await db
      .from("rooms")
      .select("state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (r.error) throw r.error;
    return r.data.state.game;
  };
  const points = (g, id) => g.players.find((p) => p.id === id).score;
  const response = (who, round, title) =>
    who.page.request.post(endpoint, {
      headers: { origin },
      data: { type: "answer", round, answer: title },
    });
  const command = async (who, round, title) =>
    json(await response(who, round, title));
  const uiAnswer = async (who, title) => {
    await who.page.locator("#answer").fill(title);
    await who.page.locator("#answer").press("Enter");
  };
  await Promise.all(
    [a, b].map(({ page }) => page.goto(origin + "/rooms/" + code)),
  );
  await expect.poll(async () => (await snapshot()).players.length).toBe(2);
  await a.page.getByLabel("Mode de jeu", { exact: true }).selectOption("open");
  await a.page.locator("#rounds").fill("3");
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
  const first = await stored();
  await Promise.all(
    [a, b].map((who) => command(who, 0, first.playlist[0].title)),
  );
  const scored = await stored(),
    baseline = points(scored, b.id);
  assert.ok(baseline > 0);
  assert.equal(scored.phase, "REVEAL");
  await expect(
    a.page.getByRole("heading", { name: first.playlist[0].title, exact: true }),
  ).toBeVisible();
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 20000 });
  const second = await stored();
  assert.equal(second.round, 1);
  const session = await b.page.context().storageState();
  await b.page.context().close();
  await expect
    .poll(async () => (await snapshot()).game.disconnected ?? [], {
      timeout: 18000,
    })
    .toContain(b.id);
  assert.equal((await snapshot()).game.phase, "PLAYING");
  async function reconnect() {
    b.page = await (
      await browser.newContext({ storageState: session })
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
  }
  await reconnect();
  await expect(b.page.locator("#answer")).toBeVisible();
  const returned = await stored();
  assert.equal(points(returned, b.id), baseline);
  assert.equal(returned.players.find((p) => p.id === b.id).correct, 1);
  assert.equal(returned.startedAt, second.startedAt);
  assert.equal(returned.deadline, second.deadline);
  assert.ok(!returned.departed?.includes(b.id));
  // Retry the same response concurrently, as can happen around a network interruption.
  const duplicated = await Promise.all([
    response(b, 1, second.playlist[1].title),
    response(b, 1, second.playlist[1].title),
  ]);
  assert.deepEqual(duplicated.map((r) => r.status()).sort(), [200, 400]);
  const once = await stored();
  const successful = once.attempts.filter(
    (at) => at.playerId === b.id && at.correct,
  );
  assert.equal(successful.length, 1);
  assert.equal(points(once, b.id), baseline + successful[0].points);
  assert.equal(once.players.find((p) => p.id === b.id).correct, 2);
  assert.equal(once.phase, "PLAYING");
  const scoreAfter = points(once, b.id);
  await b.page.context().close();
  await reconnect();
  await expect(b.page.getByText(/Bonne réponse ! \+/)).toBeVisible();
  await expect(b.page.locator("#answer")).toHaveCount(0);
  assert.equal(points(await stored(), b.id), scoreAfter);
  const replay = await response(b, 1, second.playlist[1].title);
  assert.equal(replay.status(), 400);
  assert.equal(points(await stored(), b.id), scoreAfter);
  await uiAnswer(a, second.playlist[1].title);
  await expect(
    a.page.getByRole("heading", {
      name: second.playlist[1].title,
      exact: true,
    }),
  ).toBeVisible();
  console.log(
    JSON.stringify({
      origin,
      previousPoints: baseline,
      pointsAfterOneValidAnswer: scoreAfter,
      reconnectedBeforeSolving: true,
      reconnectedAfterSolving: true,
      concurrentStatuses: duplicated.map((r) => r.status()).sort(),
      duplicateReplayRejected: true,
    }),
  );
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 20000 });
  const third = await stored();
  assert.equal(third.round, 2);
  await expect(b.page.locator("#answer")).toBeVisible();
  const stale = await response(b, 1, third.playlist[2].title);
  assert.equal(stale.status(), 400);
  assert.equal(points(await stored(), b.id), scoreAfter);
  await uiAnswer(b, third.playlist[2].title);
  await expect(b.page.getByText(/Bonne réponse ! \+/)).toBeVisible();
  await uiAnswer(a, third.playlist[2].title);
  await expect
    .poll(async () => (await snapshot()).game.phase, { timeout: 18000 })
    .toBe("FINISHED");
  const finished = await snapshot();
  assert.equal(finished.game.players.find((p) => p.id === b.id).correct, 3);
  const archived = await db
    .from("game_players")
    .select("score,correct")
    .eq("game_id", finished.gameId)
    .eq("user_id", b.id)
    .single();
  if (archived.error) throw archived.error;
  assert.equal(archived.data.correct, 3);
  assert.equal(archived.data.score, points(finished.game, b.id));
  console.log(
    "PASS: two-player reconnection, retained score and clock, one award per round, concurrent duplicate and stale-round rejection, next-round answer and persisted totals.",
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
