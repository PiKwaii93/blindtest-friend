import Link from "next/link";
export default function NotFound() {
  return (
    <main className="narrow">
      <h1>Fausse note.</h1>
      <p className="muted">Cette page n’existe pas.</p>
      <Link className="button button-primary" href="/">
        Retour à l’accueil
      </Link>
    </main>
  );
}
