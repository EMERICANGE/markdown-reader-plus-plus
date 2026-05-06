# Documentation Fonctionnelle — Markdown Reader++

## 1. Présentation

Markdown Reader++ est une application web permettant de lire et naviguer dans des fichiers Markdown (.md). L'application fonctionne entièrement dans le navigateur (pas de serveur requis) et offre une expérience de lecture riche avec table des matières, recherche et thème personnalisable.

## 2. Fonctionnalités

### 2.1 Chargement de fichiers

| Action | Description |
|--------|-------------|
| Bouton "Charger" | Ouvre un sélecteur de fichiers (accepte uniquement les `.md`) |
| Bouton "Dossier" | Ouvre un sélecteur de dossier (charge tous les `.md` du dossier) |
| Drag & Drop | Glisser-déposer des fichiers `.md` directement sur l'application |

**Comportement lors du chargement :**
- Si aucun fichier n'est chargé : les nouveaux fichiers sont ajoutés directement
- Si des fichiers existent déjà : une boîte de dialogue demande à l'utilisateur de choisir :
  - **Remplacer** : supprime les fichiers existants et charge les nouveaux
  - **Ajouter** : ajoute les nouveaux fichiers à la liste existante

### 2.2 Lecture de fichiers Markdown

L'application rend le Markdown en HTML riche avec support de :
- Titres (h1 à h6)
- Paragraphes et sauts de ligne
- **Gras**, *italique*, ~~barré~~
- Listes à puces et numérotées
- Liens hypertextes (externes et internes)
- Images
- Tableaux (GitHub Flavored Markdown)
- Citations (blockquotes)
- Blocs de code avec coloration syntaxique
- Séparateurs horizontaux
- Code inline

### 2.3 Blocs de code

Les blocs de code sont affichés dans un style "terminal" :
- En-tête avec les 3 boutons macOS (rouge, jaune, vert)
- Nom du langage affiché dans l'en-tête
- Coloration syntaxique automatique (détection du langage ou spécification manuelle)
- Fond sombre pour un meilleur contraste

Langages supportés : tous les langages reconnus par highlight.js (JavaScript, TypeScript, Python, Java, C#, Go, Rust, HTML, CSS, SQL, Bash, et bien d'autres).

### 2.4 Table des matières (sidebar gauche)

- Extraction automatique de tous les titres (h1 à h6) du fichier actif
- Affichage hiérarchique en arbre (les sous-titres sont imbriqués sous leurs parents)
- Clic sur un titre : scroll fluide vers la section correspondante
- Le titre sélectionné est mis en surbrillance

### 2.5 Liste des fichiers (sidebar droite)

- Affiche tous les fichiers Markdown chargés
- Le fichier actif est marqué visuellement
- Filtre intégré : tapez dans le champ pour filtrer les fichiers par nom
- Clic sur un fichier : l'ouvre dans la zone de lecture

### 2.6 Recherche

- Barre de recherche dans la toolbar (en haut, au centre)
- **Filtre les fichiers** : la liste à droite ne montre que les fichiers dont le nom contient le terme
- **Surbrillance dans le contenu** : les occurrences du terme sont mises en évidence dans le fichier actif
- Recherche insensible à la casse

### 2.7 Liens internes

Les liens internes dans le Markdown (format `[texte](#section)`) fonctionnent :
- Clic sur un lien interne : scroll fluide vers la section correspondante
- Les accents et caractères spéciaux sont correctement gérés

### 2.8 Thème clair / sombre

- Bouton toggle dans la toolbar (icône soleil/lune)
- Thème clair (par défaut) : fond blanc, texte sombre
- Thème sombre : fond dark, texte clair, adapté pour la lecture prolongée
- Transition animée entre les deux thèmes (0.4 seconde)

## 3. Interface utilisateur

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] [Charger] [Dossier]  |  [Rechercher...]  |  [☀/🌙] │
├──────────────┬──────────────────────────┬───────────────────┤
│              │                          │                   │
│  TABLE DES   │                          │  FICHIERS         │
│  MATIÈRES    │     CONTENU MARKDOWN     │                   │
│              │                          │  [Filtre...]      │
│  - Titre 1   │                          │  ─────────────    │
│    - Sous 1  │                          │  readme.md        │
│    - Sous 2  │                          │  guide.md ●       │
│  - Titre 2   │                          │  api.md           │
│              │                          │                   │
└──────────────┴──────────────────────────┴───────────────────┘
```

### Interactions visuelles

- **Hover sur les éléments de liste** : léger décalage à droite
- **Hover sur les blocs de code** : soulèvement avec ombre portée
- **Hover sur les blockquotes** : décalage à droite
- **Hover sur les images** : léger zoom
- **Hover sur les liens** : soulignement animé de gauche à droite
- **Hover sur les lignes de tableau** : fond coloré
- **Drag & drop** : bordure pointillée teal + overlay sur la zone de contenu
- **Chargement du contenu** : animation en cascade (chaque élément apparaît séquentiellement)

## 4. Limitations connues

- **Pas de persistance** : les fichiers chargés sont perdus à la fermeture/rechargement de la page
- **Pas d'édition** : l'application est en lecture seule
- **Fichiers volumineux** : les très gros fichiers (>10 Mo) peuvent ralentir le rendu
- **Navigateur uniquement** : nécessite un navigateur moderne (Chrome, Firefox, Edge, Safari)
- **webkitdirectory** : le chargement de dossier peut ne pas fonctionner sur tous les navigateurs (Firefox a un support limité)

## 5. Compatibilité navigateur

| Navigateur | Version minimale | Support complet |
|------------|-----------------|-----------------|
| Chrome | 90+ | Oui |
| Firefox | 90+ | Partiel (webkitdirectory) |
| Edge | 90+ | Oui |
| Safari | 15+ | Oui |
