# BLIND TEST — CAHIER DES CHARGES TECHNIQUE ET FONCTIONNEL

**Version :** 1.2 — Spécification V1 validée  
**Statut :** Prêt pour implémentation  
**Déploiement :** Vercel  
**Base de données :** Supabase PostgreSQL  
**Application :** Web, multijoueur, responsive  
**Langue principale :** Français

---

# 1. Présentation du projet

Développer une application web de blind test musical multijoueur.

Chaque utilisateur dispose d'un compte personnel, peut créer un salon, inviter des amis, configurer les règles et participer lui-même à la partie.

Chaque joueur utilise principalement son ordinateur. Tous les participants voient le même état de partie et entendent le même extrait musical sur leur propre appareil.

Le principe est de reconnaître une œuvre à partir d'un extrait audio, de buzzer avant les autres et de saisir une réponse.

Une fois la partie lancée, le jeu s'exécute automatiquement : lecture, buzzer, validation, révélation, classement et manche suivante.

Aucun animateur ni écran central n'est nécessaire.

## Objectifs prioritaires

- Simplicité d'utilisation.
- Interface moderne et immersive.
- Synchronisation multijoueur fiable.
- Buzzer rapide et équitable.
- Validation intelligente des réponses.
- Gestion extensible des œuvres et catégories.
- Parties entièrement automatisées.
- Expérience fluide sur ordinateur.
- Code maintenable, testé et sécurisé.

# 2. Stack technique

## Frontend

- Next.js avec App Router.
- React et TypeScript strict.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- Motion pour les animations.
- Web Audio API / HTMLAudioElement selon le besoin.

## Backend

- Next.js Route Handlers.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Realtime Broadcast.
- Supabase Storage.
- Zod pour valider les entrées.

## Hébergement

- Vercel pour l'application web et les fonctions serveur.
- Supabase pour les données, l'authentification et le temps réel.
- GitHub pour le versionnement et les déploiements.

Les fonctions Vercel sont sans état persistant. Ne pas utiliser un timer JavaScript en mémoire d'une fonction serveur comme unique mécanisme de progression des parties.

Implémenter une progression à échéances persistées, avec transitions atomiques, planification côté client et mécanisme serveur de récupération des transitions expirées.

Si des composants supplémentaires sont nécessaires, documenter le besoin avant leur introduction.

## Qualité

- ESLint.
- Prettier.
- Vitest.
- Playwright.
- Tests des règles métier.
- Migrations SQL versionnées.
- Fichier `.env.example`.
- README documenté.

# 3. Comptes utilisateurs

L'inscription est nécessaire pour participer aux parties multijoueurs.

## Authentification

Fonctionnalités :

- Inscription par e-mail.
- Connexion.
- Déconnexion.
- Réinitialisation du mot de passe.
- Vérification de l'e-mail si activée.
- Sessions persistantes.
- Gestion des erreurs.

Prévoir une architecture permettant d'ajouter Google OAuth ultérieurement.

## Profil

Chaque utilisateur possède :

- Un identifiant unique.
- Un pseudonyme unique, modifiable.
- Un avatar.
- Une date de création.
- Des statistiques.
- Un historique de parties.

Le profil peut afficher :

- Nombre de parties.
- Nombre de victoires.
- Nombre de bonnes réponses.
- Pourcentage de réussite.
- Temps moyen de buzz.
- Meilleur score.
- Catégories les plus jouées.

## Permissions

Distinguer :

- Utilisateur standard.
- Créateur d'un salon.
- Administrateur global.

Le créateur d'un salon ne devient pas administrateur global.

# 4. Création et gestion des salons

N'importe quel utilisateur connecté peut créer un salon.

## Création

Lorsqu'un salon est créé, générer :

- Un identifiant UUID.
- Un code d'invitation court.
- Un lien de partage.
- Une configuration initiale.
- Un propriétaire.

Le salon est privé par défaut : il est accessible avec un lien ou un code, sans apparaître dans un annuaire public.

