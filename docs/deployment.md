# Déploiement Vercel et Supabase

## Destination

Projet existant **blindtest** : `lfxqunzxpagpuwsxlatx`. L’URL figure dans `.env.example`. Aucun secret distant n’est inclus. Le connecteur Supabase n’était pas utilisable pendant le développement initial ; les migrations ont été validées sur Supabase local.

1. Vérifier les tables et migrations existantes de la destination avant application ; ne pas écraser une installation différente. Appliquer dans l’ordre les fichiers de `supabase/migrations` avec le connecteur ou la CLI authentifiée (`supabase migration up --remote=lfxqunzxpagpuwsxlatx`, après vérification de `--help` sur la version installée).
2. Importer éventuellement `supabase/seed.sql` pour la démonstration. Les audios correspondants se trouvent dans `public/demo`. Pour un catalogue réel, utiliser l’interface d’administration et les buckets créés par les migrations.
3. Connecter ce dépôt à un projet Vercel, preset Next.js, commande `npm run build`, Node.js 24. Configurer les variables de `.env.example` pour chaque environnement. Utiliser un projet Supabase de développement distinct pour les previews modifiant des données.
4. Configurer dans Supabase Auth la Site URL et les Redirect URLs exactes : `https://VOTRE-DOMAINE/auth/callback` et `https://VOTRE-DOMAINE/auth/callback?next=/password`. Configurer le service e-mail et la vérification selon les besoins.
5. Ajouter l’administrateur voulu à `public.administrators` ; son pseudonyme ou ses métadonnées utilisateur ne donnent aucun privilège.
6. Désactiver les canaux Realtime publics dans les réglages Realtime. Les clients utilisent des canaux privés `room:<uuid>`, autorisés par RLS. Les événements ne contiennent qu’un identifiant et une version ; les clients récupèrent ensuite un snapshot autorisé.

## Progression persistante

Les navigateurs demandent une transition à échéance, mais ne sont pas le seul mécanisme. Le job Supabase Cron appelle `/api/recover` toutes les 5 secondes via pg_net. La fonction récupère jusqu’à 100 salons expirés, applique la transition métier et la valide par comparaison atomique de version. Plusieurs appels concurrents ne peuvent attribuer deux résultats.

Avant d’exécuter `supabase/recovery.sql`, créer dans **Supabase Vault**, via son interface sécurisée :

- `blindtest_recovery_url` : `https://VOTRE-DOMAINE/api/recover` ;
- `blindtest_recovery_secret` : même secret aléatoire que `RECOVERY_SECRET` dans Vercel.

Le secret ne doit pas être écrit dans un fichier SQL versionné ou une ligne de commande partagée. Exécuter ensuite `supabase/recovery.sql`. Vérifier `cron.job_run_details` et les codes HTTP de `net._http_response`. Une réponse 401 indique une configuration du secret incorrecte. Un déploiement protégé doit autoriser ces appels serveur de manière explicite.

Sans ce job, les transitions fonctionnent avec des clients connectés, mais la récupération sans navigateur n’est **pas** opérationnelle. Sans client capable de précharger la manche suivante, la préparation expire et la partie se termine avec une erreur explicite.

## Contrôles après déploiement

- Migration list et Supabase Advisors ; RLS sur toutes les tables exposées.
- Inscription, e-mail, session renouvelée, réinitialisation, profil et déconnexion.
- Deux appareils réels, puis au moins 12 clients : état, audio, buzz, erreurs, scores, reconnexion.
- Appels du job sans navigateur actif ; contrôle des échéances et de l’archivage.
- Vérifier la latence réelle entre région Vercel et région Supabase avant d’annoncer un objectif de synchronisation.

## Limites de transfert

Le Route Handler d’upload accepte 20 Mo pour l’audio et 5 Mo pour les images. La plateforme peut imposer une limite HTTP inférieure : pour les fichiers dépassant cette limite, utiliser des fichiers compressés plus petits ou un import administratif direct dans Supabase Storage. L’upload direct signé avec reprise n’est pas implémenté. Ne pas annoncer que les téléversements de 20 Mo sont validés sur Vercel tant que ce chemin n’y a pas été testé.

## Commandes de validation

`npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Ne pas lancer `supabase db reset` sur la destination hébergée. Aucun déploiement public ou changement distant n’est implicite dans une commande de test local.
