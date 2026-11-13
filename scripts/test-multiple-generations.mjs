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
  const { code } = await json(
    await a.page.request.post(origin + "/api/rooms", {
      headers: { origin },
      data: { name: "Test générations multiples" },
    }),
  );
  rooms.push(code);
  const endpoint = origin + "/api/rooms/" + code;
  const initial = await json(await a.page.request.get(endpoint));
  await json(
    await a.page.request.post(endpoint, {
      headers: { origin },
      data: {
        type: "settings",
        settings: {
          ...initial.settings,
          generation: 1990,
          rounds: 2,
          mode: "open",
        },
      },
    }),
  );
  await Promise.all([a, b].map((w) => w.page.goto(origin + "/rooms/" + code)));
  const group = a.page.getByRole("group", {
    name: "Générations (5 ans)",
    exact: true,
  });
  const memberGroup = b.page.getByRole("group", {
    name: "Générations (5 ans)",
    exact: true,
  });
  const box = (year) =>
    group.getByRole("checkbox", { name: new RegExp("^" + year + "–") });
  await expect(box(1990)).toBeChecked();
  await expect(box(1995)).not.toBeChecked();
  await expect(memberGroup.getByRole("checkbox").first()).toBeDisabled();
  await group
    .getByRole("button", { name: "Tout sélectionner", exact: true })
    .click();
  for (const checkbox of await group.getByRole("checkbox").all())
    await expect(checkbox).toBeChecked();
  await group
    .getByRole("button", { name: "Tout désélectionner", exact: true })
    .click();
  await expect(
    a.page.getByText("Cochez au moins une génération.", { exact: true }),
  ).toBeVisible();
  await a.page
    .getByRole("button", { name: "Enregistrer les règles", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await json(await a.page.request.get(endpoint))).settings.generations,
    )
    .toEqual([]);
  await expect(
    a.page.getByRole("button", { name: "Lancer la partie", exact: true }),
  ).toBeDisabled();
  await box(1995).check();
  await box(2005).check();
  const data = await json(await a.page.request.get(origin + "/api/catalogue"));
  const eligible = data.availability.filter((c) =>
    [1995, 2005].includes(Math.floor(c.generationYear / 5) * 5),
  );
  const count = new Set(eligible.map((c) => c.workId)).size;
  await expect(
    a.page.getByText(count + " œuvres disponibles", { exact: true }),
  ).toBeVisible();
  for (const year of [1995, 2005]) {
    const n = new Set(
      data.availability
        .filter((c) => Math.floor(c.generationYear / 5) * 5 === year)
        .map((c) => c.workId),
    ).size;
    await expect(box(year).locator("..")).toContainText(
      n + " " + (n === 1 ? "titre" : "titres"),
    );
  }
  await a.page
    .getByRole("button", { name: "Enregistrer les règles", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await json(await a.page.request.get(endpoint))).settings.generations,
    )
    .toEqual([1995, 2005]);
  const rejected = await b.page.request.post(endpoint, {
    headers: { origin },
    data: {
      type: "settings",
      settings: {
        ...(await json(await a.page.request.get(endpoint))).settings,
        generations: [2000],
      },
    },
  });
  assert.ok([400, 403].includes(rejected.status()));
  await a.page.reload();
  await expect(box(1995)).toBeChecked();
  await expect(box(2005)).toBeChecked();
  await expect(box(2000)).not.toBeChecked();
  await a.page.screenshot({
    path: ".deployment-config/generations-desktop.png",
    fullPage: true,
  });
  await b.page.setViewportSize({ width: 390, height: 844 });
  await b.page.screenshot({
    path: ".deployment-config/generations-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await b.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
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
  await expect(a.page.locator("#answer")).toBeVisible({ timeout: 30000 });
  const state = await db
    .from("rooms")
    .select("state")
    .eq("code", code)
    .eq("owner_id", a.id)
    .single();
  if (state.error) throw state.error;
  const playlist = state.data.state.game.playlist;
  assert.equal(playlist.length, 2);
  assert.equal(new Set(playlist.map((c) => c.workId)).size, 2);
  assert.ok(
    playlist.every((c) =>
      [1995, 2005].includes(Math.floor(c.generationYear / 5) * 5),
    ),
  );
  await Promise.all(
    [a, b].map(async (w) =>
      json(
        await w.page.request.post(endpoint, {
          headers: { origin },
          data: { type: "answer", round: 0, answer: playlist[0].title },
        }),
      ),
    ),
  );
  await expect(
    a.page.getByRole("heading", { name: playlist[0].title, exact: true }),
  ).toBeVisible();
  console.log(
    "PASS multiple generations: legacy single selection, all/none, union counts, persistence, permissions, responsive layout, two-player playlist and reveal.",
  );
} finally {
  await browser.close();
  if (rooms.length)
    await db.from("rooms").delete().in("code", rooms).in("owner_id", users);
  for (const id of users) await db.auth.admin.deleteUser(id);
}