## Lobby

Afficher :

- Nom du salon.
- Code d'invitation.
- Bouton de copie du lien.
- Liste des joueurs.
- Avatars et pseudonymes.
- Statut prêt / non prêt.
- Paramètres de la partie.
- Bouton pour quitter le salon.

Le propriétaire voit également :

- Modifier les paramètres.
- Exclure un joueur.
- Lancer la partie.

Le propriétaire est lui-même un participant et joue exactement dans les mêmes conditions que les autres.

## Nombre de participants

Le nombre de participants est variable.

Ne pas imposer de limite métier fixe à 12 joueurs.

Prévoir une capacité configurable et des protections techniques contre la surcharge.

La version initiale doit être testée avec au moins 12 participants simultanés, sans garantir une capacité illimitée.

## Conditions de lancement

- Au moins un joueur pour une partie individuelle.
- Au moins deux équipes non vides pour une partie en équipes.
- Tous les participants doivent avoir chargé l'interface et être prêts.
- Au moins une catégorie sélectionnée.
- Au moins une difficulté sélectionnée.
- Nombre suffisant d'œuvres éligibles.
- Médias disponibles et utilisables.

## Gestion du propriétaire

Le propriétaire peut modifier les paramètres avant la partie.

Pendant une partie, il ne possède aucun privilège de jeu.

Il peut quitter sans bloquer la progression automatique.

Prévoir un transfert de propriété automatique en cas de départ définitif.

# 5. Paramètres de partie

Tous les paramètres sont configurables depuis le lobby avant le lancement.

## 5.1 Catégories

Catégories initiales :

1. Jeux vidéo.
2. Films.
3. Séries.
4. Dessins animés.
5. Animés japonais.
6. Musiques populaires.
7. Génériques TV.

Permettre une sélection multiple.

Toutes les catégories sont sélectionnées par défaut.

L'utilisateur peut :

- Sélectionner une catégorie.
- Sélectionner plusieurs catégories.
- Tout sélectionner.
- Tout désélectionner.

Empêcher le lancement si aucune catégorie n'est sélectionnée.

Les catégories sont dynamiques en base de données.

Afficher le nombre d'œuvres disponibles par catégorie, en tenant compte des difficultés et autres filtres.

## 5.2 Nombre de manches

Le nombre de manches est réglable de **10 à 50 inclus**.

Valeur par défaut : **20 manches**.

Utiliser un slider ou un champ numérique adapté.

Valider cette contrainte côté serveur.

Si le catalogue ne permet pas de constituer une partie de cette durée avec les filtres sélectionnés, signaler clairement le problème et désactiver le lancement.

Une œuvre ne doit jamais apparaître deux fois dans la même partie.

## 5.3 Difficultés

Les trois difficultés sont sélectionnables indépendamment :

**Facile**
- Passages emblématiques.
- Refrains connus.
- Extraits facilement reconnaissables.

**Normal**
- Extraits variés.
- Passages moins immédiatement identifiables.
- Sélection possible entre plusieurs segments préparés.

**Difficile**
- Passages moins reconnaissables.
- Introductions, transitions ou passages secondaires.
- Reconnaissance plus exigeante.

L'utilisateur peut sélectionner :

- Facile uniquement.
- Normal uniquement.
- Difficile uniquement.
- Toute combinaison de deux difficultés.
- Les trois difficultés simultanément.

**Par défaut, les trois difficultés sont sélectionnées.**

Empêcher de lancer la partie si aucune difficulté n'est cochée.

Lorsqu'une partie comporte plusieurs difficultés, sélectionner aléatoirement parmi les extraits éligibles.

Privilégier une répartition équilibrée lorsque le catalogue le permet, sans garantir une répartition impossible.

Une même œuvre peut disposer de plusieurs extraits associés à différentes difficultés.

La difficulté sélectionnée ne doit pas être communiquée au joueur si elle révèle une information non souhaitée.

## 5.4 Durée d'écoute

Valeur par défaut : **10 secondes**.

