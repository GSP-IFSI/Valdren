# L'épreuve de Valdren

*Chroniques des Failles* — RPG dark fantasy au combat tour par tour. Trente-cinq jours avant l'offensive de Varek : contrats de la Guilde, bois profonds, dragon de la Crête, enquête, alliances… et une bataille finale.

Cette version **matérialise graphiquement** le prototype texte `v0.9.6.1` : les règles, les textes et l'équilibrage sont ceux du prototype, repris tels quels ; tout le reste (décors, personnages, carte, combats mis en scène, interface, sons) est nouveau.

## Jouer

Le jeu tient dans **un seul fichier : [`index.html`](index.html)**. Il fonctionne sur ordinateur comme sur téléphone, en portrait comme en paysage, et se sauvegarde tout seul dans le navigateur.

| Où | Comment |
|---|---|
| Ordinateur | Ouvrir `index.html` dans un navigateur. Menu ☰ → **Plein écran**. |
| Téléphone Android | Ouvrir la page hébergée, toucher **Commencer** : le jeu passe en plein écran. Menu du navigateur → **Installer l'application** pour une icône qui l'ouvre toujours en plein écran, même hors ligne. |
| iPhone / iPad | Ouvrir la page hébergée dans Safari → **Partager** → **Sur l'écran d'accueil**. L'icône ouvre le jeu en plein écran. |

Pour l'héberger : activer **GitHub Pages** sur ce dépôt (Settings → Pages → branche principale, dossier racine). Le manifeste (`manifest.webmanifest`), le service worker (`sw.js`) et les icônes sont déjà à la racine.

### Commandes

- Tout se joue au doigt ou à la souris. Sur la carte, toucher un lieu ouvre ses actions.
- En combat : **Attaquer**, **Se couvrir**, **Esquiver**, **Observer**, puis techniques, remèdes, changement d'arme, fuite. L'intention de l'adversaire s'affiche quand vous savez la lire ; sa posture la trahit aussi (il se ramasse avant un coup lourd).
- Toucher l'écran pendant une animation l'accélère. La vitesse des combats se règle dans le menu.
- Clavier : `1`–`9` pour choisir une action, `Entrée` pour continuer, `Échap` pour fermer ou ouvrir le menu.

## Ce qui a été fait

- **Moteur conservé.** Le script du prototype est repris sans le réécrire. Trois greffes seulement, vérifiées à chaque build : le bloc de démarrage devient `MOTEUR_action(a)`, et `render()` est scindé en `MOTEUR_resoudre()` / `MOTEUR_html()`.
- **Univers peint par le code.** Aucune image externe, hormis les quinze portraits du prototype. Style « théâtre d'ombres » : silhouettes découpées en couches, brumes, lumières chaudes ; chaque lieu existe de jour (heure dorée voilée) et de nuit (clair de lune), avec parallaxe, flammes, eau et particules animées.
  - 16 décors : écran-titre, Valdren, forge, herboristerie, Guilde, auberge, lisière, marais, gorge, Crête, antre du dragon, campement, route du nord, fort de Varek, cellules, bataille du Gué.
  - Un pantin humain articulé (héros selon l'origine et l'arme, renégats, gardes, Varek, Séléna, Kael, Orsan, Ivan, Hilda…) et un bestiaire : loups, Vieux Gris, sanglier, ours, cerf aux bois de fer, lynx, crapaud-bouclier, guivre, ogre, chimère, le Morghal, et Azharel le dragon.
- **Carte de la vallée** à l'encre d'or : lieux à toucher, actions du village regroupées par bâtiment, pistes secondaires, alertes.
- **Combats mis en scène** : chaque ligne du journal de combat devient un geste (élan, coup, parade, esquive, souffle de flammes), avec chiffres de dégâts, étincelles, secousses et sons.
- **Récit en scène** : décor du lieu, personnages présents, grand portrait encadré quand il existe.
- **Interface plein écran** : HUD, fiche du héros et journal du monde en volets, passage du jour à la nuit, messages de rumeurs, menu (plein écran, sons, vitesse, caméra).
- **Sons synthétisés** (Web Audio), sans aucun fichier.

## Organisation

```
index.html              le jeu assemblé (fichier unique, à ouvrir ou à héberger)
manifest.webmanifest    installation en plein écran sur téléphone
sw.js                   jeu disponible hors ligne
icons/                  icônes de l'application
moteur/                 le prototype texte : source des règles
src/
  index.tpl.html        squelette de la page
  css/                  thème et mise en page (portrait, paysage, téléphone couché)
  js/00-vg.js           outils communs
     10-gfx.js          boîte à outils de dessin (reliefs, lumières, particules)
     2x-decors*.js      les décors
     3x-sprites*.js     les personnages et les bêtes ; 32-rendu.js : composition et éclairage
     40-scene.js        la toile : décor courant, personnages, effets, caméra
     50-son.js          bruitages et ambiance
     60-ui.js           HUD, volets, panneau, menu, plein écran
     70-carte.js        la carte de la vallée
     80-combat.js       la mise en scène des combats
     90-main.js         le chef d'orchestre (relie le moteur à la mise en scène)
tools/                  build et outils de contrôle
```

### Reconstruire

```bash
python3 tools/build.py
```

### Passer à une nouvelle version des règles

Déposer le nouveau prototype dans `moteur/` (nommé `valdren-vX.Y.Z.html`) et relancer le build : la version la plus récente est prise. Si la structure du script a changé au point qu'une greffe ne trouve plus son repère, le build s'arrête en disant lequel.

Les nouveaux écrans du moteur s'affichent d'office (panneau de récit sur le décor du lieu courant). Pour leur donner un décor et des personnages, ajouter une ligne dans `miseEnScene` (`src/js/90-main.js`) ; pour un nouvel adversaire, une ligne dans `spritesEnnemi` (`src/js/80-combat.js`).

### Outils de contrôle

Ils utilisent Playwright (Chromium) :

```bash
node tools/capture.js "tools/galerie.html?decor=antre&nuit=1&sprites=heros-aven,dragon" /tmp/a.png 1280 720
```

```bash
node tools/essai.js /tmp 390 844 2
```

```bash
node tools/balade.js 500 1 aven
```

```bash
node tools/tableaux.js /tmp 1280 720 1 dragon,rival,forge
```

- `capture.js` : capture d'une page, ici la planche de contrôle des dessins (`tools/galerie.html`, produite par le build).
- `essai.js` : début de partie joué de bout en bout, avec captures.
- `balade.js` : un robot clique des actions au hasard pendant N pas et signale toute erreur.
- `tableaux.js` : met le jeu dans une situation précise et capture l'écran.
