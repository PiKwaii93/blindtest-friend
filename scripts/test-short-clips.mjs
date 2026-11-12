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
  const availability = (
    await json(await a.page.request.get(origin + "/api/catalogue"))
  ).availability;
  const worksResult = await db
    .from("works")
    .select("id,editorial_id")
    .like("editorial_id", "da-%")
    .range(0, 999);
  if (worksResult.error) throw worksResult.error;
  const ids = new Set(worksResult.data.map((w) => w.id));
  const cartoons = availability.filter((c) => ids.has(c.workId));
  assert.equal(new Set(cartoons.map((c) => c.workId)).size, 300);
  const frozen = cartoons
    .filter((c) => c.freezeOnReveal)
    .sort((a, b) => a.durationMs - b.durationMs)[0];
  const short = cartoons
    .filter((c) => !c.freezeOnReveal && c.durationMs < 20000)
    .sort((a, b) => a.durationMs - b.durationMs)[0];
  assert.ok(frozen && short);
  ({ code } = await json(
    await a.page.request.post(origin + "/api/rooms", {
      headers: { origin },
      data: { name: "Test vrais génériques courts" },
    }),
  ));
  const endpoint = origin + "/api/rooms/" + code;
  const command = async (who, data) =>
    json(await who.page.request.post(endpoint, { headers: { origin }, data }));
  const snapshot = async () =>
    json(await a.page.request.get(endpoint, { maxRetries: 2 }));
  const settings = {
    categories: ["Dessins animés"],
    difficulties: ["easy", "normal", "hard"],
    rounds: 1,
    listenSeconds: 30,
    answerSeconds: 10,
    mode: "open",
  };
  await command(b, { type: "join" });
  await command(a, { type: "settings", settings });
  await Promise.all(
    [a, b].map(({ page }) => page.goto(origin + "/rooms/" + code)),
  );
  const expected = new Set(
    availability
      .filter(
        (c) => c.categories.includes("Dessins animés") && c.durationMs > 0,
      )
      .map((c) => c.workId),
  ).size;
  if (production) assert.equal(expected, 300);
  for (const seconds of ["30", "5", "30"]) {
    await a.page
      .getByLabel("Durée de la manche (secondes)", { exact: true })
      .fill(seconds);
    await expect(
      a.page.getByText(expected + " œuvres disponibles", { exact: true }),
    ).toBeVisible();
  }
  console.log(
    JSON.stringify({ origin, cartoonsAvailableAt5And30Seconds: expected }),
  );
  for (const [index, chosen] of [frozen, short].entries()) {
    await Promise.all([a, b].map(({ page }) => page.goto(origin + "/profile")));
    await command(a, { type: "settings", settings });
    for (const who of [a, b])
      await command(who, { type: "ready", ready: true });
    await command(a, { type: "start" });
    const stored = await db
      .from("rooms")
      .select("state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (stored.error) throw stored.error;
    const result = await db
      .from("works")
      .select(
        "id,title,image_path,image_attribution,important_words,research,work_aliases(alias),audio_clips(*)",
      )
      .eq("id", chosen.workId)
      .single();
    if (result.error) throw result.error;
    const work = result.data;
    const candidate = work.audio_clips
      .map((c) => ({
        c,
        start:
          work.research?.sandbox_review?.path === c.audio_path
            ? work.research.sandbox_review.startMs
            : c.start_ms,
      }))
      .find(
        ({ c, start }) =>
          c.difficulty === chosen.difficulty &&
          (!production || (c.is_active && c.rights_status === "authorized")) &&
          Boolean(
            work.research?.sandbox_freeze_reveal?.path === c.audio_path,
          ) === Boolean(chosen.freezeOnReveal) &&
          c.audio_path !== work.research?.sandbox_video_excluded?.path &&
          Math.abs(
            c.start_ms + c.usable_duration_ms - start - chosen.durationMs,
          ) < 1,
      );
    assert.ok(candidate);
    const { c, start } = candidate,
      state = stored.data.state;
    // Only this disposable room is made deterministic; actual catalogue files and metadata stay untouched.
    state.game.playlist[0] = {
      ...state.game.playlist[0],
      id: c.id,
      workId: work.id,
      title: work.title,
      aliases: work.work_aliases.map((a) => a.alias),
      important: work.important_words,
      categories: ["Dessins animés"],
      path: c.audio_path,
      image: work.image_path,
      imageAttribution: work.image_attribution,
      startMs: start,
      durationMs: chosen.durationMs,
      freezeOnReveal: chosen.freezeOnReveal,
    };
    const update = await db
      .from("rooms")
      .update({ state })
      .eq("code", code)
      .eq("owner_id", a.id);
    if (update.error) throw update.error;
    await Promise.all(
      [a, b].map(({ page }) => page.goto(origin + "/rooms/" + code)),
    );
    for (const { page } of [a, b])
      await page
        .getByRole("button", { name: "Activer le son", exact: true })
        .click();
    await expect(a.page.locator("#answer")).toBeVisible({ timeout: 30000 });
    const playing = await snapshot();
    assert.equal(playing.game.settings.listenSeconds, 30);
    assert.equal(
      playing.game.deadline - playing.game.startedAt,
      chosen.durationMs,
    );
    for (const { page } of [a, b])
      await expect(
        page.getByRole("heading", { name: work.title, exact: true }),
      ).toBeVisible({ timeout: 25000 });
    const reveal = await snapshot();
    assert.equal(reveal.game.consumedMs, chosen.durationMs);
    assert.equal(reveal.game.deadline - reveal.game.startedAt, 10000);
    const video = a.page.locator(".reveal-video video");
    await expect
      .poll(() =>
        video.evaluate((v) => v.paused && v.currentTime >= v.duration - 0.15),
      )
      .toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assert.ok(
      await video.evaluate(
        (v) => !v.loop && v.paused && v.currentTime >= v.duration - 0.15,
      ),
    );
    console.log(
      JSON.stringify({
        origin,
        title: work.title,
        requestedMs: 30000,
        actualMs: chosen.durationMs,
        revealMs: 10000,
        lastFrameHeld: true,
      }),
    );
    await expect
      .poll(async () => (await snapshot()).game.phase, { timeout: 15000 })
      .toBe("FINISHED");
    if (index === 0) await command(a, { type: "lobby" });
  }
  console.log(
    "PASS: 300 cartoons retained, matching counts at 5 and 30 seconds, two real short clips at two players, actual deadlines and ten-second still-frame reveals.",
  );
} catch (error) {
  const message = String(error?.message ?? error);
  console.error(
    /cookie|authorization/i.test(message) ? message.split("\n")[0] : message,
  );
  process.exitCode = 1;
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