Prévoir une configuration de 5 à 30 secondes.

Il s'agit du temps total d'écoute cumulé d'une manche, pas du temps écoulé sur l'horloge réelle.

La musique est mise en pause lors d'un buzz accepté.

Le temps de saisie d'une réponse ne consomme pas le temps d'écoute restant.

## 5.5 Temps de réponse

Valeur par défaut : **10 secondes**.

Prévoir une configuration de 5 à 30 secondes.

Le délai démarre à l'acceptation serveur du buzz.

Le serveur rejette les réponses arrivées après l'échéance.

## 5.6 Mauvaise réponse

Règle V1 obligatoire :

**Le joueur ayant fourni une mauvaise réponse est exclu de la manche en cours.**

Il ne peut plus buzzer pour cette œuvre.

La musique reprend pour les autres participants, si du temps d'écoute reste.

Aucune option de nouvelle tentative après une mauvaise réponse ne doit être proposée dans la V1.

## 5.7 Mode de jeu

Deux modes obligatoires :

- Individuel.
- Équipes.

Le mode est choisi par le créateur dans le lobby.

Le mode individuel est sélectionné par défaut.

# 6. Déroulement automatique

Chaque manche suit une machine à états explicite.

États principaux :

`LOBBY → COUNTDOWN → PLAYING → ANSWERING → REVEAL → NEXT_ROUND → FINISHED`

## 6.1 Préparation

Avant chaque manche :

- Sélectionner une œuvre éligible.
- Sélectionner un extrait correspondant aux difficultés autorisées.
- Préparer le média.
- Synchroniser les participants.
- Afficher un compte à rebours de trois secondes.

Ne pas démarrer l'écoute tant que la stratégie de préchargement et de synchronisation définie n'est pas satisfaite.

Prévoir un timeout de préparation et une gestion des joueurs dont l'audio ne fonctionne pas.

## 6.2 Lecture

Tous les participants reçoivent une instruction de lecture synchronisée à une échéance serveur.

Afficher :

- Numéro de manche.
- Temps d'écoute restant.
- Buzzer.
- Participants.
- Scores.

L'audio est lu sur chaque ordinateur.

Le navigateur doit être initialisé pour permettre la lecture audio, notamment après une interaction volontaire.

## 6.3 Buzzer

Le bouton BUZZ est visible et activable pendant la lecture.

Raccourci : touche Espace, sauf lorsqu'un champ de texte est actif.

À l'acceptation d'un buzz :

1. Verrouiller la tentative côté serveur.
2. Identifier le premier joueur accepté.
3. Calculer le temps d'écoute consommé.
4. Mettre le lecteur en pause sur tous les clients.
5. Désactiver les autres buzzers.
6. Afficher le joueur qui répond.
7. Lancer le délai de saisie.

Le premier buzz accepté par le serveur gagne.

Les opérations concurrentes doivent être atomiques.

Un joueur déjà exclu ne peut pas buzzer à nouveau.

## 6.4 Réponse

Le joueur dispose d'un champ de saisie et d'un bouton Valider.

Le champ reçoit automatiquement le focus.

La touche Entrée valide la proposition.

**Une seule réponse peut être soumise par buzz.**

Aucune indication de similarité, d'orthographe ou de validité n'est affichée avant l'envoi définitif.

Dès la soumission :
- Désactiver le champ.
- Enregistrer la réponse.
- Effectuer la validation côté serveur.

Un dépassement du délai équivaut à une mauvaise réponse.

## 6.5 Réponse correcte

- Marquer la réponse comme correcte.
- Calculer les points.
- Ajouter les points au joueur ou à son équipe.
- Terminer l'écoute.
- Passer à la révélation.

## 6.6 Réponse incorrecte

- Marquer la réponse comme incorrecte.
- Attribuer zéro point.
- Exclure le joueur de la manche.
- Réactiver les buzzers des autres participants.
- Reprendre l'écoute avec le temps restant.

