import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
  throw new Error("E2E tests require the disposable LOCAL Supabase instance.");
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const origin = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("corrections salon : catégories, réduction, une manche et illustrations", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let id = "",
    code = "";
  try {
    id = await account(page, 99);
    const created = await page.request.post("/api/rooms", {
      data: { name: "Régression salon" },
      headers: { origin },
    });
    code = (await created.json()).code;
    await page.goto("/rooms/" + code);
    await page
      .getByRole("button", { name: "Tout désélectionner", exact: true })
      .click();
    await page.getByLabel("Films", { exact: false }).check();
    await expect(
      page.getByRole("button", { name: "Enregistrer les règles" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect
      .poll(async () => (await state(page, code)).settings.categories)
      .toEqual(["Films"]);
    await expect(
      page.getByText("Vos coéquipiers restent en jeu.", { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByText(/Seulement 8 œuvres/)).toBeVisible();
    await page.getByRole("button", { name: "Réduire à 8 manches" }).click();
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect
      .poll(async () => (await state(page, code)).settings.rounds)
      .toBe(8);
    await page.getByLabel("Jeux vidéo", { exact: false }).check();
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect
      .poll(async () => (await state(page, code)).settings.categories.length)
      .toBe(2);
    await page.locator("#rounds").fill("1");
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect
      .poll(async () => (await state(page, code)).settings.rounds)
      .toBe(1);
    await page.getByRole("button", { name: "Activer le son" }).click();
    await page
      .getByRole("button", { name: "Je suis prêt", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Lancer la partie" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Lancer la partie" }).click();
    await expect(
      page.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expire(code);
    await post(page, code, { type: "tick" });
    await page.reload();
    for (const image of [
      null,
      origin + "/reveal-placeholder.svg",
      origin + "/missing-illustration.png",
    ]) {
      const { data: row, error } = await db
        .from("rooms")
        .select("id,state,version")
        .eq("code", code)
        .single();
      if (error) throw error;
      row.state.game.playlist[0].image = image;
      row.state.game.deadline = Date.now() + 60000;
      await db
        .from("rooms")
        .update({ state: row.state, version: row.version + 1 })
        .eq("id", row.id);
      await page.reload();
      const illustration = page.getByRole("img", {
        name:
          image && !image.includes("missing")
            ? /Illustration de Signal/
            : /Illustration musicale de remplacement/,
      });
      await expect(illustration).toBeVisible();
      await expect
        .poll(() =>
          illustration.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
  } finally {
    if (code) await db.from("rooms").delete().eq("code", code);
    if (id) await db.auth.admin.deleteUser(id);
    await context.close();
  }
});
async function post(page: Page, code: string, body: unknown) {
  const r = await page.request.post(`/api/rooms/${code}`, {
    data: body,
    headers: { origin },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
}
test("audio réel, Broadcast privé, clavier, permissions et départ du propriétaire", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const ids: string[] = [];
  let code = "";
  const arrivals: { version: number; at: number }[] = [];
  q.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      try {
        if (Buffer.isBuffer(frame.payload) && frame.payload[0] === 4) {
          const bytes = frame.payload;
          const topicLength = bytes[1],
            eventLength = bytes[2],
            metadataLength = bytes[3];
          const event = bytes
            .subarray(5 + topicLength, 5 + topicLength + eventLength)
            .toString();
          if (event === "STATE_CHANGED" && bytes[4] === 1) {
            const payload = JSON.parse(
              bytes
                .subarray(5 + topicLength + eventLength + metadataLength)
                .toString(),
            );
            arrivals.push({ version: payload.version, at: Date.now() });
          }
          return;
        }
        const raw = JSON.parse(String(frame.payload));
        const message = Array.isArray(raw)
          ? { event: raw[3], payload: raw[4] }
          : raw;
        if (
          message.event === "broadcast" &&
          message.payload.event === "STATE_CHANGED"
        )
          arrivals.push({
            version: message.payload.payload.version,
            at: Date.now(),
          });
      } catch {}
    }),
  );
  try {
    ids.push(await account(p, 20), await account(q, 21));
    const create = await p.request.post("/api/rooms", {
      data: { name: "Audio réel" },
      headers: { origin },
    });
    code = (await create.json()).code;
    expect(code).toBeTruthy();
    await post(q, code, { type: "join" });
    let s = await state(p, code);
    await post(p, code, {
      type: "settings",
      settings: { ...s.settings, rounds: 10, listenSeconds: 30 },
    });
    await p.goto("/rooms/" + code);
    await q.goto("/rooms/" + code);
    for (const page of [p, q]) {
      await page.getByRole("button", { name: "Activer le son" }).click();
      await page
        .getByRole("button", { name: "Je suis prêt", exact: true })
        .click();
    }
    await expect(
      p.getByRole("button", { name: "Lancer la partie" }),
    ).toBeEnabled();
    await p.getByRole("button", { name: "Lancer la partie" }).click();
    await expect(
      p.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expect(
      q.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(() =>
        p
          .locator("audio")
          .evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 0),
      )
      .toBe(true);
    await expect
      .poll(() =>
        q
          .locator("audio")
          .evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 0),
      )
      .toBe(true);
    await p.locator("h1").click();
    await p.keyboard.press("Space");
    await expect(p.getByLabel("Quel est le titre de l’œuvre ?")).toBeFocused();
    s = await state(p, code);
    const buzzVersion = s.version;
    const acceptedAt = s.game.attempts.at(-1).acceptedAt;
    await expect
      .poll(() => arrivals.some((x) => x.version === buzzVersion))
      .toBe(true);
    console.log(
      JSON.stringify({
        broadcastAcceptanceToSecondBrowserMs:
          arrivals.find((x) => x.version === buzzVersion)!.at - acceptedAt,
        environment: "local Chromium",
      }),
    );
    await expect
      .poll(() =>
        q.locator("audio").evaluate((el: HTMLAudioElement) => el.paused),
      )
      .toBe(true);
    await p
      .getByLabel("Quel est le titre de l’œuvre ?")
      .fill("Mauvaise réponse");
    await p.keyboard.press("Enter");
    await expect(
      q.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expect(
      p.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeDisabled();
    const denied = await q.request.post("/api/admin", {
      data: { works: [] },
      headers: { origin },
    });
    expect(denied.ok()).toBe(false);
    const forbidden = await q.request.post("/api/rooms/" + code, {
      data: { type: "settings", settings: s.settings },
      headers: { origin },
    });
    expect(forbidden.ok()).toBe(false);
    await post(p, code, { type: "leave" });
    s = await state(q, code);
    expect(s.ownerId).toBe(ids[1]);
    expect(s.game.departed).toContain(ids[0]);
    await p.goto("/profile");
    await q.goto("/profile");
    await expire(code);
    await post(q, code, { type: "tick" });
    await expire(code);
    await post(q, code, { type: "tick" });
    await expire(code);
    await post(q, code, { type: "tick" });
    s = await state(q, code);
    expect(s.game.phase).toBe("PREPARING");
    await post(q, code, { type: "loaded", round: 1 });
    s = await state(q, code);
    expect(s.game.phase).toBe("COUNTDOWN");
  } finally {
    if (code) await db.from("rooms").delete().eq("code", code);
    for (const id of ids) await db.auth.admin.deleteUser(id);
    await a.close();
    await b.close();
  }
});
async function state(page: Page, code: string) {
  const r = await page.request.get(`/api/rooms/${code}`);
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function expire(code: string) {
  const { data, error } = await db
    .from("rooms")
    .select("id,state")
    .eq("code", code)
    .single();
  if (error) throw error;
  data.state.game.deadline = Date.now() - 10;
  const { error: e } = await db
    .from("rooms")
    .update({ state: data.state })
    .eq("id", data.id);
  if (e) throw e;
}
async function account(page: Page, index: number) {
  const suffix = randomUUID().slice(0, 8);
  const email = `e2e-${suffix}@example.test`;
  const password = "Test-only-" + randomUUID();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;
  const { error: e } = await db
    .from("profiles")
    .insert({ id, username: `Test ${index} ${suffix}`, avatar_url: "🎧" });
  if (e) throw e;
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return id;
}
test("accueil, mobile et refus des accès non authentifiés", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Vous connaissez/ }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const response = await page.request.post("/api/rooms", {
    data: { name: "Interdit" },
    headers: { origin },
  });
  expect(response.status()).toBe(401);
});
for (const configuration of [
  { rounds: 10, mode: "individual" },
  { rounds: 50, mode: "teams" },
] as const) {
  test(`12 joueurs, ${configuration.rounds} manches, ${configuration.mode} : concurrence et fin`, async ({
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const ids: string[] = [];
    let code = "";
    try {
      for (let i = 0; i < 12; i++) {
        const context = await browser.newContext();
        contexts.push(context);
        const page = await context.newPage();
        pages.push(page);
        ids.push(await account(page, i));
      }
      await pages[0].goto("/rooms/create");
      await pages[0].getByLabel("Nom du salon").fill("Test des 12 joueurs");
      await pages[0]
        .getByRole("button", { name: "Créer le salon", exact: true })
        .click();
      await expect(pages[0]).toHaveURL(/\/rooms\/[A-F0-9]{10}$/);
      code = pages[0].url().split("/").at(-1)!;
      for (let i = 1; i < 12; i++) await post(pages[i], code, { type: "join" });
      let s = await state(pages[0], code);
      await post(pages[0], code, {
        type: "settings",
        settings: {
          ...s.settings,
          rounds: configuration.rounds,
          mode: configuration.mode,
          listenSeconds: 30,
          answerSeconds: 10,
        },
      });
      if (configuration.mode === "teams")
        for (let i = 0; i < pages.length; i++)
          await post(pages[i], code, {
            type: "team",
            team: i % 2 ? "Bleus" : "Violets",
          });
      for (const page of pages)
        await post(page, code, { type: "ready", ready: true });
      await post(pages[0], code, { type: "start" });
      for (const page of pages)
        await post(page, code, { type: "loaded", round: 0 });
      await expire(code);
      await post(pages[0], code, { type: "tick" });
      // Set the listening start to now after accelerated countdown, preserving a real 30s deadline.
      const { data: row } = await db
        .from("rooms")
        .select("id,state")
        .eq("code", code)
        .single();
      row!.state.game.startedAt = Date.now();
      row!.state.game.deadline = Date.now() + 30000;
      await db.from("rooms").update({ state: row!.state }).eq("id", row!.id);
      const start = performance.now();
      const responses = await Promise.all(
        pages.map((p) =>
          p.request.post(`/api/rooms/${code}`, {
            data: { type: "buzz", round: 0 },
            headers: { origin },
          }),
        ),
      );
      const duration = performance.now() - start;
      expect(responses.filter((r) => r.ok())).toHaveLength(1);
      s = await state(pages[0], code);
      expect(JSON.stringify(s)).not.toContain("Signal ");
      expect(s.game.phase).toBe("ANSWERING");
      const winner = ids.indexOf(s.game.attempts.at(-1).playerId);
      await post(pages[winner], code, {
        type: "answer",
        round: 0,
        answer: "Réponse volontairement incorrecte",
      });
      s = await state(pages[0], code);
      expect(s.game.excluded).toContain(ids[winner]);
      expect(s.game.phase).toBe("PLAYING");
      const next = (winner + 1) % 12;
      await new Promise((r) => setTimeout(r, 600));
      await post(pages[next], code, { type: "buzz", round: 0 });
      const { data: privateRow } = await db
        .from("rooms")
        .select("state")
        .eq("code", code)
        .single();
      await post(pages[next], code, {
        type: "answer",
        round: 0,
        answer: privateRow!.state.game.playlist[0].title,
      });
      s = await state(pages[0], code);
      expect(s.game.phase).toBe("REVEAL");
      expect(s.game.players[next].score).toBeGreaterThanOrEqual(100);
      await pages[next].goto("/rooms/" + code);
      await expect(
        pages[next].getByRole("heading", {
          name: s.game.reveal.title,
          exact: true,
        }),
      ).toBeVisible();
      await pages[next].reload();
      await expect(
        pages[next].getByRole("heading", {
          name: s.game.reveal.title,
          exact: true,
        }),
      ).toBeVisible();
      await pages[0].goto("/profile");
      await pages[next].goto("/profile");
      // Drive persisted deadlines forward for the remaining rounds; never modify scores/results.
      // Distribute requests across participants so accelerated tests respect production rate limits.
      for (let guard = 0; guard < 400; guard++) {
        const driver = pages[guard % pages.length];
        s = await state(driver, code);
        if (s.game.phase === "FINISHED") break;
        if (s.game.phase === "PREPARING") {
          for (const page of pages)
            await post(page, code, { type: "loaded", round: s.game.round });
        } else {
          await expire(code);
          await post(driver, code, { type: "tick" });
        }
      }
      s = await state(pages[0], code);
      expect(s.game.phase).toBe("FINISHED");
      expect(s.game.round).toBe(configuration.rounds - 1);
      const { data: results, error } = await db
        .from("game_players")
        .select("*")
        .eq("game_id", s.gameId);
      expect(error).toBeNull();
      expect(results).toHaveLength(12);
      await pages[0].goto(`/games/${s.gameId}/results`);
      await expect(
        pages[0].getByRole("heading", { name: "Quel beau final." }),
      ).toBeVisible();
      console.log(
        JSON.stringify({
          participants: 12,
          rounds: configuration.rounds,
          concurrentBuzzRequestsMs: Math.round(duration),
          note: "Local API batch duration, not Broadcast delivery latency.",
        }),
      );
    } finally {
      if (code) await db.from("rooms").delete().eq("code", code);
      for (const id of ids) await db.auth.admin.deleteUser(id);
      for (const c of contexts) await c.close();
    }
  });
}
