# Encore — Blindtest Friend

Application française de blind test multijoueur, Next.js App Router et Supabase. Référence fonctionnelle : [cahier des charges V1.2](docs/specification-v1.2.md).

Correction validée après essais utilisateur : **1 à 50 manches**, 20 par défaut, avec proposition de réduction au catalogue disponible. Guide d’alimentation et d’import en masse : [Catalogue](docs/catalogue-import.md).

Projet Supabase de destination : **blindtest**, `lfxqunzxpagpuwsxlatx`, https://lfxqunzxpagpuwsxlatx.supabase.co. Les tests de développement utilisent une **instance locale distincte**. Ne jamais appliquer une commande de remise à zéro à ce projet distant.

## Installation

Node.js 24, npm et Docker pour les tests Supabase locaux.

```sh
npm ci
npx supabase start
node scripts/generate-demo.mjs
npx supabase migration up
```

Importer `supabase/seed.sql` sur la base locale (SQL Editor ou `psql`). Le seed est idempotent. Copier `.env.example` vers `.env.local`, puis renseigner l’URL et les clés de l’instance **locale** retournées par `supabase status`. Ne pas utiliser les clés locales sur le projet hébergé.

```sh
npm run dev
```

Ouvrir http://localhost:3000, créer un compte, enregistrer son profil, créer un salon et inviter un deuxième compte dans un autre navigateur. Activer le son puis cliquer sur « Je suis prêt » sur chaque appareil. Le créateur peut lancer la partie quand le catalogue et la configuration le permettent.

Le catalogue de démonstration contient **56 motifs sonores originaux CC0**, générés par `scripts/generate-demo.mjs`, sans échantillons tiers. Ce sont des sons de test, pas des chansons célèbres. Les sept catégories y servent à tester les filtres ; elles ne décrivent pas une provenance réelle. Leurs noms sont répertoriés dans `public/demo/README.txt`. Un catalogue musical autorisé est nécessaire pour une véritable soirée de reconnaissance musicale.

## Variables

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet utilisé par cette installation |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (ou clé anon locale) |
| `SUPABASE_SECRET_KEY` | Clé secrète / service_role, exclusivement serveur |
| `NEXT_PUBLIC_SITE_URL` | Origine de l’application |
| `ROOM_CAPACITY` | Capacité technique configurable, 32 par défaut ; aucune limite métier à 12 |
| `RECOVERY_SECRET` | Secret aléatoire partagé avec Supabase Vault pour la récupération serveur |

Ne jamais versionner `.env.local`, ni mettre une clé secrète dans une variable `NEXT_PUBLIC_`.

## Administration

Ajouter explicitement l’UUID du compte voulu dans `public.administrators` depuis une connexion administrative :

```sql
insert into public.administrators(user_id) values ('UUID_DU_COMPTE');
```

Le créateur d’un salon ne reçoit jamais ce rôle. `/admin/works` permet l’édition structurée et la prévisualisation ; `/admin/categories` gère les catégories ; `/admin/import` importe un objet ou un tableau JSON, de manière transactionnelle. Le formulaire fournit un exemple du format. Les titres sont uniques sans distinction de casse. Les alias et les catégories sont remplacés atomiquement lors d’une modification. Les parties déjà commencées conservent leur sélection privée.

Téléverser d’abord les fichiers autorisés via l’administration, puis copier les chemins retournés dans le JSON. Les fichiers audio sont privés, servis par URLs signées de 120 secondes. Les images de révélation sont publiques. Limites : audio 20 Mo, image 5 Mo ; sur Vercel, respecter aussi la limite de corps HTTP du plan, voir [déploiement](docs/deployment.md). Le serveur vérifie type, taille et signature de fichier ; les durées et débuts des segments restent à renseigner et vérifier lors de la prévisualisation.

Pour les variantes comme « Mario Galaxy », créer un alias explicite de « Super Mario Galaxy ». Les sous-titres importants peuvent être protégés par `important_words`. Les chiffres des suites restent significatifs.

## Tests et vérifications

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
node scripts/check-database.mjs
node scripts/measure-realtime.mjs
```

Le serveur doit être lancé (`npm run build` puis `npm start` recommandé pour éviter les rechargements de développement) et `.env.local` doit cibler Supabase **local** pour les E2E. Les tests refusent une URL distante. Ils créent puis suppriment leurs comptes et salons. Les scénarios longs avancent uniquement les échéances persistées pour raccourcir l’attente ; scores et réponses passent par les vraies API. Le test audio utilise les vrais préchargements, compte à rebours et lecteurs des navigateurs. Ne pas lancer deux commandes Playwright simultanément avec le même dossier de résultats.

Pour activer la récupération autonome **locale** :

```sh
node scripts/configure-local-recovery.mjs
```

Cette commande crée un secret local aléatoire, le stocke dans `.env.local` et Vault, puis programme les appels toutes les cinq secondes. Elle nécessite `psql` et refuse une configuration distante. Next.js recharge `.env.local` en développement ; redémarrer si nécessaire.

Après la validation initiale, le serveur de test a été arrêté et ses jobs locaux désactivés. Relancer `npm run dev` puis `node scripts/configure-local-recovery.mjs` pour retrouver la progression avec récupération serveur. Les données et migrations locales sont conservées.

Voir [architecture](docs/architecture.md), [déploiement](docs/deployment.md), [règles et limites](docs/game-rules.md) et [rapport par phase](docs/progress.md). Les mesures locales ne constituent pas des garanties de latence Internet.