Le joueur exclu continue à voir le déroulement de la partie.

Si tous les joueurs sont exclus, passer directement à la révélation.

## 6.7 Fin de lecture

Lorsque le temps d'écoute cumulé atteint la limite configurée :

- Arrêter la musique.
- Refuser les nouveaux buzzers.
- Passer à la révélation si aucune réponse n'est en cours.

Si un buzz valide a été accepté juste avant l'expiration, laisser la tentative de réponse aller jusqu'à son échéance.

## 6.8 Révélation

Afficher simultanément sur tous les clients :

- Image de l'œuvre.
- Titre officiel.
- Catégorie.
- Éventuels alias pertinents.
- Joueur ayant trouvé.
- Points attribués.
- Classement actualisé.

Durée indicative : cinq secondes.

Transition automatique vers la manche suivante.

## 6.9 Fin de partie

Après la dernière manche :

- Afficher le classement final.
- Afficher un podium.
- Afficher les statistiques.
- Permettre de retourner au lobby.
- Permettre au propriétaire de configurer une nouvelle partie.
- Conserver l'historique.

Les transitions doivent fonctionner sans intervention manuelle.

# 7. Validation intelligente des réponses

L'objectif est d'accepter les variantes légitimes et les fautes mineures sans confondre deux œuvres différentes.

## 7.1 Normalisation

Avant comparaison :

- Conversion en minuscules.
- Suppression des accents.
- Normalisation Unicode.
- Suppression des espaces superflus.
- Uniformisation de la ponctuation.
- Normalisation des apostrophes et tirets.
- Gestion contrôlée des articles.
- Gestion contrôlée des chiffres romains et arabes.

## 7.2 Alias

Chaque œuvre dispose d'une liste de réponses acceptées.

Exemples :

- « Pokémon » / « Pokemon ».
- « Le Roi Lion » / « Roi Lion ».
- « The Legend of Zelda » / « Legend of Zelda ».
- « Dragon Ball Z » / « DBZ » si l'alias est enregistré.
- « Pokémon » / « Opening Pokémon » si l'alias est enregistré.

Les alias doivent être administrables.

## 7.3 Similarité

Implémenter un algorithme déterministe combinant :

- Correspondance exacte normalisée.
- Alias.
- Distance de Levenshtein normalisée.
- Similarité de tokens.
- Vérification des mots importants.

Seuils initiaux :

- Facile : 0,75.
- Normal : 0,82.
- Difficile : 0,90.

Les seuils doivent être calibrés avec des tests et ne pas être considérés comme une garantie absolue de justesse.

Le moteur doit protéger les distinctions importantes entre franchises et suites.

Exemples :

- « Pokemon » pour « Pokémon » : accepté.
- « Hary Poter » pour « Harry Potter » : accepté.
- « Mario Galaxy » pour « Super Mario Galaxy » : accepté.
- « Super Mario Odyssey » pour « Super Mario Galaxy » : refusé.
- « Naruto » pour « Naruto Shippuden » : refusé par défaut.

## 7.4 Protection contre les essais multiples

Une réponse est définitive après soumission.

Le serveur n'autorise qu'une soumission valide par tentative de buzz.

Ne pas exposer une API de validation accessible permettant d'essayer librement plusieurs titres pour une manche active.

# 8. Points et classement

## 8.1 Barème

Une bonne réponse donne :

- 100 points de base.
- Jusqu'à 100 points bonus de rapidité.

Formule :

`points = 100 + floor(100 × temps_restant_au_buzz / durée_totale_écoute)`

Le résultat est borné entre 100 et 200.

Le temps utilisé est calculé côté serveur à partir du buzz accepté.

Une réponse incorrecte rapporte zéro point.

## 8.2 Classement individuel

Classement par score décroissant.

Départage :

1. Score total.
2. Nombre de bonnes réponses.
3. Rapidité cumulée des buzzs gagnants.
4. Égalité si les indicateurs restent identiques.

## 8.3 Mode équipes

