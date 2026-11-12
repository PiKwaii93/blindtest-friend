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
  let newBatch;
  if (process.argv.includes("--new-batch")) {
    const { data, error } = await db.from("works").select("id,editorial_id");
    if (error) throw error;
    newBatch = new Set(
      data
        .filter(
          (w) =>
            /^da-(?:3\d\d|400)$/.test(w.editorial_id ?? "") &&
            w.editorial_id !== "da-300",
        )
        .map((w) => w.id),
    );
    assert.equal(newBatch.size, 100);
    // Only temporary users: recently seen older works put unseen new titles first.
    for (const user of [a, b]) {
      const history = data
        .filter((w) => !newBatch.has(w.id))
        .map((w) => ({
          user_id: user.id,
          work_id: w.id,
          last_played_at: new Date().toISOString(),
          play_count: 1,
        }));
      const r = await db.from("user_work_history").insert(history);
      if (r.error) throw r.error;
    }
  }
  const catalogue = await json(
    await a.page.request.get(origin + "/api/catalogue"),
  );
  const animations = catalogue.availability.filter(
    (c) => c.animationOrigin != null,
  );
  const counts = Object.fromEntries(
    ["western", "japanese"].map((o) => [
      o,
      new Set(
        animations.filter((c) => c.animationOrigin === o).map((c) => c.workId),
      ).size,
    ]),
  );
  assert.ok(counts.western > 0 && counts.japanese > 0);
  for (const selected of ["western", "japanese"]) {
    const { code } = await json(
      await a.page.request.post(origin + "/api/rooms", {
        headers: { origin },
        data: { name: "Test origine " + selected },
      }),
    );
    rooms.push(code);
    const endpoint = origin + "/api/rooms/" + code;
    await Promise.all(
      [a, b].map((x) => x.page.goto(origin + "/rooms/" + code)),
    );
    const select = a.page.locator("#animation-origin");
    await expect(select).toBeVisible();
    await expect(b.page.locator("#animation-origin")).toBeDisabled();
    await a.page
      .getByRole("button", { name: "Tout désélectionner", exact: true })
      .click();
    await a.page
      .getByRole("checkbox", { name: /^Dessins animés \d+$/ })
      .check();
    await select.selectOption(selected);
    const option = await select
      .locator(`option[value=${selected}]`)
      .innerText();
    assert.ok(option.includes(String(counts[selected])), option);
    await a.page
      .getByLabel("Mode de jeu", { exact: true })
      .selectOption("open");
    await a.page.locator("#rounds").fill("1");
    await a.page
      .getByRole("button", { name: "Enregistrer les règles", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await json(await a.page.request.get(endpoint))).settings
            .animationOrigin,
      )
      .toBe(selected);
    const forbidden = await b.page.request.post(endpoint, {
      headers: { origin },
      data: {
        type: "settings",
        settings: {
          ...(await json(await a.page.request.get(endpoint))).settings,
          animationOrigin: "all",
        },
      },
    });
    assert.ok([400, 403].includes(forbidden.status()));
    await a.page.reload();
    await expect(select).toHaveValue(selected);
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
    await expect(a.page.locator("#answer")).toBeVisible({ timeout: 30000 });
    const stored = await db
      .from("rooms")
      .select("state")
      .eq("code", code)
      .eq("owner_id", a.id)
      .single();
    if (stored.error) throw stored.error;
    const game = stored.data.state.game;
    assert.equal(game.playlist.length, 1);
    assert.equal(game.playlist[0].animationOrigin, selected);
    if (newBatch) assert.ok(newBatch.has(game.playlist[0].workId));
    const replies = await Promise.all(
      [a, b].map((who) =>
        who.page.request.post(endpoint, {
          headers: { origin },
          data: { type: "answer", round: 0, answer: game.playlist[0].title },
        }),
      ),
    );
    for (const reply of replies) await json(reply);
    await expect(
      a.page.getByRole("heading", {
        name: game.playlist[0].title,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      b.page.getByRole("heading", {
        name: game.playlist[0].title,
        exact: true,
      }),
    ).toBeVisible();
    console.log(
      "PASS two players",
      selected,
      "count",
      counts[selected],
      "selected",
      game.playlist[0].title,
    );
  }
  console.log(
    "PASS saved origin, reload, non-owner permissions, counts, selections and two-player reveal",
  );
} finally {
  await browser.close();
  if (rooms.length)
    await db.from("rooms").delete().in("code", rooms).in("owner_id", users);
  for (const id of users) await db.auth.admin.deleteUser(id);
}
