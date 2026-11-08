# État de livraison par phase

Référence : cahier des charges 1.2. Le dépôt était vide. Aucun composant préexistant à réutiliser.

| Phase | Réalisations et fichiers principaux | Vérification | Reste / étape suivante |
| --- | --- | --- | --- |
| 1 — Infrastructure | Next.js 16.4.5, React 19.3.1, TS strict, Tailwind, bouton shadcn/Radix, outils de test ; `package.json`, lockfile, `supabase/migrations`, `.env.example` | Installation, typecheck, build de production ; migrations appliquées localement | Appliquer les migrations au projet distant lorsqu’il est accessible |
| 2 — Comptes | Inscription, connexion, déconnexion, réinitialisation, cookies SSR, profil/pseudonyme/avatar ; `src/components/auth-form.tsx`, `profile.tsx`, `src/proxy.ts`, `src/server/supabase.ts` | Connexion de 12 comptes distincts dans Chromium ; accès anonyme refusé | Tester la délivrabilité et les liens e-mail avec le fournisseur de production |
| 3 — Catalogue | Catégories, œuvres, alias, extraits, droits, uploads, aperçu, import JSON atomique ; `src/components/admin.tsx`, `src/app/api/admin`, migrations catalogue | `scripts/check-database.mjs` : import, modification, rollback sur doublon, accès interdits ; 56 motifs originaux générés | Importer un véritable catalogue autorisé ; valider les durées des médias et les limites d’upload en production |
| 4 — Moteur | Phases, préchargement, délais persistés, exclusion, réponse unique, points, révélation ; `src/domain/game.ts`, `answers.ts`, `settings.ts` | 31 tests métier ; audio réel dans deux navigateurs ; réponse incorrecte puis correcte | Calibrer les seuils sur le catalogue musical choisi |
| 5 — Multijoueur | Salons privés, configuration, invitations, prêts, buzz transactionnel, Broadcast privé, snapshot/reconnexion, récupération pg_cron ; `src/server/rooms.ts`, `src/components/room-client.tsx`, `supabase/recovery.sql` | Un seul buzz accepté parmi 12 concurrents ; réception Broadcast réelle ; job local HTTP 200 ; départ du propriétaire testé | Mesures multi-appareils et latences Internet ; activer le job Vault/pg_net sur le déploiement |
| 6 — Équipes / anti-répétition | Contributions individuelles, scores d’équipe, sélection sans doublons, priorité à l’inédit, métadonnées privées ; `src/domain/selection.ts`, historique SQL | Tests de sélection, classement et scénario 50 manches en équipes réussis | Vérification avec le catalogue de production |
| 7 — UX / résultats | Accueil arcade, lobby, audio/volume, clavier, reveal, podium, résultats, historique, mobile ; `src/app`, `src/components`, `src/app/globals.css` | Captures ordinateur/mobile ; absence de débordement à 390 px ; focus réponse et Espace/Entrée testés | Tester Safari/Firefox et appareils mobiles réels ; aucun résultat multi-navigateur annoncé |
| 8 — Livraison | README, règles, architecture, déploiement, tests et catalogue ; `docs`, `tests`, `scripts` | Build/typecheck/tests unitaires réussis ; audit dépendances de production sans vulnérabilité | Publication Vercel et validation distante non effectuées |

## Résultats de vérification

- `npm test` : **31 tests réussis**, dont le rang commun en cas d’égalité complète.
- `npm run typecheck` : réussi.
- `npm run build` : réussi sur le build incluant l’administration et le proxy SSR.
- `npm run lint` : **aucune erreur ni avertissement** après conversion de la navigation interne au routeur Next.js et utilisation de `next/image`.
- `node scripts/check-database.mjs` : réussi. Le test a identifié puis permis de corriger une portée de variable PL/pgSQL dans l’import ; la migration corrective est versionnée.
- Supabase Advisors : **aucun avertissement** après déplacement de l’installation locale de `pg_net` dans `extensions`. Le script de récupération utilise désormais ce schéma. RLS et autorisations applicatives vérifiées.
- E2E audio : lecture réelle sur deux Chromium, préchargement, compte à rebours, buzz clavier, focus, pause, exclusion, refus d’administration, refus de modification par un joueur, transfert de propriété et manche suivante sans le propriétaire : **réussi**.
- **Suite E2E séquentielle : 4 tests réussis en 3,9 minutes** sur le build de production : audio réel/Broadcast/permissions/départ ; accueil/mobile/auth anonyme ; 12 comptes et 10 manches individuelles ; 12 comptes et 50 manches en équipes. Le scénario de 50 manches a pris 2,9 minutes. Les collisions de traces initiales ne se reproduisent pas dans cette exécution séquentielle.
- Après les derniers ajustements de rang, navigation et image : build, ESLint, TypeScript et 31 tests métier réussis ; **2 tests de contrôle audio/mobile réussis en 11,5 secondes** sur le build final.

## Mesures et périmètre

Mesures ponctuelles locales sur le build de production : **6–8 ms** entre `acceptedAt` PostgreSQL et réception Broadcast dans le deuxième navigateur. Lots de 12 requêtes concurrentes : **223 et 238 ms** pour toutes les réponses HTTP ; ces lots ne mesurent pas la réception Broadcast.

`node scripts/measure-realtime.mjs` : **12 clients SDK authentifiés, 5 essais, 60/60 notifications reçues**, médiane **5 ms**, p95 **6 ms**, maximum **49 ms**. Résultats bruts sans secrets : `docs/realtime-load.json`. Cette mesure de transport local ne mesure ni la synchronisation acoustique ni Internet.

Les scénarios longs utilisent 12 contextes navigateur authentifiés et les vraies API. Après les premières interactions et la reconnexion, ils avancent les échéances en base afin de raccourcir les attentes ; ils ne modifient ni résultats ni scores. Cela valide la persistance et les transitions, pas une soirée de 50 manches à vitesse réelle sur 12 ordinateurs.

La synchronisation acoustique sur des appareils distincts et les réseaux lents/instables ne sont pas encore mesurés. Les 12 clients mesurés utilisent une seule machine. La capacité configurable par défaut de 32 n’est pas une capacité certifiée.

## Destination hébergée

Projet demandé : **blindtest / lfxqunzxpagpuwsxlatx**. Les appels du connecteur ont retourné « tool not available » ; la CLI a rencontré une erreur de transport vers `api.supabase.com`. Aucune migration distante n’a été exécutée, aucun secret distant n’a été inventé, aucun déploiement Vercel n’a été publié. Les variables et étapes d’installation sont prêtes.
