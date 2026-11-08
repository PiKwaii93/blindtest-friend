# Architecture et plan

Référence : specification-v1.2.md, conservée sans modification. Dépôt initial vide.

1. Infrastructure : Next.js App Router, TypeScript strict, Tailwind, primitives shadcn, Vitest et Playwright. Migrations Supabase versionnées.
2. Comptes : Supabase Auth, session persistante, profils, autorisation serveur.
3. Catalogue : tables privées, administration réservée aux administrateurs, médias avec droits explicites.
4. Moteur : fonctions pures TypeScript, transitions déterministes, budget audio cumulé.
5. Multijoueur : snapshot privé en base, mutation optimiste transactionnelle avec numéro de version ; un seul gagnant par version. Horloge PostgreSQL, récupération périodique par pg_cron. Broadcast privé comme notification d'invalidation et snapshot après reconnexion.
6. Équipes et sélection : exclusion individuelle, contributions, priorité aux œuvres inédites.
7. Interface : français, sombre, clavier, responsive et réduction des animations.
8. Vérification : tests métier, tests PostgreSQL et navigateurs, build, documentation et état honnête des vérifications.

## Frontières

`src/domain` ne dépend ni de React ni de Supabase. `src/server` charge les données privées, applique les règles et publie exclusivement une projection publique. Les routes authentifient chaque demande. Aucun titre ni alias ni identifiant d'œuvre dans le snapshot avant révélation. Les fichiers audio sont servis par URL signée à durée limitée ; ils restent inspectables par le navigateur.

Une transaction compare la version et l'échéance avant de remplacer l'état : les réponses calculées sur un état obsolète sont rejetées et recalculées. Les mutations utilisent l'heure PostgreSQL. Un job PostgreSQL signale les échéances ; la récupération serveur doit être déployée et validée avant de considérer la progression autonome opérationnelle.

## Références vérifiées le 8 novembre 2026

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/realtime/broadcast
- Versions npm vérifiées avec le magasin de certificats système. Versions exactes et lockfile à conserver.

Pas de nouveau service externe prévu. Supabase Cron fait partie de Supabase. Ne jamais faire d'un timer de fonction Vercel la source de vérité.
