# Alimenter le catalogue

## Enrichir les brouillons dessins animés

Dans `/admin/works`, recherchez un titre ou un identifiant `da-001` à `da-100`. La fiche montre ses pistes documentaires et les champs nécessaires aux médias. Les liens de recherche et les notices officielles servent à identifier la bonne version française. L’autorisation de diffusion du fichier doit être documentée séparément.

Pour traiter un lot, chargez les brouillons dans l’éditeur et téléversez les fichiers autorisés. Nommez par exemple les audios `da-012.easy.wav`, `da-012.normal.mp3` et `da-012.hard.ogg`, et l’illustration `da-012.webp`. Le bouton « Associer les fichiers par leur nom » indique les associations, les identifiants inconnus et les doublons. Les fichiers de 4 Mo ou plus passent directement vers Storage via un ticket signé. Enregistrez le lot pour conserver les associations.

Sur chaque fiche, renseignez la licence de l’illustration et son crédit, la preuve d’autorisation de chaque audio, le début et la durée de l’extrait. Écoutez le segment puis validez l’aperçu. Activez ensuite les extraits autorisés et la fiche. Le serveur vérifie que les fichiers sont présents dans Storage et que chaque difficulté active dispose d’au moins dix secondes jouables. Le crédit d’illustration est affiché lors de la révélation.

Pour le premier essai, activez deux œuvres avec leurs véritables médias autorisés et testez chacune dans un salon privé. Le catalogue de recherche contient actuellement zéro audio et zéro illustration validés.

L’import JSON existant prend en charge titres, plusieurs catégories, alias, images et plusieurs extraits de difficultés distinctes. Il est transactionnel : une erreur annule le lot entier. Aucun média commercial n’est téléchargé automatiquement.

1. Se connecter avec un compte présent dans `public.administrators`, puis ouvrir `/admin/import`.
2. Sélectionner plusieurs fichiers dans « Médias autorisés ». Le téléversement est séquentiel et affiche pour chaque nom d’origine le chemin audio ou l’URL publique de l’image à reporter dans le JSON. Les fichiers déjà envoyés restent affichés si un fichier suivant échoue. Les images acceptées sont PNG, JPEG et WebP ; les audios WAV, MP3 et OGG. Limites applicatives par fichier : 20 Mo audio, 5 Mo image (la limite HTTP de l’hébergement peut être inférieure).
3. Copier les UUID des catégories affichées dans l’administration. Une œuvre peut être associée à plusieurs catégories.
4. Préparer un tableau JSON de **100 œuvres maximum**, dans un fichier de moins de 1 Mo pour le sélecteur de fichier. Charger ce fichier, contrôler le texte, puis cliquer sur « Valider et enregistrer ». Répéter pour les lots suivants.
5. Contrôler les extraits via « Écouter le premier extrait » dans la fiche d’une œuvre, et tester une partie courte avec les filtres désirés. Vérifier les durées et les positions de début avant activation.

Exemple d’un lot (remplacer les UUID, chemins et URL) :

```json
[
  {
    "title": "Titre officiel de l’œuvre",
    "aliases": ["Titre alternatif", "Abréviation acceptée"],
    "categories": ["UUID_DE_LA_CATEGORIE"],
    "image_path": "https://VOTRE-PROJET.supabase.co/storage/v1/object/public/images/IMAGE.webp",
    "rights_source": "Source, licence ou autorisation obtenue pour cet usage",
    "important_words": [],
    "is_active": true,
    "clips": [
      {
        "audio_path": "FICHIER_AUDIO.mp3",
        "difficulty": "easy",
        "start_ms": 0,
        "usable_duration_ms": 30000,
        "is_active": true,
        "rights_status": "authorized"
      },
      {
        "audio_path": "AUTRE_FICHIER_AUDIO.mp3",
        "difficulty": "hard",
        "start_ms": 2000,
        "usable_duration_ms": 28000,
        "is_active": true,
        "rights_status": "authorized"
      }
    ]
  }
]
```

`start_ms` désigne le début de l’extrait dans le fichier ; `usable_duration_ms` sa durée exploitable à partir de ce point. L’application filtre les extraits trop courts pour la durée d’écoute choisie. Difficultés : `easy`, `normal`, `hard`. Seuls les extraits actifs, d’œuvres actives et avec `rights_status: "authorized"` sont sélectionnés.

Une œuvre sans image utilise `"image_path": null`. La révélation affichera l’illustration de remplacement, également utilisée si l’URL d’image échoue.

Pour modifier une œuvre existante, la sélectionner dans l’administration : le JSON inclut son `id`. Conserver cet identifiant pour la mise à jour. Alias, catégories et extraits sont remplacés par le contenu fourni ; inclure ceux à conserver. Sans `id`, un nouveau titre est créé ; un doublon de titre est refusé. Les fichiers média doivent être envoyés avant l’import des métadonnées : l’import JSON ne contient pas les fichiers binaires et n’est pas un import ZIP automatique.

Le catalogue synthétique peut être conservé pour les tests ou ses œuvres désactivées via `is_active: false` avant les vraies parties. Les 56 fichiers de démonstration ne sont pas remplacés par cette correction.
