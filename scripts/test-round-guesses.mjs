import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const origin = process.env.ENCORE_TEST_ORIGIN ?? "http://localhost:3000";
assert.ok(
  /^http:\/\/localhost:\d+$/.test(origin) ||
    (origin === "https://blindtest-friend.vercel.app" &&
      process.argv.includes("--production")),
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const users = [],
  rooms = [];
async function json(response) {
  assert.ok(response.ok(), "HTTP " + response.status());
  return response.json();
}
async function account() {
  const suffix = randomUUID().slice(0, 10),
    email = `encore-origin-${suffix}@example.com`,
    password = "Encore!" + randomUUID();
  const r = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (r.error) throw r.error;
  const id = r.data.user.id;
  users.push(id);
  const p = await db
    .from("profiles")
    .insert({ id, username: "Origin " + suffix });
  if (p.error) throw p.error;
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
  const all = await db.from("works").select("id,editorial_id,title");
  if (all.error) throw all.error;
  for (const [mode, id, answer] of [
    ["individual", "da-086", "PawPatrol"],
    ["open", "vg-048", "FF 7"],
  ]) {
    const target = all.data.find((w) => w.editorial_id === id);
    assert.ok(target);
    for (const who of [a, b]) {
      const h = await db.from("user_work_history").upsert(
        all.data
          .filter((w) => w.id !== target.id)
          .map((w) => ({
            user_id: who.id,
            work_id: w.id,
            last_played_at: new Date().toISOString(),
            play_count: 1,
          })),
        { onConflict: "user_id,work_id" },
      );
      if (h.error) throw h.error;
      const clear = await db
        .from("user_work_history")
        .delete()
        .eq("user_id", who.id)
        .eq("work_id", target.id);
      if (clear.error) throw clear.error;
    }
    const { code } = await json(
      await a.page.request.post(origin + "/api/rooms", {
        headers: { origin },
        data: { name: "Test propositions " + mode },
      }),
    );
    rooms.push(code);
    const endpoint = origin + "/api/rooms/" + code;
    await Promise.all(
      [a, b].map((w) => w.page.goto(origin + "/rooms/" + code)),
    );
    const state = await json(await a.page.request.get(endpoint));
    assert.equal(state.settings.listenSeconds, 15);
    assert.equal(state.settings.answerSeconds, 15);
    await a.page.locator("#mode").selectOption("open");
    await expect(a.page.locator("#listen")).toHaveValue("15");
    if (mode === "individual")
      await a.page.locator("#mode").selectOption("individual");
    await json(
      await a.page.request.post(endpoint, {
        headers: { origin },
        data: {
          type: "settings",
          settings: {
            ...state.settings,
            categories: [
              mode === "individual" ? "Dessins animés" : "Jeux vidéo",
            ],
            rounds: 1,
            mode,
          },
        },
      }),
    );
    for (const who of [a, b]) {
      const sound = who.page.getByRole("button", {
        name: "Activer le son",
        exact: true,
      });
      if (await sound.isVisible()) await sound.click();
      await who.page
        .getByRole("button", { name: "Je suis prêt", exact: true })
        .click();
    }
    await a.page
      .getByRole("button", { name: "Lancer la partie", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await json(await a.page.request.get(endpoint))).game?.phase,
        { timeout: 30000 },
      )
      .toBe("PLAYING");
    const stored = await db
      .from("rooms")
      .select("state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (stored.error) throw stored.error;
    assert.equal(stored.data.state.game.playlist[0].workId, target.id);
    if (mode === "individual")
      await json(
        await a.page.request.post(endpoint, {
          headers: { origin },
          data: { type: "buzz", round: 0 },
        }),
      );
    await expect(a.page.locator("#answer")).toBeVisible();
    const bad =
      'Un grille-pain volant <img src=x onerror="window.__encoreUnsafeAnswer=1">';
    await a.page.locator("#answer").fill(bad);
    await a.page.locator("#answer").press("Enter");
    await expect
      .poll(async () => {
        const r = await db
          .from("rooms")
          .select("state")
          .eq("code", code)
          .eq("owner_id", a.id)
          .single();
        return r.data.state.game.attempts.some((t) => t.answer === bad);
      })
      .toBe(true);
    const hidden = await json(await b.page.request.get(endpoint));
    assert.ok(!JSON.stringify(hidden.game.attempts).includes(bad));
    await expect(b.page.locator(".round-guesses")).toHaveCount(0);
    if (mode === "individual") {
      await b.page.waitForTimeout(700);
      await json(
        await b.page.request.post(endpoint, {
          headers: { origin },
          data: { type: "buzz", round: 0 },
        }),
      );
      await expect(b.page.locator("#answer")).toBeVisible();
      await b.page.locator("#answer").fill(answer);
      await b.page.locator("#answer").press("Enter");
    } else {
      for (const who of [a, b]) {
        await who.page.locator("#answer").fill(answer);
        await who.page.locator("#answer").press("Enter");
      }
    }
    for (const who of [a, b])
      await expect(
        who.page.getByRole("heading", { name: target.title, exact: true }),
      ).toBeVisible();
    if (mode === "individual") {
      for (const who of [a, b]) {
        const guesses = who.page.getByRole("region", {
          name: "Les propositions des joueurs",
        });
        await expect(guesses).toContainText(bad);
        await expect(guesses).toContainText(answer);
        await expect(guesses).toContainText("Mauvaise réponse");
        await expect(guesses).toContainText("Bonne réponse");
        await expect(guesses.locator("li")).toHaveCount(2);
        await expect(guesses.locator("img")).toHaveCount(0);
        assert.equal(
          await who.page.evaluate(() => window.__encoreUnsafeAnswer),
          undefined,
        );
      }
      await a.page.screenshot({
        path: ".deployment-config/round-guesses-desktop.png",
        fullPage: true,
      });
      await b.page.setViewportSize({ width: 390, height: 844 });
      await b.page.screenshot({
        path: ".deployment-config/round-guesses-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await b.page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await b.page.setViewportSize({ width: 1280, height: 720 });
    } else {
      for (const who of [a, b])
        await expect(who.page.locator(".round-guesses")).toHaveCount(0);
      const r = await json(await b.page.request.get(endpoint));
      assert.ok(r.game.attempts.every((t) => t.answer === undefined));
    }
    console.log(
      "PASS",
      mode,
      target.title,
      answer,
      "defaults 15/15, private during round, revealed only in classic mode",
    );
  }
} finally {
  await browser.close();
  if (rooms.length)
    await db.from("rooms").delete().in("code", rooms).in("owner_id", users);
  for (const id of users) await db.auth.admin.deleteUser(id);
}
