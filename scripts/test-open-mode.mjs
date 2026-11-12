// Uses two temporary accounts and their own room; never changes catalogue data.
// node --env-file=.env.local scripts/test-open-mode.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const origin = process.env.ENCORE_TEST_ORIGIN ?? "http://localhost:3000";
const production = origin === "https://blindtest-friend.vercel.app";
assert.ok(production || /^http:\/\/localhost:\d+$/.test(origin));
if (production)
  assert.ok(
    process.argv.includes("--production"),
    "Production test requires --production",
  );
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
  assert.ok(response.ok(), `${response.status()}: ${body}`);
  return JSON.parse(body);
}
async function account() {
  const suffix = randomUUID().slice(0, 10),
    email = `encore-open-${suffix}@example.com`,
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
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30000 });
  return { page, id };
}

try {
  const [a, b] = await Promise.all([account(), account()]);
  ({ code } = await json(
    await a.page.request.post(`${origin}/api/rooms`, {
      headers: { origin },
      data: { name: "Test réponses libres" },
    }),
  ));
  const endpoint = `${origin}/api/rooms/${code}`;
  const snapshot = async () => json(await a.page.request.get(endpoint));
  const command = async (who, data) =>
    json(await who.page.request.post(endpoint, { headers: { origin }, data }));
  async function stored() {
    const result = await db
      .from("rooms")
      .select("state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (result.error) throw result.error;
    return result.data.state.game;
  }
  await Promise.all(
    [a, b].map(({ page }) => page.goto(`${origin}/rooms/${code}`)),
  );
  await expect.poll(async () => (await snapshot()).players.length).toBe(2);
  await a.page.getByLabel("Mode de jeu", { exact: true }).selectOption("open");
  await expect(
    a.page.getByLabel("Durée de la manche (secondes)", { exact: true }),
  ).toHaveValue("30");
  await expect(
    a.page.getByLabel("Temps de réponse (secondes)", { exact: true }),
  ).toHaveCount(0);
  await expect(
    b.page.getByLabel("Mode de jeu", { exact: true }),
  ).toBeDisabled();
  await a.page.locator("#rounds").fill("2");
  await a.page
    .getByLabel("Durée de la manche (secondes)", { exact: true })
    .fill("30");
  await a.page
    .getByRole("button", { name: "Enregistrer les règles", exact: true })
    .click();
  await expect.poll(async () => (await snapshot()).settings.mode).toBe("open");
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
  await expect(
    a.page.getByRole("button", { name: "BUZZ", exact: true }),
  ).toHaveCount(0);
  const initial = await stored(),
    title = initial.playlist[0].title;
  const denied = await a.page.request.post(`${endpoint}/buzz`, {
    headers: { origin },
    data: { round: 0 },
  });
  assert.equal(denied.ok(), false);
  for (let i = 0; i < 2; i++) {
    await a.page.locator("#answer").fill(`Mauvaise réponse ${i}`);
    await a.page.locator("#answer").press("Enter");
    await expect
      .poll(async () => (await snapshot()).game.attempts.length)
      .toBe(i + 1);
    await expect(
      a.page.getByText("Ce n’est pas la bonne réponse. Réessayez !", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(a.page.locator("#answer")).toBeFocused();
  }
  const afterWrong = await stored();
  assert.equal(afterWrong.phase, "PLAYING");
  assert.equal(afterWrong.deadline, initial.deadline);
  assert.equal(afterWrong.startedAt, initial.startedAt);
  assert.equal(afterWrong.consumedMs, initial.consumedMs);
  assert.deepEqual(afterWrong.excluded, []);
  const media = a.page.locator("video").first();
  await expect
    .poll(() => media.evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  await a.page.locator("#answer").fill(title);
  await a.page.locator("#answer").press("Enter");
  await expect(a.page.getByText(/Bonne réponse ! \+/)).toBeVisible();
  const afterFirst = await snapshot();
  assert.equal(afterFirst.game.phase, "PLAYING");
  assert.equal(afterFirst.game.reveal, null);
  assert.equal(afterFirst.game.deadline, initial.deadline);
  await expect(b.page.locator("#answer")).toBeEnabled();
  const firstTime = await media.evaluate((v) => v.currentTime);
  await b.page.route(endpoint, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.postDataJSON().type === "answer")
      await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await b.page.locator("#answer").fill(title);
  await b.page.locator("#answer").press("Enter");
  await expect(
    b.page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await b.page.unroute(endpoint);
  const both = await snapshot();
  const scoreA = both.game.players.find((p) => p.id === a.id).score;
  const scoreB = both.game.players.find((p) => p.id === b.id).score;
  assert.ok(scoreA > scoreB && scoreB >= 100);
  assert.equal(both.game.phase, "REVEAL");
  assert.ok(
    both.game.startedAt < initial.deadline,
    "Reveal must start before the 30-second deadline",
  );
  assert.equal(both.game.deadline - both.game.startedAt, 10000);
  assert.equal(both.game.consumedMs, both.game.startedAt - initial.startedAt);
  assert.equal(
    both.game.attempts.filter((attempt) => attempt.correct).length,
    2,
  );
  assert.ok(
    await media.evaluate(
      (v, previous) => !v.paused && v.currentTime > previous,
      firstTime,
    ),
  );
  const duplicate = await a.page.request.post(endpoint, {
    headers: { origin },
    data: { type: "answer", round: 0, answer: title },
  });
  assert.equal(duplicate.ok(), false);
  console.log(
    JSON.stringify({
      origin,
      title,
      wrongAttempts: 2,
      scoreA,
      scoreB,
      secondPlayerSendDelayMs: 1200,
      continuousPlayback: true,
      earlyReveal: true,
      revealDurationMs: both.game.deadline - both.game.startedAt,
      duplicateRejected: true,
    }),
  );
  for (const { page } of [a, b]) {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible({ timeout: 25000 });
    await expect(page.getByLabel("Réponses trouvées")).toContainText(
      `+${scoreA} points`,
    );
    await expect(page.getByLabel("Réponses trouvées")).toContainText(
      `+${scoreB} points`,
    );
  }
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 20000 });
  const second = await stored();
  assert.equal(second.round, 1);
  assert.notEqual(second.playlist[1].workId, second.playlist[0].workId);
  await expect(a.page.locator("#answer")).toHaveValue("");
  const simultaneous = await Promise.all(
    [a, b].map((who) =>
      command(who, {
        type: "answer",
        round: 1,
        answer: second.playlist[1].title,
      }),
    ),
  );
  assert.equal(simultaneous.length, 2);
  const secondAfter = await snapshot();
  assert.equal(secondAfter.game.phase, "REVEAL");
  assert.equal(secondAfter.game.deadline - secondAfter.game.startedAt, 10000);
  assert.equal(
    secondAfter.game.attempts.filter((attempt) => attempt.correct).length,
    2,
  );
  console.log("PASS: concurrent answers both accepted; no lost scores.");
  await expect
    .poll(async () => (await snapshot()).game.phase, { timeout: 40000 })
    .toBe("FINISHED");
  await a.page
    .getByRole("link", { name: "Voir le bilan par générique", exact: true })
    .click();
  await expect(
    a.page.getByRole("columnheader", {
      name: "Première bonne réponse",
      exact: true,
    }),
  ).toBeVisible();
  await a.page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await a.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "PASS: two-player open game, retries, delayed response, scores, reveal, next round, persisted recap and mobile layout.",
  );
} finally {
  await browser.close();
  if (code) {
    const result = await db
      .from("rooms")
      .delete()
      .eq("code", code)
      .in("owner_id", users);
    if (result.error) console.error("Test room cleanup:", result.error.message);
  }
  for (const id of users) {
    const result = await db.auth.admin.deleteUser(id);
    if (result.error)
      console.error("Test account cleanup:", result.error.message);
  }
}
