# Audit des 300 anciens dessins animés et des 100 jeux vidéo

13 novembre 2026. Les 400 fiches ont été examinées. 731 variantes supplémentaires ont été retenues sur 322 fiches : 499 variantes sur 245 dessins animés, 232 variantes sur 77 jeux. Les variantes déjà reconnues ne sont pas ajoutées inutilement.

## Règles et préservation

Les seuils restent 75 %, 82 % et 90 %. Les alias existants et les médias sont conservés ; seules des insertions d’alias sont prévues. La comparaison sépare désormais lettres et chiffres dans les réponses (Ben10 → Ben 10, Portal2 → Portal 2), tout en conservant les clés d’alias stockées. Cela préserve la distinction entre les numéros sans ajouter des variantes qui feraient accepter le mauvais jeu.

83 variantes candidates ont été écartées parce qu’elles étaient partagées entre plusieurs œuvres, trop proches d’un autre alias ou susceptibles de perdre un suffixe romain significatif. Les alias partagés déjà présents entre un jeu et son dessin animé (Pokémon, Donkey Kong Country…) sont conservés tels quels. Le détail figure dans legacy-400-aliases-ecartees.json.

Les fichiers sources des alias des 300 dessins animés et des 100 jeux sont également mis à jour pour les imports suivants. Le script sync-legacy-aliases.mjs refuse toute modification d’œuvre ou de média et vérifie la conservation des anciens alias.

## Validation des autres changements de cette livraison

147 tests réussis, lint, TypeScript et compilation de production validés. Deux manches locales à deux joueurs couvrent la Pat’ Patrouille avec « PawPatrol » et Final Fantasy VII avec « FF 7 ». Les réglages par défaut sont de 15 secondes d’écoute et 15 secondes de réponse, y compris lors du changement de mode ; les règles déjà enregistrées ne sont pas réécrites.

En mode classique (individuel ou équipes), les propositions ne sont publiées qu’à la révélation, avec le pseudonyme et le résultat. Les réponses erronées et les absences de réponse sont affichées ; la saisie reste du texte brut. Le scénario navigateur vérifie la confidentialité pendant la manche, l’affichage à deux joueurs après révélation, l’absence d’exécution de HTML et l’affichage sur PC et mobile. Les propositions du mode réponses libres restent privées.

## Variantes ajoutées