Chaque joueur possède son propre buzzer.

Les joueurs d'une même équipe peuvent buzzer individuellement.

Lorsqu'un membre trouve :
- L'équipe reçoit les points.
- La contribution individuelle du membre est enregistrée.

Lorsqu'un membre se trompe :
- Il est exclu individuellement de la manche.
- Ses coéquipiers peuvent encore buzzer.

Le classement principal est celui des équipes.

Afficher également les contributions individuelles.

# 9. Anti-répétition

Ne jamais sélectionner deux fois la même œuvre dans une partie, même si plusieurs extraits existent.

Conserver les œuvres rencontrées par chaque utilisateur.

Au démarrage d'une nouvelle partie :

1. Identifier les œuvres disponibles.
2. Appliquer les catégories.
3. Appliquer les difficultés.
4. Exclure les œuvres déjà prévues pour cette partie.
5. Privilégier les œuvres inédites pour les participants.
6. Réduire la probabilité des œuvres récemment rencontrées.
7. Compléter avec des œuvres plus anciennes lorsque nécessaire.

Ne pas bloquer systématiquement une partie si certains joueurs ont déjà rencontré toutes les œuvres.

Un même morceau peut donc revenir à long terme, mais les répétitions récentes doivent être limitées.

L'algorithme doit être testable et expliquer ses choix via des métadonnées de sélection internes.

# 10. Catalogue musical

Le catalogue est organisé autour des œuvres et de leurs extraits.

Une œuvre comprend :

- Identifiant.
- Titre officiel.
- Titres alternatifs.
- Catégories.
- Image de révélation.
- Année de sortie facultative.
- Métadonnées descriptives.
- Statut actif.
- Sources et informations de droits.

Une œuvre possède un ou plusieurs extraits.

Chaque extrait comprend :

- Identifiant.
- Œuvre parente.
- Fichier audio.
- Difficulté.
- Position de début.
- Durée exploitable.
- Métadonnées techniques.
- Statut actif.

## Administration des extraits

L'administrateur peut :

- Ajouter une œuvre.
- Modifier une œuvre.
- Ajouter des alias.
- Associer plusieurs catégories.
- Télécharger une image.
- Ajouter plusieurs extraits.
- Définir la difficulté des extraits.
- Prévisualiser les médias.
- Activer ou désactiver un extrait.
- Importer des données CSV ou JSON.
- Détecter les doublons.

## Droits et licences

Ne pas supposer que les musiques de jeux vidéo, films, séries ou plateformes de streaming sont librement réutilisables.

Utiliser uniquement des contenus pour lesquels les droits nécessaires sont obtenus.

Le catalogue de démonstration doit utiliser des médias autorisés.

Ne pas mettre en place de téléchargement ou de contournement non autorisé depuis les plateformes musicales.

# 11. Synchronisation multijoueur

Le serveur est la source de vérité.

Il contrôle :

- État des parties.
- Transitions.
- Échéances.
- Attribution des buzzs.
- Validation des réponses.
- Exclusion des manches.
- Calcul des points.
- Classements.

Supabase Realtime diffuse les événements vers les clients.

## Événements

Prévoir notamment :

- ROOM_UPDATED.
- PLAYER_JOINED.
- PLAYER_LEFT.
- PLAYER_READY.
- GAME_STARTED.
- ROUND_PREPARING.
- ROUND_STARTED.
- BUZZ_ACCEPTED.
- ANSWER_SUBMITTED.
- ANSWER_RESULT.
- PLAYBACK_RESUMED.
- ROUND_REVEALED.
- SCORE_UPDATED.
- GAME_FINISHED.

Chaque événement contient un identifiant, un numéro de version d'état et les informations strictement nécessaires.

Les clients doivent pouvoir récupérer un snapshot d'état après reconnexion ou perte d'événements.

## Synchronisation audio

Tous les clients lisent la musique localement.

Prévoir :
- Préchargement.
- Commande de démarrage basée sur une échéance serveur.
- Estimation du décalage des horloges.
- Correction raisonnable des dérives.
- Pause et reprise coordonnées.

