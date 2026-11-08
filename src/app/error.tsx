"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <div className="panel narrow">
        <h2>Un contretemps.</h2>
        <p>Impossible de charger cette page.</p>
        <button className="button button-primary" onClick={reset}>
          Réessayer
        </button>
      </div>
    </main>
  );
}