| Fiche | Titre | Variantes |
| --- | --- | --- |
| da-001 | Scooby-Doo | ScoobyDoo ; ScoobyDoooùestu ; ScoobyDooWhereAreYou |
| da-002 | Tom et Jerry | TometJerry ; TomandJerry |
| da-003 | Looney Tunes | LooneyTunes ; LooneyToons |
| da-005 | Les Jetsons | Les Jetson ; FamilleJetson |
| da-006 | La Panthère rose | Panthèrerose ; PinkPanther |
| da-007 | Le Manège enchanté | Manègeenchanté ; MagicRoundabout |
| da-008 | Barbapapa | FamilleBarbapapa |
| da-010 | Inspecteur Gadget | InspecteurGadget |
| da-011 | Les Mystérieuses Cités d'or | Les Mystérieuses Cités Dor ; MystérieusesCitésdor ; CitesDor ; MysteriousCitiesofGold |
| da-012 | Ulysse 31 | Ulyssetrenteetun |
| da-014 | Les Entrechats | HeathcliffandtheCatillacCats |
| da-016 | Les Gummi | AdventuresoftheGummiBears |
| da-017 | La Bande à Picsou | BandeàPicsou |
| da-019 | Les Tortues Ninja | TortuesNinja ; TortuesNinja1987 |
| da-020 | Denver, le dernier dinosaure | Denverledernierdinosaure ; DenvertheLastDinosaur |
| da-021 | Tic et Tac, les rangers du risque | Les Rangers du risque ; TicetTac ; ChipnDaleRescueRangers |
| da-022 | Les Nouvelles Aventures de Winnie l'ourson | Winnielourson |
| da-023 | Super Baloo | SuperBaloo |
| da-024 | Myster Mask | DarkwingDuck |
| da-025 | La Bande à Dingo | BandeàDingo ; GoofTroop |
| da-026 | La Petite Sirène, la série | PetiteSirènelasérie ; PetiteSirène ; LittleMermaidTheSeries |
| da-027 | Aladdin, la série | Aladdinlasérie |
| da-028 | Gargoyles, les anges de la nuit | AngesdelaNuit |
| da-029 | Le Laboratoire de Dexter | LaboratoiredeDexter ; LabodeDexter ; DextersLaboratory |
| da-030 | Johnny Bravo | JohnnyBravo ; JonnyBravo ; JohnnyBravoCartoonNetwork |
| da-031 | Les Supers Nanas | SupersNanas ; PowerpuffGirls |
| da-032 | Courage, le chien froussard | Couragelechienfroussard ; Couragelechien ; CouragetheCowardlyDog |
| da-033 | Ed, Edd et Eddy | Ed Edd Eddy ; EdEddetEddy ; EdEddnEddy |
| da-035 | Hé Arnold ! | HéArnold ; HeyArnold |
| da-038 | Minus et Cortex | MinusetCortex ; PinkyandtheBrain ; PinkyetleCerveau |
| da-039 | La Cour de récré | La Cour de récréation ; Courderécré |
| da-040 | Timon et Pumbaa | TimonetPumbaa |
| da-041 | La Famille Pirate | PirateFamily |
| da-042 | Les Zinzins de l'espace | Zinzinsdelespace ; SpaceGoofs |
| da-043 | Oggy et les Cafards | OggyetlesCafards ; OggyandtheCockroaches |
| da-046 | Bob l'éponge | Sponge Bob ; Sponge Bob Squarepants ; Bobléponge ; SpongeBobSquarePants |
| da-048 | Code Lyoko | CodeLyoko |
| da-049 | Titeuf | Titeuflasérie ; Titeufledessinanimé |
| da-051 | Ratz | RapidoetRazmo |
| da-052 | Corneil et Bernie | CorneiletBernie ; WatchMyChops |
| da-053 | Foot 2 rue | Footderue ; FootDeuxRue |
| da-054 | Galactik Football | GalactikFootball ; GalactikFoot |
| da-055 | Wakfu | WakfuAnkama |
| da-058 | Kim Possible | KimPossibleDisney |
| da-059 | Phinéas et Ferb | PhinéasetFerb ; PhineasandFerb |
| da-060 | La Famille Delajungle | FamilledelaJungle ; WildThornberrys |
| da-061 | Jimmy Neutron | JimmyNeutron ; AventuresdeJimmyNeutron ; JimmyNeutronBoyGenius |
| da-062 | Mes parrains sont magiques | Parrains magiques ; Mesparrainssontmagiques ; FairlyOddParents ; MesParrainsMagiques |
| da-063 | Danny Fantôme | DannyFantôme ; DannyPhantom |
| da-064 | Avatar, le dernier maître de l'air | AvatarTheLastAirbender |
| da-065 | Ben 10 | BenTen |
| da-066 | American Dragon : Jake Long | AmericanDragonJakeLong ; JakeLong |
| da-067 | Les Aventures de Jackie Chan | AventuresdeJackieChan ; JackieChanAdventures ; JackieChan |
| da-068 | Dora l'exploratrice | Doralexploratrice ; DoratheExplorer |
| da-069 | Clifford, le gros chien rouge | Cliffordlegroschienrouge ; CliffordtheBigRedDog |
| da-070 | Charlotte aux fraises | Charlotteauxfraises ; StrawberryShortcake |
| da-071 | Petit Ours Brun | PetitOursBrun ; LittleBrownBear |
| da-072 | Les Lascars | Lascarsdessinanimé |
| da-075 | Garfield & Cie | Garfield and Co ; Garfield et Co ; GarfieldetCie ; GarfieldShow ; Garfieldetcompagnie |
| da-076 | Adventure Time | AdventureTime |
| da-077 | Le Monde incroyable de Gumball | MondeincroyabledeGumball ; AmazingWorldofGumball |
| da-078 | Regular Show | Unshowordinaire |
| da-080 | Souvenirs de Gravity Falls | SouvenirsdeGravityFalls ; GravityFalls |
| da-081 | Teen Titans Go! | TeenTitansGoCartoonNetwork |
| da-082 | Miraculous : Les Aventures de Ladybug et Chat Noir | Lady Bug ; LadybugetChatNoir ; MiraculousLadybug |
| da-083 | Les Sisters | SistersWendyetMarine |
| da-084 | Grizzy et les Lemmings | GrizzyetlesLemmings ; GrizzyandtheLemmings |
| da-085 | Peppa Pig | PeppaPig |
| da-086 | La Pat' Patrouille | PatPatrouille ; PawPatrol |
| da-087 | Masha et Michka | MashaetMichka ; MashaandtheBear |
| da-088 | Bienvenue chez les Loud | BienvenuechezlesLoud ; LoudHouse |
| da-089 | Ninjago : Les Maîtres du Spinjitzu | Lego Ninjago ; NinjagoLesMaîtresduSpinjitzu ; NinjagoMastersofSpinjitzu |
| da-090 | My Little Pony : Les amies, c'est magique | MLP FIM ; MLPFIM ; Friendship Is Magic ; MyLittlePony |
| da-091 | Dragons : Cavaliers de Beurk | DragonsCavaliersdeBeurk ; CavaliersdeBeurk ; DragonsRidersofBerk |
| da-092 | Sanjay et Craig | SanjayetCraig ; SanjayandCraig |
| da-094 | Zig et Sharko | ZigetSharko ; ZigandSharko |
| da-095 | Oscar et Malika, toujours en retard | OscaretMalika ; NateIsLate |
| da-096 | Bluey | BlueyetBingo |
| da-097 | Sonic Prime | SonicPrime ; SonicPrimeNetflix |
| da-099 | Le Cuphead Show ! | CupheadShow |
| da-100 | Les Lapins Crétins : Invasion | Rabbids ; LapinsCrétinsInvasion ; LapinsCrétins ; RabbidsInvasion |
| da-101 | Goldorak | UFORobotGrendizer |
| da-102 | Albator 78 | Albatorlecorsairedelespace ; SpacePirateCaptainHarlock |
| da-103 | Albator 84 | Albator SSX ; Albatorleretour |
| da-104 | Candy | CandyCandy |
| da-105 | Rémi sans famille | Rémisansfamille ; NobodysBoyRemi |
| da-106 | Heidi | HeidifilledesAlpes ; HeidiGirloftheAlps |
| da-107 | Princesse Sarah | Sarah ; Sara ; ALittlePrincessSara |
| da-108 | Belle et Sébastien | BelleetSébastien ; BelleandSebastian |
| da-109 | Les Aventures de Tom Sawyer | AventuresdeTomSawyer ; TomSawyer ; AdventuresofTomSawyer |
| da-110 | Le Tour du monde en 80 jours | WillyFog |
| da-111 | Les Trois Mousquetaires | Les 3 Mousquetaires ; TroisMousquetaires ; ThreeMusketeers |
| da-112 | Calimero | CalimeroetPriscilla ; Calimerolepoussin |
| da-113 | Maya l’abeille | Mayalabeille ; MayatheBee |
| da-114 | Vic le Viking | VicleViking ; VickyleViking |
| da-115 | Nils Holgersson | NilsHolgersson |
| da-118 | Lucky Luke | LuckyLukeclassique |
| da-120 | Marsupilami | MonamiMarsupilami |
| da-121 | Yakari | YakarietPetitTonnerre |
| da-122 | Boule et Bill | BouleetBill ; BillyandBuddy |
| da-124 | Trotro | âneTrotro |
| da-126 | Les Contes de la rue Broca | ContesdelarueBroca ; RueBroca |
| da-127 | Les Malheurs de Sophie | MalheursdeSophie ; SophiesMisfortunes |
| da-128 | Les Shadoks | EtvoilalesShadoks |
| da-129 | Colargol | AventuresdeColargol |
| da-130 | Chapi Chapo | ChapiChapo ; ChapietChapo |
| da-131 | Aglaé et Sidonie | AglaéetSidonie |
| da-137 | Les Mondes engloutis | Mondesengloutis |
| da-138 | Les Maîtres de l’Univers | HeMan ; MaîtresdelUnivers |
| da-139 | She-Ra, la princesse du pouvoir | SheRaPrincessofPower |
| da-143 | Transformers (1984) | TransformersG1 |
| da-144 | G.I. Joe : Héros sans frontières | GIJoe |
| da-145 | Jem et les Hologrammes | JemetlesHologrammes ; JemandtheHolograms |
| da-146 | Max et Compagnie | Max et Co ; MaxetCompagnie ; KimagureOrangeRoad |
| da-148 | Creamy, merveilleuse Creamy | CreamymerveilleuseCreamy ; CreamyMami |
| da-149 | Susy aux fleurs magiques | Susy ; Susyauxfleursmagiques ; MagicalIdolPastelYumi |
| da-150 | Gigi | MinkyMomo |
| da-151 | Magical Dorémi | Dorémi magique ; OjamajoDoremi |
| da-152 | Sailor Moon | SailorMoon ; PrettySoldierSailorMoon |
| da-153 | Lady Oscar | LadyOscar ; RosedeVersailles ; RoseofVersailles |
| da-154 | Georgie | LadyGeorgie |
| da-155 | Lucile, amour et rock'n roll | AishiteKnight ; KissMeLicia |
| da-156 | Juliette, je t'aime | JulietteJeTaime ; MaisonIkkoku |
| da-157 | Ranma ½ | Ranmaundemi |
| da-158 | Lamu | UruseiYatsura |
| da-159 | Nicky Larson | NickyLarson ; CityHunter |
| da-160 | Cat’s Eye | Catseyes ; CatsEye |
| da-161 | Ken le Survivant | KenleSurvivant ; HokutonoKen ; FistoftheNorthStar |
| da-162 | Les Chevaliers du Zodiaque | CDZ ; ChevaliersduZodiaque ; SaintSeiya ; ChevaliersduZodiaque1986 ; KnightsoftheZodiac |
| da-163 | Dragon Ball | DragonBall1986 |
| da-166 | Dragon Ball Super | DragonballSuper |
| da-167 | Pokémon | PocketMonsters |
| da-168 | Digimon Adventure | DigimonAdventure ; DigimonDigitalMonsters |
| da-169 | Beyblade | BakutenShootBeyblade |
| da-170 | Yu-Gi-Oh! GX | YuGiOhGenerationNext |
| da-171 | Yu-Gi-Oh! 5D’s | Yu Gi Oh 5D |
| da-172 | Shaman King | ShamanKing ; ShamanKing2001 |
| da-174 | Monster Rancher | MonsterRancher ; MonsterFarm |
| da-175 | Sakura, chasseuse de cartes | Sakurachasseusedecartes ; CardcaptorSakura |
| da-176 | Tsubasa Reservoir Chronicle | TRC ; TsubasaReservoirChronicle ; TsubasaChronicle ; TsubasaReservoir |
| da-177 | Olive et Tom | OliveetTom ; CaptainTsubasa |
| da-178 | L’École des champions | Écoledeschampions ; EcoledesChampionsdefootball ; MoeroTopStriker |
| da-179 | But pour Rudy | ButpourRudy ; GanbareKickers |
| da-180 | Jeanne et Serge | JeanneetSerge ; AttackerYou |
| da-181 | Gwendoline | LadyLady |
| da-182 | Capitaine Flam | Captain Flam ; CapitaineFlam ; CaptainFuture |
| da-183 | Cobra | SpaceAdventureCobra |
| da-184 | Astro, le petit robot | Astro ; AstroBoy ; Astrolepetitrobot ; AstrolePetitRobot1980 |
| da-186 | Jayce et les Conquérants de la lumière | JayceandtheWheeledWarriors |
| da-187 | Les Samouraïs de l’Éternel | SamouraïsdelÉternel ; RoninWarriors ; YoroidenSamuraiTroopers |
| da-188 | Les Aventures de Super Mario Bros. 3 | SuperMarioBros3 ; MarioBros3 |
| da-190 | Le Super Show de Super Mario Bros. | Super Mario Super Show ; Mario Super Show ; SuperMarioBrosSuperShow |
| da-191 | Les Aventures de Sonic | AdventuresofSonictheHedgehog |
| da-192 | Sonic X | SonicX2003 |
| da-193 | Sonic Boom | SonicBoom2014 |
| da-195 | Pac-Man | PacMan1982 |
| da-196 | Pac-Man et les Aventures de fantômes | PacManAventuresdeFantomes |
| da-197 | Les Nouvelles Aventures de Batman | NewAdventuresofBatman1977 |
| da-198 | Batman, la série animée (1992) | Batman ; BTAS ; Batmanlasérieanimée1992 ; BatmanTAS |
| da-199 | Batman, la relève | BatmanBeyond ; Batmanlarelève |
| da-200 | Superman, l’Ange de Metropolis | SupermanlAngedeMetropolis |
| da-201 | La Ligue des justiciers | Liguedesjusticiers ; JusticeLeague |
| da-202 | Teen Titans : Les Jeunes Titans | Teen Titans ; TeenTitansLesJeunesTitans ; TeenTitans2003 ; JeunesTitans |
| da-203 | La Légende de Korra | AvatarLaLegendedeKorra |
| da-204 | X-Men (1992) | X-Men ; Xmen ; XMen1992 ; XMenTAS |
| da-205 | X-Men : Evolution | XmenEvolution |
| da-206 | Spider-Man, l’homme-araignée (1994) | Spider-Man ; Spiderman ; Spider-Man TAS ; SpiderMan1994 |
| da-207 | Spectacular Spider-Man | SpectacularSpiderMan ; SpiderManSpectacular ; SpectacularSpiderMan2008 |
| da-208 | Les Quatre Fantastiques (1994) | Les Quatre Fantastiques ; Fantastic Four ; QuatreFantastiques1994 ; FantasticFour1994 |
| da-209 | Iron Man (1994) | IronMan1994 ; IronMan |
| da-210 | Le Bus magique | MagicSchoolBus ; BusMagique1994 |
| da-211 | Le Bus magique reprend la route | Busmagiquereprendlaroute ; MagicSchoolBusRidesAgain |
| da-212 | Les Aventures de Babar et Badou | BabaretBadou |
| da-213 | Franklin | Franklinlatortue |
| da-214 | Franklin et ses amis | Franklinetsesamis ; FranklinandFriends |
| da-218 | Mimi la souris | Mimilasouris |
| da-220 | Pocoyo | PocoyoetPato |
| da-221 | Dino Train | DinoTrain ; DinosaurTrain |
| da-222 | Chuggington | ChuggingtonLesPetitsTrains |
| da-223 | Thomas et ses amis | Thomasetsesamis ; Thomaslepetittrain ; ThomasetFriends ; ThomasetsesAmis1984 |
| da-224 | Sam le pompier | Samlepompier ; FiremanSam |
| da-225 | Bob le bricoleur | Boblebricoleur ; BobtheBuilder |
| da-226 | Postman Pat | PostmanPat ; PierreMartinlefacteur ; Pierrelefacteur ; Patlefacteur |
| da-227 | T’choupi et Doudou | T'choupi ; TchoupietDoudou |
| da-228 | Les Contes de Tinga Tinga | ContesdeTingaTinga ; TingaTingaTales ; TingaTinga |
| da-229 | Kipper | Kipperlechien ; KippertheDog |
| da-231 | Les Enquêtes de Prudence Petitpas | EnquêtesdePrudencePetitpas ; PrudencePetitpas |
| da-234 | Les Aventures de Blake et Mortimer | AventuresdeBlakeetMortimer ; BlakeetMortimer |
| da-236 | La Vie de Rosie | ViedeRosie ; EverythingsRosie |
| da-237 | Les Frères Koalas | FrèresKoalas ; KoalaBrothers |
| da-238 | Les P’tits Diables | PtitsDiables ; PetitsDiables |
| da-239 | Les As de la jungle à la rescousse | JungleBunchtotheRescue ; AsdelaJungle |
| da-240 | Les Croods : Origines | Les Croods ; CroodsOrigines ; DawnoftheCroods |
| da-241 | Les Pingouins de Madagascar | PingouinsdeMadagascar ; PenguinsofMadagascar |
| da-242 | Le Roi Julien ! L’Élu des lémurs | AllHailKingJulien ; RoiJulien |
| da-245 | Le Chat potté : Les Aventures du chat potté | Le Chat Potté ; AventuresduChatPotté |
| da-246 | Turbo FAST | Turbo ; TurboFAST ; TurboFastActionStuntTeam |
| da-248 | Trolls : En avant la musique | Trolls ; TrollsEnavantlamusique ; TrollsTheBeatGoesOn |
| da-249 | Dragons : Par-delà les rives | DragonsPardelàlesrives ; DragonsRacetotheEdge |
| da-250 | Spirit : Au galop en toute liberté | Spirit ; SpiritRidingFree |
| da-251 | M. Peabody et Sherman Show | M Peabody et Sherman ; Mr Peabody et Sherman ; Monsieur Peabody et Sherman ; MPeabodyetShermanShow ; MrPeabodyandShermanShow |
| da-253 | La Famille Proud | CoolAttitude ; ProudFamily |
| da-255 | Dave le barbare | Davelebarbare ; DavetheBarbarian |
| da-256 | Brandy et M. Moustache | Brandy et Mr Moustache ; Brandy et Moustache ; BrandyetMMoustache ; BrandyandMrWhiskers ; BrandyetMonsieurMoustache |
| da-257 | La Légende de Tarzan | Tarzan |
| da-258 | Hercule (série Disney) | Hercule ; Hercules ; HerculesérieDisney ; Herculelaserie |
| da-259 | Les Aventures de Buzz l’Éclair | Buzz l'éclair ; Buzz lEclair ; AventuresdeBuzzlÉclair ; BuzzLightyearofStarCommand ; BuzzlEclairlesaventures |
| da-260 | Lilo et Stitch, la série | LiloetStitchlasérie ; LiloetStitch ; LiloetStitchTheSeries |
| da-261 | Kuzco, un empereur à l’école | Kuzco ; EmperorsNewSchool ; KuzcoalEcole |
| da-263 | Jake et les Pirates du Pays imaginaire | Jake et les pirates |
| da-264 | Princesse Sofia | Sofia ; SofiatheFirst ; SofiaPremiere |
| da-265 | Elena d’Avalor | Elena Avalor ; ElenadAvalor ; ElenaofAvalor |
| da-266 | Docteur La Peluche | Doc la Peluche ; DocteurLaPeluche ; DocMcStuffins |
| da-267 | La Maison de Mickey | Mickey Clubhouse ; MaisondeMickey ; MickeyMouseClubhouse |
| da-268 | Mickey et ses amis : Top Départ ! | MickeyandtheRoadsterRacers ; MickeyTopDepart |
| da-269 | Le Monde de Bingo et Rolly | MondedeBingoetRolly ; PuppyDogPals ; BingoetRolly |
| da-270 | Vampirina | Vampirinalasérie |
| da-271 | La Garde du Roi Lion | GardeduRoiLion ; LionGuard |
| da-272 | Raiponce, la série | Raiponce ; Raiponcelasérie ; TangledTheSeries ; RapunzelsTangledAdventure |
| da-273 | La Bande à Picsou (2017) | BandeàPicsou2017 |
| da-275 | Luz à Osville | LuzàOsville ; OwlHouse |
| da-276 | Les Green à Big City | GreenàBigCity ; BigCityGreens |
| da-277 | Les Nouveaux Héros : La Série | Les Nouveaux Héros ; Big Hero 6 ; BigHero6 ; NouveauxHérosLaSérie ; BaymaxetlesNouveauxHéros ; BigHero6TheSeries |
| da-278 | Star Butterfly | StarButterfly |
| da-279 | Wander | WanderOverYonder |
| da-280 | Hamster et Gretel | HamsteretGretel ; HamsterandGretel |
| da-281 | Milo Murphy | MiloMurphy ; LoideMiloMurphy ; MiloMurphysLaw |
| da-282 | Bob l’éponge : Le Camp de vacances | KampKoral |
| da-283 | Patrick Super Star | PatrickSuperStar ; PatrickStarShow |
| da-284 | Rocket Power | RocketPower ; RocketPower1999 |
| da-285 | Les Castors allumés | Castorsallumés ; AngryBeavers |
| da-286 | Michat-Michien | MiChatMiChien |
| da-287 | Invader Zim | InvaderZim ; ZimlEnvahisseur |
| da-288 | Les Razbitume ! | AllGrownUp ; RazmoketLesRazbitume |
| da-289 | Les Aventures de Manny et ses outils | Manny ; Mannyetsesoutils |
| da-290 | Tak et le Pouvoir de Juju | Tak |
| da-291 | Fanboy et Chum Chum | FanboyetChumChum |
| da-292 | T.U.F.F. Puppy | TUFFPuppy |
| da-294 | Harvey Beaks | HarveyBeaks ; aventuresdeHarveyBeaks |
| da-295 | Bienvenue chez les Casagrandes | BienvenuechezlesCasagrandes |
| da-296 | Les Tortues Ninja (2003) | TMNT2K3 ; TortuesNinja2003 |
| da-297 | Les Tortues Ninja (2012) | TortuesNinja2012 |
| da-298 | Le Destin des Tortues Ninja | DestindesTortuesNinja ; RiseoftheTMNT |
| da-299 | Scooby-Doo, Mystères associés | ScoobyDooMystèresassociés ; ScoobyDooMysteryIncorporated ; MystèresAssociés |
| da-300 | Quoi d’neuf Scooby-Doo ? | Quoi de neuf Scoobydoo ; QuoidneufScoobyDoo ; WhatsNewScoobyDoo ; QuoideneufScoobyDoo |
| vg-001 | Super Mario Bros. | Super Mario 1 ; Mario 1 ; Super Mario Bros 1 ; SMB ; SMB1 ; SuperMarioBros ; MarioBros |
| vg-002 | Super Mario World (jeu vidéo) | SuperMarioWorldjeuvidéo |
| vg-003 | Super Mario 64 | SuperMario64 |
| vg-004 | Super Mario Galaxy | SMG ; SuperMarioGalaxy ; MarioGalaxy |
| vg-005 | Super Mario Odyssey | SMO ; SuperMarioOdyssey ; MarioOdyssey |
| vg-006 | Mario Kart 64 | MarioKart64 |
| vg-007 | Mario Kart Wii | MKW ; MKWii |
| vg-008 | Mario Kart 8 | MK8DX ; MK8 Deluxe ; MK8D ; MarioKart8 ; MarioKart8Deluxe |
| vg-009 | The Legend of Zelda | LOZ ; TLOZ ; Zelda I |
| vg-010 | The Legend of Zelda: A Link to the Past | ALTTP ; Zelda 3 ; ZeldaALTTP ; ALinktothePast |
| vg-011 | The Legend of Zelda: Ocarina of Time | OOT ; Zelda Ocarina ; Zelda Ocarina of Time ; OcarinaofTime |
| vg-012 | The Legend of Zelda: Majora's Mask | Zelda MM ; Majora ; Majoras Mask ; Majora Mask ; Zelda Majoras Mask ; MajorasMask ; ZeldaMajora |
| vg-013 | The Legend of Zelda: The Wind Waker | TWW ; Zelda WW ; WindWaker ; ZeldaWindWaker |
| vg-014 | The Legend of Zelda: Breath of the Wild | Zelda Breath of the Wild ; BreathoftheWild |
| vg-015 | Pokémon Rouge et Bleu | Pokemon Rouge Bleu ; Pokemon Red and Blue ; Pokemon Red ; Pokemon Blue ; Pokemon Version Rouge ; Pokemon Version Bleue ; PokémonRougeetBleu ; PokemonRouge ; PokemonBleu |
| vg-016 | Pokémon Or et Argent | Pokemon Or Argent ; Pokemon Gold and Silver ; Pokemon Gold ; Pokemon Silver ; Pokemon Version Or ; Pokemon Version Argent ; PokémonOretArgent ; PokemonArgent ; PokemonGoldSilver |
| vg-017 | Pokémon Rubis et Saphir | Pokemon Rubis Saphir ; Pokemon Ruby and Sapphire ; Pokemon Ruby ; Pokemon Version Rubis ; Pokemon Version Saphir ; Pokemon RS ; PokémonRubisetSaphir ; PokemonRubis ; PokemonSaphir ; PokemonRubySapphire |
| vg-018 | Pokémon Diamant et Perle | Pokemon Diamant Perle ; Pokemon Diamond and Pearl ; Pokemon Diamond ; Pokemon Pearl ; Pokemon Version Diamant ; Pokemon Version Perle ; Pokemon DP ; PokémonDiamantetPerle ; PokemonDiamant ; PokemonDiamondPearl |
| vg-019 | Donkey Kong Country (jeu vidéo) | Donkey Kong Country 1 ; DKC 1 ; DKC1 ; DonkeyKongCountryjeuvidéo ; DKCountry |
| vg-020 | Donkey Kong Country 2 | DK Country 2 ; Diddys Kong Quest ; DonkeyKongCountry2 ; DonkeyKong2 ; DiddysKongQuest |
| vg-021 | Donkey Kong 64 | DonkeyKong64 |
| vg-022 | Kirby's Dream Land | Kirby Dreamland ; KirbysDreamLand ; KirbyDreamLand |
| vg-023 | Super Smash Bros. Melee | SSB Melee ; Smash Bros Melee ; SmashMelee |
| vg-024 | Super Smash Bros. Brawl | SSB Brawl ; Smash Bros Brawl ; SmashBrawl |
| vg-025 | Super Smash Bros. Ultimate | SSB Ultimate ; SuperSmashBrosUltimate ; SmashUltimate ; SmashBrosUltimate |
| vg-026 | Animal Crossing: New Horizons | AC New Horizons ; AnimalCrossingNewHorizons ; AnimalCrossing ; NewHorizons |
| vg-027 | Wii Sports | WiiSports ; WiiSport |
| vg-030 | Luigi's Mansion | Luigi Mansion 1 ; Luigi's Mansion I ; LuigisMansion ; LuigiMansion ; LuigisMansion1 |
| vg-031 | Super Metroid | Metroid 3 ; SuperMetroid ; MetroidSuper |
| vg-032 | Metroid Prime | Metroid Prime 1 ; MetroidPrime |
| vg-034 | Star Fox 64 | LylatWars |
| vg-035 | Punch-Out!! | PunchOut ; MikeTysonsPunchOut |
| vg-037 | Sonic the Hedgehog | Sonic the Hedgehog 1 ; SonictheHedgehog |
| vg-038 | Sonic the Hedgehog 2 | SonictheHedgehog2 |
| vg-039 | Sonic Adventure 2 | Sonic Adventure 2 Battle ; SonicAdventure2 ; SonicAdventureII |
| vg-040 | Streets of Rage 2 | StreetsofRage2 ; StreetsofRageII |
| vg-041 | Tetris | TetrisGameBoy |
| vg-042 | Street Fighter II | StreetFighter2 ; StreetFighter |
| vg-043 | Mortal Kombat | Mortal Kombat I ; MortalKombat ; MortalKombat1 |
| vg-044 | Tekken 3 | TK3 ; TekkenIII |
| vg-046 | Castlevania | Castlevania I ; Castlevania NES |
| vg-047 | Castlevania: Symphony of the Night | Castlevania Symphony ; SymphonyoftheNight |
| vg-048 | Final Fantasy VII | FinalFantasy7 |
| vg-049 | Final Fantasy VIII | FinalFantasy8 |
| vg-050 | Final Fantasy X | FinalFantasy10 |
| vg-052 | Kingdom Hearts | KH ; Kingdom Hearts I ; KingdomHearts ; KingdomHearts1 |
| vg-053 | Dragon Quest VIII | DragonQuest8 |
| vg-054 | Secret of Mana | SOM ; SecretofMana ; SecretMana ; SeikenDensetsu2 |
| vg-056 | Persona 5 | PersonaV |
| vg-064 | Plants vs. Zombies | PlantsvsZombies ; Plantescontrezombies ; PlantsversusZombies |
| vg-065 | Angry Birds | AngryBirds ; AngryBird |
| vg-067 | Halo: Combat Evolved | HaloCombatEvolved ; HaloCE |
| vg-068 | The Elder Scrolls V: Skyrim | TESV ; The Elder Scrolls Skyrim ; ElderScrollsVSkyrim ; ElderScrolls5 |
| vg-069 | The Elder Scrolls IV: Oblivion | TESIV ; The Elder Scrolls Oblivion ; ElderScrollsIVOblivion ; ElderScrolls4 |
| vg-070 | The Witcher 3: Wild Hunt | TW3 ; TW 3 ; Wild Hunt ; Witcher3WildHunt ; WitcherIII |
| vg-071 | DOOM | Doom Classic |
| vg-073 | Portal | Portal I |
| vg-075 | Team Fortress 2 | TeamFortress2 ; TeamFortressII |
| vg-076 | Overwatch | OW ; OW1 ; OW 1 |
| vg-077 | League of Legends | LeagueofLegends ; LeagueofLegend |
| vg-079 | Fortnite | Fortnite BR ; FN ; FortniteBR ; FortniteBattleRoyale |
| vg-080 | Grand Theft Auto: San Andreas | GTASA ; GTA SanAndreas ; GrandTheftAutoSanAndreas ; GTASanAndreas ; SanAndreas |
| vg-081 | Grand Theft Auto V | GTAV |
| vg-082 | Red Dead Redemption 2 | RedDeadRedemption2 ; RedDead2 ; RedDeadRedemptionII |
| vg-083 | Assassin's Creed II | ACII ; AssassinsCreed2 |
| vg-084 | Crash Bandicoot | Crash 1 ; CrashBandicoot ; CrashBandicoot1 |
| vg-085 | Spyro the Dragon | SpyrotheDragon |
| vg-087 | Rayman Legends | RaymanLegends ; RaymanLegend |
| vg-090 | Age of Empires II | AgeofEmpires2 |
| vg-092 | World of Warcraft | WorldofWarcraft |
| vg-093 | StarCraft | Star Craft |
| vg-095 | Baldur's Gate 3 | BaldursGate3 ; BaldursGateIII |
| vg-096 | Resident Evil 2 | ResidentEvil2 ; ResidentEvilII |
| vg-097 | Silent Hill 2 | SilentHill2 ; SilentHillII |
| vg-098 | Metal Gear Solid | MGS1 ; MGS 1 ; MetalGearSolid ; MetalGearSolid1 |
| vg-099 | God of War (2018) | GOW 2018 ; GodofWar2018 ; GodofWar |
| vg-100 | Uncharted: Drake's Fortune | Drakes Fortune ; Drake's Fortune ; Uncharted Drakes Fortune ; UC1 ; UnchartedDrakesFortune |
