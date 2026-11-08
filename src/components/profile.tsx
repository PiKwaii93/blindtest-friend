"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient, configured } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
export function Profile() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!configured) return;
    const db = browserClient();
    void db.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
      const { data: p } = await db
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      setUsername(p?.username ?? data.user.user_metadata.username ?? "");
      setAvatar(p?.avatar_url ?? "🎧");
    });
  }, [router]);
  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const { error } = await browserClient()
        .from("profiles")
        .upsert({ id: userId, username: username.trim(), avatar_url: avatar });
      if (error) throw error;
      setStatus("Profil enregistré.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <div className="page-title">
        <span className="eyebrow">Votre espace</span>
        <h1>Mon profil</h1>
      </div>
      <div className="panel narrow stack">
        {!configured ? (
          <p className="notice">Configurez Supabase pour créer votre profil.</p>
        ) : (
          <>
            <div
              className="avatar"
              style={{ width: 70, height: 70, fontSize: 30 }}
            >
              {avatar}
            </div>
            <div>
              <label htmlFor="username">Pseudonyme unique</label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={2}
                maxLength={30}
              />
            </div>
            <div>
              <label htmlFor="avatar">Avatar</label>
              <select
                id="avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              >
                {["🎧", "🎮", "🎸", "🎹", "🎬", "🦊", "🚀", "⚡"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <Button
              disabled={busy || !userId || username.trim().length < 2}
              onClick={save}
            >
              Enregistrer
            </Button>
            {status && <p role="status">{status}</p>}
            <div className="row">
              <Button asChild variant="outline">
                <Link href="/rooms/create">Jouer</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  router.push("/");
                }}
              >
                Se déconnecter
              </Button>
            </div>
          </>
        )}
        <Link href="/profile/history" className="link">
          Mes statistiques et mon historique
        </Link>
      </div>
    </main>
  );
}
