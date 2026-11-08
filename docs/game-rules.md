# Règles, sécurité et limites

- Paramètres serveur : 1–50 manches (20 par défaut), 5–30 secondes d’écoute cumulée, 5–30 secondes de réponse ; catégories et difficultés non vides. Si le catalogue est insuffisant, le salon propose de réduire le nombre de manches ; la réduction doit être enregistrée avant le lancement.
- Préchargement : tous les participants, délai maximal 20 secondes. Un départ explicite retire ce joueur des préchargements futurs ; une panne audio non résolue interrompt la partie avec un message.
- Compte à rebours : trois secondes. Les clients estiment le décalage d’horloge avec le milieu d’un aller-retour et retiennent le meilleur RTT observé.
- Buzzer : premier commit PostgreSQL accepté. Le verrou de ligne sérialise les candidats ; le numéro de version rejette les états obsolètes. L’horodatage et le budget de l’essai accepté sont recalculés **sous verrou** à partir de `clock_timestamp()`.
- Réponse : une seule proposition ; le commit refuse un traitement traversant l’échéance. Une réponse arrivant à échéance échoue. Une mauvaise réponse ou un timeout exclut uniquement ce joueur ; les partenaires restent éligibles.
- Reprise : 500 ms de marge de synchronisation, puis budget audio restant. Les secondes de saisie ne sont pas soustraites de l’écoute.
- Score : 100 + partie entière de 100 × budget restant / budget total, borné à 100–200.
- Départage : score, bonnes réponses, temps cumulé des buzz gagnants. En cas d’égalité persistante, aucun autre critère métier ne départage les joueurs.
- Audio : correction si dérive supérieure à 180 ms, contrôle toutes les 100 ms. La pause attend la notification serveur ; le budget officiel demeure serveur. Le polling à 2,5 secondes récupère les notifications perdues. Ces paramètres ne sont pas une garantie acoustique à la milliseconde.
- Sélection : une seule œuvre par partie, filtres serveur, préférence aux œuvres inédites puis moins récentes ; équilibrage des difficultés disponibles. Métadonnées de sélection conservées dans l’état privé.
- Historique : partie et contributions enregistrées dans la transaction de fin ; rondes terminées et essais conservés dans le document de jeu archivé. Les tables de salons et de jeux utilisent un document JSONB privé pour garantir une mutation atomique de l’ensemble. Le catalogue, profils, scores historiques et historique des œuvres sont normalisés.

Les médias doivent être décodés par le navigateur et restent inspectables. Les URLs signées réduisent leur exposition sans constituer une protection absolue. Titres, alias, sélection et réponses saisies sont retirés du snapshot avant révélation. Le propriétaire n’a aucun droit d’écriture direct sur les scores. Les fonctions de mutation sont réservées au rôle serveur ; l’unique fonction SECURITY DEFINER d’autorisation Realtime est dans un schéma privé et vérifie `auth.uid()`.

L’algorithme de réponse est déterministe : normalisation Unicode, accents, ponctuation, articles contrôlés, chiffres romains II–X, correspondances exactes et alias, distance d’édition et tokens. Chaque token significatif doit être représenté ; les nombres sont conservés. Les alias restent le moyen explicite de gérer les abréviations et raccourcis légitimes. Seuils : 0,75 / 0,82 / 0,90. Leur calibration sur le futur catalogue réel reste nécessaire.