Une synchronisation audio parfaitement identique à la milliseconde sur tous les navigateurs n'est pas garantie.

Documenter les limites mesurées et tester sous différentes latences.

## Transitions atomiques

Utiliser des opérations transactionnelles pour :

- Accepter un buzz.
- Verrouiller une réponse.
- Enregistrer un résultat.
- Attribuer les points.
- Avancer la manche.

Les opérations doivent être idempotentes.

## Gestion des délais

Les échéances doivent être persistées et calculées à partir de l'horloge serveur.

Ne pas dépendre uniquement de timers présents dans les navigateurs.

Prévoir la reprise après erreur, déconnexion ou arrêt d'une fonction serveur.

# 12. Architecture de données

Tables minimales :

**profiles**
- id
- username
- avatar_url
- created_at

**categories**
- id
- name
- slug
- is_active

**works**
- id
- title
- image_path
- release_year
- is_active
- created_at

**work_aliases**
- id
- work_id
- alias
- normalized_alias

**work_categories**
- work_id
- category_id

**audio_clips**
- id
- work_id
- audio_path
- difficulty
- start_ms
- usable_duration_ms
- is_active
- rights_status

**rooms**
- id
- code
- owner_id
- status
- settings
- created_at

**room_members**
- id
- room_id
- user_id
- team_id
- ready_status
- joined_at

**teams**
- id
- room_id
- name
- color

**games**
- id
- room_id
- mode
- status
- current_round
- total_rounds
- started_at
- ended_at

**game_players**
- id
- game_id
- user_id
- team_id
- score

**rounds**
- id
- game_id
- work_id
- clip_id
- number
- status
- consumed_audio_ms
- phase_started_at
- deadline_at
- winner_id

**buzz_attempts**
- id
- round_id
- user_id
- accepted_at
- answer_deadline_at
- answer
- result
- points

**user_work_history**
- user_id
- work_id
- last_played_at
- play_count

**game_events**
- id
- game_id
- round_id
- sequence_number
- event_type
- payload
- created_at

Adapter le schéma si nécessaire pour garantir la cohérence, l'intégrité et les performances.

Ajouter les contraintes, index et clés étrangères appropriés.

Les informations privées concernant la bonne réponse ne doivent pas être accessibles aux joueurs avant la révélation.

# 13. Sécurité

- Supabase Auth pour les comptes.
- RLS sur les tables exposées.
- Canaux Realtime privés et autorisés.
- Vérification des permissions côté serveur.
- Protection des routes administrateur.
- Variables secrètes uniquement côté serveur.
- Validation Zod.
- Rate limiting.
- Protection des opérations critiques contre les doublons.
- Journalisation sécurisée.
- Vérification des uploads.
- Nettoyage des salons abandonnés.
- Protection des réponses officielles avant révélation.

Les joueurs ne doivent pas pouvoir modifier directement leurs scores ou les résultats.

Le propriétaire d'un salon ne peut pas s'attribuer arbitrairement des points.

Préciser que les médias devant être lus sur le navigateur ne peuvent pas être protégés absolument contre leur inspection. Mettre en place une protection raisonnable, sans promettre un système anti-triche inviolable.

# 14. Design et ergonomie

Créer un design moderne inspiré des jeux multijoueurs et de l'univers arcade.

## Direction visuelle

- Thème sombre.
- Violet et bleu électrique.
- Accents lumineux.
- Cartes arrondies.
- Animations soignées.
- Interface lisible.
- Effets visuels non excessifs.

## Accueil

Afficher :

- Bouton « Jouer ».
- Bouton « Créer un salon ».
- Bouton « Rejoindre un salon ».
- Accès au profil.
- Historique.
- Paramètres.

## Lobby

Afficher clairement :

- Joueurs connectés.
- Configuration.
- Catégories.
- Difficultés.
- Nombre de manches.
- Mode individuel / équipes.
- Bouton prêt.
- Bouton de lancement pour le propriétaire.

