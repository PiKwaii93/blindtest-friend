"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient, configured } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
export function AuthForm({
  mode,
}: {
  mode: "login" | "register" | "reset" | "password";
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const recoveryEnabled =
    process.env.NEXT_PUBLIC_PASSWORD_RECOVERY_ENABLED?.trim() !== "false";
  const title = {
    login: "Bon retour dans le jeu.",
    register: "La prochaine manche est à vous.",
    reset: "Retrouvez votre compte.",
    password: "Un nouveau mot de passe.",
  }[mode];
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const db = browserClient();
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      if (mode === "register") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: location.origin + "/auth/callback",
            data: { username: String(form.get("username")) },
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/profile");
          router.refresh();
          return;
        }
        setMessage(
          "Compte créé. Si la vérification est activée, consultez votre e-mail puis connectez-vous.",
        );
      }
      if (mode === "login") {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/profile");
        router.refresh();
      }
      if (mode === "reset") {
        if (!recoveryEnabled)
          throw new Error(
            "La récupération automatique par e-mail est indisponible.",
          );
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback?next=/password",
        });
        if (error) throw error;
        setMessage(
          "Si ce compte existe, un lien de réinitialisation a été envoyé.",
        );
      }
      if (mode === "password") {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        router.push("/profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }
  if (mode === "reset" && !recoveryEnabled)
    return (
      <main>
        <div className="panel narrow stack">
          <h2>Récupération du compte</h2>
          <p>
            La réinitialisation automatique par e-mail est indisponible. En cas
            de mot de passe oublié, contactez l’administrateur du jeu ; une
            récupération ne pourra être proposée qu’après vérification de votre
            identité.
          </p>
          <Link href="/login" className="link">
            Retour à la connexion
          </Link>
        </div>
      </main>
    );
  return (
    <main>
      <div className="panel narrow stack">
        <span className="eyebrow">Votre compte Encore</span>
        <h2>{title}</h2>
        {mode === "register" && !recoveryEnabled && (
          <p className="notice">
            Aucun e-mail de confirmation n’est envoyé. Conservez votre mot de
            passe : la récupération automatique par e-mail est indisponible.
          </p>
        )}
        {!configured && (
          <div className="notice">
            Le jeu en ligne sera disponible après configuration de Supabase.
          </div>
        )}
        <form action={submit} className="stack">
          {mode === "register" && (
            <div>
              <label htmlFor="username">Pseudonyme</label>
              <input
                id="username"
                name="username"
                required
                minLength={2}
                maxLength={30}
                autoComplete="nickname"
              />
            </div>
          )}
          {mode !== "password" && (
            <div>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
              />
            </div>
          )}
          {mode !== "reset" && (
            <div>
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                name="password"
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <Button disabled={busy || !configured} type="submit">
            {busy
              ? "Un instant…"
              : {
                  login: "Se connecter",
                  register: "Créer mon compte",
                  reset: "Envoyer le lien",
                  password: "Enregistrer",
                }[mode]}
          </Button>
        </form>
        <div className="row small">
          <Link
            className="link"
            href={mode === "login" ? "/register" : "/login"}
          >
            {mode === "login" ? "Créer un compte" : "Se connecter"}
          </Link>
          {mode === "login" && (
            <Link className="link" href="/reset-password">
              Mot de passe oublié ?
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
