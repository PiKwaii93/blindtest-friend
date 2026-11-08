import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
  throw new Error("Local database only");
test("administration : plusieurs médias et import complet en masse", async ({
  page,
}) => {
  const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const suffix = randomUUID(),
    email = `catalogue-${suffix}@example.test`,
    password = randomUUID();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;
  const title = "Import test " + suffix;
  const paths: string[] = [];
  try {
    await db.from("profiles").insert({ id, username: suffix.slice(0, 20) });
    await db.from("administrators").insert({ user_id: id });
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.goto("/admin/import");
    await expect(
      page.getByRole("heading", { name: "Import JSON transactionnel" }),
    ).toBeVisible();
    const wav = readdirSync("public/demo").find((p) => p.endsWith(".wav"))!;
    await page.locator("#upload").setInputFiles([
      {
        name: "autorise.wav",
        mimeType: "audio/wav",
        buffer: readFileSync("public/demo/" + wav),
      },
      {
        name: "illustration.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    ]);
    await expect(page.getByText(/autorise.wav →/)).toBeVisible();
    await expect(page.getByText(/illustration.png →/)).toBeVisible();
    const codes = await page.locator(".success code").allTextContents();
    const audio = codes.find((p) => p.endsWith(".wav"))!,
      image = codes.find((p) => p.startsWith("http"))!;
    paths.push(audio, image.split("/").at(-1)!);
    const { data: categories } = await db
      .from("categories")
      .select("id")
      .limit(2);
    const work = {
      title,
      aliases: ["Alias autorisé"],
      categories: categories!.map((c) => c.id),
      image_path: image,
      rights_source: "Création originale autorisée pour les tests",
      clips: [
        {
          audio_path: audio,
          difficulty: "easy",
          start_ms: 0,
          usable_duration_ms: 30000,
          rights_status: "authorized",
        },
        {
          audio_path: audio,
          difficulty: "hard",
          start_ms: 1000,
          usable_duration_ms: 29000,
          rights_status: "authorized",
        },
      ],
    };
    await page
      .locator("#import-file")
      .setInputFiles({
        name: "catalogue.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify([
            work,
            { ...work, title: title + " bis", image_path: null },
          ]),
        ),
      });
    await page.getByRole("button", { name: "Valider et enregistrer" }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(
      page.getByText("Enregistrement terminé.", { exact: true }),
    ).toBeVisible();
    const { data: stored, error: e } = await db
      .from("works")
      .select(
        "title,image_path,work_aliases(alias),work_categories(category_id),audio_clips(difficulty)",
      )
      .eq("title", title)
      .single();
    expect(e).toBeNull();
    expect(stored!.image_path).toBe(image);
    expect(stored!.work_aliases[0].alias).toBe("Alias autorisé");
    expect(stored!.work_categories).toHaveLength(2);
    expect(stored!.audio_clips).toHaveLength(2);
    expect((await page.request.get(image)).ok()).toBe(true);
  } finally {
    await db
      .from("works")
      .delete()
      .in("title", [title, title + " bis"]);
    if (paths[0]) await db.storage.from("audio").remove([paths[0]]);
    if (paths[1]) await db.storage.from("images").remove([paths[1]]);
    await db.auth.admin.deleteUser(id);
  }
});