## Partie

Afficher :

- Numéro de manche.
- Timer central.
- Buzzer très visible.
- Classement.
- Joueurs.
- Statut de la manche.
- Champ de réponse lorsque le joueur a buzzé.

## Révélation

- Image centrale.
- Nom de l'œuvre.
- Joueur gagnant.
- Points.
- Animation de transition.

## Fin de partie

- Podium.
- Classement.
- Statistiques individuelles.
- Statistiques d'équipes.
- Bouton rejouer.
- Retour au lobby.

## Accessibilité

- Navigation clavier.
- Support des lecteurs d'écran lorsque pertinent.
- Contrastes suffisants.
- Respect du mode réduction des animations.
- Interface utilisable sur mobile.
- Contrôle du volume.

L'expérience est conçue en priorité pour ordinateur.

# 15. Pages

Créer au minimum :

- `/` — Accueil.
- `/login` — Connexion.
- `/register` — Inscription.
- `/profile` — Profil.
- `/profile/history` — Historique.
- `/rooms/create` — Création.
- `/rooms/[code]` — Lobby.
- `/games/[id]` — Partie.
- `/games/[id]/results` — Résultats.
- `/admin` — Administration.
- `/admin/works` — Œuvres.
- `/admin/categories` — Catégories.
- `/admin/import` — Import de contenu.

Prévoir les états de chargement, les pages introuvables et les écrans d'erreur.

# 16. Fonctionnalités exclues de la V1

Ne pas développer :

- Mode animateur.
- Écran central obligatoire.
- Interface de projection séparée.
- Manches double points.
- Mort subite.
- Indices progressifs.
- Intervention humaine pour passer les manches.
- Arbitrage manuel des réponses.
- Chat vocal intégré.
- Microtransactions.
- Paiements.
- Intelligence artificielle obligatoire pour valider les réponses.

Ne pas ajouter ces fonctions sans nouvelle validation du cahier des charges.

# 17. Tests obligatoires

## Tests unitaires

- Normalisation.
- Alias.
- Similarité.
- Faux positifs.
- Calcul des points.
- Bornes des paramètres.
- Machine à états.
- Exclusion après mauvaise réponse.
- Anti-répétition.
- Calcul du temps d'écoute cumulé.

## Tests d'intégration

- Authentification.
- Création de salon.
- Invitation.
- Paramètres.
- Équipes.
- Préchargement audio.
- Buzz concurrent.
- Validation de réponse.
- Transitions automatiques.
- Déconnexions.
- Scores.

## Tests E2E

Simuler plusieurs navigateurs.

Vérifier :

- Partie complète.
- Buzzs simultanés.
- Mauvaise réponse suivie d'une nouvelle tentative par un autre joueur.
- Bonne réponse.
- Timer expiré.
- Reconnexion.
- Score final.
- Partie en équipes.
- Choix combinés de catégories et de difficultés.
- Partie de 10 et de 50 manches.

## Performance

Mesurer le délai entre l'acceptation serveur d'un buzz et sa réception par les autres participants.

Tester avec au moins 12 participants simulés ou réels.

Documenter les mesures et les limites observées, sans annoncer de garantie de latence impossible à tenir sur Internet.

# 18. Critères d'acceptation V1

L'application est considérée comme terminée lorsque :

