# Corrections demandées après essai local

L’architecture et les médias synthétiques existants sont conservés. Aucune opération distante Supabase ou Vercel n’est incluse dans cette étape.

- Nombre de manches : 1–50 validé par Zod côté serveur et par l’interface, 20 par défaut. Le bouton de réduction propose exactement le nombre d’œuvres distinctes éligibles ; il n’apparaît pas quand aucune œuvre n’est disponible. L’utilisateur enregistre ensuite les règles. La sélection sans doublons reste inchangée.
- Salon : message sur les coéquipiers uniquement en équipes ; validation complète avant enregistrement ; liste explicite des blocages (filtres vides, paramètres invalides, règles non enregistrées, joueurs non prêts, équipes incomplètes, catalogue insuffisant). Les tests vérifient l’enregistrement effectif d’une puis de deux catégories en base, sans utiliser « Tout sélectionner ».
- Révélation : composant réutilisable affichant l’image de l’œuvre et une illustration locale en cas d’image absente ou d’erreur de chargement. L’état d’erreur est réinitialisé par changement d’œuvre/image.
- Administration : téléversement de plusieurs médias séquentiellement, avec correspondance nom d’origine → chemin/URL conservée à l’écran. L’import JSON existant conserve sa transaction, sa limite de 100 œuvres par lot et tous les champs métier. Guide : `docs/catalogue-import.md`.

Fichiers principaux : `src/domain/settings.ts`, `src/components/room-client.tsx`, `src/components/reveal-image.tsx`, `public/reveal-placeholder.svg`, `src/components/admin.tsx`, `tests/domain.test.ts`, `tests/e2e/game.spec.ts`, `tests/e2e/catalogue.spec.ts`, `playwright.config.ts` et documentation.

Validation : 40 tests métier réussis ; TypeScript, ESLint et build réussis ; contrôles d’accès et import transactionnel PostgreSQL réussis. Le test navigateur d’administration réussit : téléversement WAV + PNG, import d’un tableau de deux œuvres, puis vérification des alias, des deux catégories, des deux difficultés et de l’URL d’image. Aucun fichier de démonstration ni catalogue distant n’est modifié.

Résultat navigateur final : **6 tests réussis** (5 scénarios de jeu en 3,4 minutes, plus le scénario d’administration en 2,8 secondes). Les parties existantes de 10 manches individuelles et 50 manches en équipes, avec 12 comptes, passent ; les nouveaux tests couvrent une manche, le choix d’une/de plusieurs catégories, la réduction proposée, les blocages affichés et les illustrations valide/absente/inaccessible. Les délais des scénarios longs restent accélérés selon le mécanisme de test déjà présent.
