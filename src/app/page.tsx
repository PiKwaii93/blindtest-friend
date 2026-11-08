import Link from "next/link";
import {
  ArrowUpRight,
  AudioLines,
  Disc3,
  Film,
  Gamepad2,
  Headphones,
  Music2,
  Radio,
  Sparkles,
  Tv,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryNames } from "@/domain/settings";
const icons = [Gamepad2, Film, Tv, Sparkles, Zap, Music2, Radio];
export default function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <span className="pill">
            <span style={{ color: "#b6f0d5" }}>●</span> VOTRE PROCHAINE SOIRÉE
            COMMENCE ICI
          </span>
          <h1>
            Vous connaissez
            <br />
            la chanson.
            <br />
            <span className="gradient-text">Prouvez-le.</span>
          </h1>
          <p>
            Quelques notes, un déclic, un buzzer. Défiez vos amis dans un blind
            test où chaque seconde compte.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/rooms/create">
                <Zap size={17} /> Créer un salon <ArrowUpRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/rooms/join">Rejoindre un salon</Link>
            </Button>
          </div>
          <p className="hero-note">
            À distance ou côte à côte. Chacun son écran, la même musique.
          </p>
        </div>
        <div className="turntable" aria-hidden="true">
          <div className="vinyl">
            <div className="vinyl-center">
              <Headphones size={42} />
              <span />
            </div>
          </div>
          <div className="float-card top">
            <div className="wave">
              {[12, 22, 15, 26, 18, 10].map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </div>
            <div>
              <strong>Ça vous dit quelque chose ?</strong>
              <small>Écoutez. Reconnaissez. Buzzez.</small>
            </div>
          </div>
          <div className="float-card bottom">
            <span className="avatar">
              <Zap size={20} />
            </span>
            <div>
              <strong>Le déclic fait la différence.</strong>
              <small>Jusqu’à 200 points par bonne réponse</small>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="section-title">
          <h2>À chacun son terrain de jeu</h2>
          <span>7 univers. Une infinité de déclics.</span>
        </div>
        <div className="category-grid">
          {categoryNames.map((c, i) => {
            const Icon = icons[i];
            return (
              <Link href="/rooms/create" className="category" key={c}>
                <Icon size={28} strokeWidth={1.4} />
                {c}
              </Link>
            );
          })}
        </div>
      </section>
      <section className="steps" aria-label="Comment jouer">
        {[
          {
            icon: Users,
            title: "Rassemblez votre équipe",
            text: "Créez un salon privé et partagez le code à vos amis.",
          },
          {
            icon: AudioLines,
            title: "Tendez l’oreille",
            text: "Choisissez vos univers et laissez la partie s’enchaîner.",
          },
          {
            icon: Disc3,
            title: "Soyez le premier à trouver",
            text: "Buzzez, donnez votre réponse et grimpez au classement.",
          },
        ].map((s, i) => (
          <div className="step" key={s.title}>
            <span className="step-number">0{i + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
