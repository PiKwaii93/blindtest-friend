"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { configured } from "@/lib/supabase/browser";
export function RoomEntry({ join = false }: { join?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      if (join) {
        router.push("/rooms/" + String(form.get("code")).trim().toUpperCase());
        return;
      }
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push("/rooms/" + data.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <div className="panel narrow stack">
        <span className="eyebrow">La musique rassemble</span>
        <h2>{join ? "Rejoindre vos amis" : "Votre salon, vos règles."}</h2>
        <p className="muted">
          {join
            ? "Saisissez le code partagé par le créateur du salon."
            : "Invitez vos amis et préparez votre prochaine soirée."}
        </p>
        {!configured && (
          <div className="notice">
            Supabase n’est pas encore configuré. Les salons seront disponibles
            une fois la connexion établie.
          </div>
        )}
        <form action={submit} className="stack">
          <label htmlFor="entry">
            {join ? "Code du salon" : "Nom du salon"}
          </label>
          <input
            id="entry"
            name={join ? "code" : "name"}
            placeholder={join ? "Ex. A1B2C3D4E5" : "La revanche du vendredi"}
            required
            minLength={2}
            maxLength={join ? 10 : 60}
          />
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <Button disabled={busy || !configured}>
            {busy
              ? "Un instant…"
              : join
                ? "Rejoindre le salon"
                : "Créer le salon"}
          </Button>
        </form>
        <Link href="/login" className="link small">
          Se connecter à mon compte
        </Link>
      </div>
    </main>
  );
}