1. Un utilisateur peut créer un compte.
2. Il peut créer et gérer un salon.
3. Ses amis peuvent rejoindre le salon.
4. Il peut sélectionner une ou plusieurs des sept catégories.
5. Il peut définir entre 10 et 50 manches.
6. Il peut sélectionner une, deux ou trois difficultés.
7. Il peut choisir individuel ou équipes.
8. Tous les participants voient les mêmes états.
9. La musique est lue avec un budget d'écoute cumulé de 10 secondes par défaut.
10. Le premier buzzer accepté obtient la priorité.
11. Le joueur dispose de 10 secondes pour répondre.
12. Une seule proposition est acceptée par buzz.
13. Les alias et fautes raisonnables sont tolérés.
14. Une erreur exclut le joueur de la manche.
15. Les autres participants peuvent continuer.
16. Les points tiennent compte de la rapidité.
17. Le mode équipes attribue les points collectivement.
18. Les morceaux ne se répètent pas dans une partie.
19. Le système limite les répétitions entre parties.
20. Les révélations et transitions s'enchaînent automatiquement.
21. Un classement final est affiché.
22. Le catalogue est administrable.
23. Les contrôles de sécurité sont appliqués.
24. Les tests critiques réussissent.
25. L'application est déployable sur Vercel.

# 19. Plan d'implémentation pour Codex

Respecter l'ordre suivant.

## Phase 1 — Projet et infrastructure

- Initialiser Next.js.
- Configurer TypeScript et Tailwind.
- Installer shadcn/ui.
- Configurer Supabase.
- Créer les migrations.
- Configurer l'environnement.
- Mettre en place les tests.

## Phase 2 — Comptes et profils

- Authentification.
- Profils.
- Avatars.
- Permissions.
- Sessions.

## Phase 3 — Catalogue

- Catégories.
- Œuvres.
- Extraits.
- Alias.
- Administration.
- Import.
- Médias de démonstration autorisés.

## Phase 4 — Moteur de jeu

- Machine à états.
- Timers.
- Lecteur audio.
- Buzzers.
- Validation.
- Scores.
- Révélation.
- Progression automatique.

## Phase 5 — Multijoueur

- Salons.
- Lobby.
- Présence.
- Événements Realtime.
- Synchronisation.
- Reconnexion.
- Arbitrage concurrent.

## Phase 6 — Équipes et anti-répétition

- Gestion des équipes.
- Scores collectifs.
- Historique des œuvres.
- Sélection pondérée.

## Phase 7 — UX et résultats

- Design.
- Animations.
- Podium.
- Statistiques.
- Responsive.
- Accessibilité.

## Phase 8 — Validation et livraison

- Tests.
- Vérifications de sécurité.
- Optimisation.
- Documentation.
- Build de production.
- Configuration Vercel.

# 20. Instructions impératives à Codex

Ce document constitue la référence fonctionnelle.

Ne pas modifier silencieusement les règles validées.

Avant tout développement :

1. Examiner le dépôt existant.
2. Identifier les éléments réutilisables.
3. Définir une architecture maintenable.
4. Vérifier les versions et documentations actuelles.
5. Établir le plan de développement.

Pendant le développement :

- Privilégier le fonctionnement réel aux maquettes.
- Développer en TypeScript strict.
- Séparer les couches UI, métier, persistance et réseau.
- Écrire des composants réutilisables.
- Implémenter les contrôles serveur.
- Éviter les dépendances inutiles.
- Ajouter les tests.
- Documenter les décisions.
- Ne pas inventer de secrets.
- Ne pas utiliser de médias sans droits appropriés.
- Ne pas ajouter de fonctionnalités hors périmètre.

Lorsque des précisions techniques non fonctionnelles sont nécessaires, choisir la solution la plus simple, sécurisée et maintenable.

Si une ambiguïté a un impact sur les règles de jeu, la signaler plutôt que de décider arbitrairement.

À la fin de chaque phase, fournir :

- Fonctionnalités réalisées.
- Fichiers modifiés.
- Tests exécutés.
- Résultats.
- Problèmes restants.
- Étape suivante.

Ne pas déclarer une fonctionnalité terminée si elle n'est pas réellement implémentée.

# 21. Livrables

Livrer :

- Application fonctionnelle.
- Code source.
- Migrations Supabase.
- Tests.
- Catalogue de démonstration.
- README.
- `.env.example`.
- Instructions d'installation.
- Instructions de déploiement Vercel.
- Documentation des règles métier.

**Résultat attendu : un véritable jeu de blind test multijoueur, automatisé, sécurisé et utilisable entre amis.**