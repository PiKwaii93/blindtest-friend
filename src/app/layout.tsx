import type { Metadata } from "next";
import Link from "next/link";
import { AudioLines, UserRound, History } from "lucide-react";
import "./globals.css";
export const metadata: Metadata = {
  title: "Encore — Blind test entre amis",
  description:
    "Une musique. Un déclic. À vous de buzzer. Le blind test multijoueur entre amis.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <AudioLines size={24} />
            </span>
            encore<span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Navigation principale">
            <Link href="/rooms/create">Créer un salon</Link>
            <Link href="/profile/history">
              <History size={16} /> Historique
            </Link>
            <Link href="/profile" className="profile-link">
              <UserRound size={17} />
              <span>Mon profil</span>
            </Link>
          </nav>
        </header>
        {children}
        <footer>
          <Link href="/" className="brand">
            encore.
          </Link>
          <span>Les meilleurs souvenirs commencent par quelques notes.</span>
          <span>Fait pour jouer ensemble ♫</span>
        </footer>
      </body>
    </html>
  );
}
