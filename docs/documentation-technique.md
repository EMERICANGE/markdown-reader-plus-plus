# Documentation Technique — Markdown Reader++

## 1. Architecture Globale

### Stack Technique

| Technologie | Version | Role |
|-------------|---------|------|
| Angular | 18.2 | Framework SPA, standalone components, signals |
| PrimeNG | 17.18 | Composants UI (Tree, Listbox, Toolbar, ConfirmDialog) |
| PrimeFlex | 4.x | Utilitaires CSS flexbox/grid |
| PrimeIcons | 7.x | Bibliothèque d'icônes |
| marked | 18.x | Parsing Markdown vers HTML |
| highlight.js | 11.x | Coloration syntaxique des blocs de code |

### Architecture Applicative

```
┌──────────────────────────────────────────────────────────────┐
│                        AppComponent                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    PrimeNG Toolbar                       │ │
│  │  [FileLoader] [SearchBar]              [ThemeToggle]    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌────────────┬──────────────────────────┬─────────────────┐ │
│  │ TocSidebar │    MarkdownViewer        │  FileSidebar    │ │
│  │  (Tree)    │    (Rendu HTML)          │  (Listbox)      │ │
│  └────────────┴──────────────────────────┴─────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Pattern de Communication

L'application utilise un **Service central** (`MarkdownService`) basé sur les **Angular Signals** :

```
FileLoaderComponent ──addFiles()──► MarkdownService ◄──filteredFiles()── FileSidebarComponent
                                         │
SearchBarComponent ──setSearchTerm()─────┤
                                         │
                    ──setActive()─────────┤
                                         │
                                         ├──► headings() ──► TocSidebarComponent
                                         └──► activeFile() ──► MarkdownViewerComponent
```

## 2. Structure du Projet

```
markdown-viewer/
├── public/
│   └── themes/                    # Thèmes PrimeNG (chargement dynamique)
│       ├── lara-light-blue/
│       └── lara-dark-blue/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── file-loader/       # Chargement fichiers/dossiers + drag & drop
│   │   │   ├── file-sidebar/      # Sidebar droite : liste des fichiers
│   │   │   ├── markdown-viewer/   # Zone centrale : rendu Markdown
│   │   │   ├── search-bar/        # Barre de recherche
│   │   │   └── toc-sidebar/       # Sidebar gauche : table des matières
│   │   ├── models/
│   │   │   └── markdown-file.model.ts  # Interfaces MarkdownFile, TocHeading
│   │   ├── services/
│   │   │   └── markdown.service.ts     # Service central (state management)
│   │   ├── app.component.ts/html/scss  # Composant racine + layout
│   │   └── app.config.ts               # Configuration Angular
│   ├── styles.scss                # Styles globaux + design system
│   └── index.html                 # Shell HTML + theme-link
├── angular.json                   # Configuration Angular CLI
├── package.json                   # Dépendances
└── tsconfig.json                  # Configuration TypeScript
```

## 3. Composants

### AppComponent

**Fichier :** `src/app/app.component.ts`

- Layout CSS Grid 3 colonnes (260px | 1fr | 280px)
- Gestion du thème clair/sombre (changement dynamique du `<link>` CSS)
- Gestion du drag & drop global (délègue à `FileLoaderComponent`)
- ViewChild vers `FileLoaderComponent` pour le drop

### MarkdownService

**Fichier :** `src/app/services/markdown.service.ts`

State management via Angular Signals :

| Signal | Type | Description |
|--------|------|-------------|
| `files()` | `MarkdownFile[]` | Liste de tous les fichiers chargés |
| `activeFile()` | `MarkdownFile \| null` | Fichier actuellement affiché |
| `searchTerm()` | `string` | Terme de recherche actif |
| `headings()` | `TocHeading[]` | Computed : headings extraits du fichier actif |
| `filteredFiles()` | `MarkdownFile[]` | Computed : fichiers filtrés par nom |

Méthodes :
- `addFiles(files)` : ajoute des fichiers à la liste existante
- `replaceFiles(files)` : remplace tous les fichiers
- `setActive(file)` : définit le fichier actif
- `setSearchTerm(term)` : met à jour le terme de recherche

### MarkdownViewerComponent

**Fichier :** `src/app/components/markdown-viewer/markdown-viewer.component.ts`

- Utilise une instance `Marked` avec renderer custom :
  - **Headings** : génère des `id` slugifiés (compatible Unicode/accents)
  - **Code blocks** : wrapper `.terminal-block` avec header macOS + highlight.js
- Intercepte les clics sur les liens `#anchor` via `addEventListener` natif
- Scroll programmatique vers `.main-content` (pas `scrollIntoView`)
- Surbrillance des termes de recherche dans le HTML rendu (regex negative lookahead pour éviter les tags)

### TocSidebarComponent

**Fichier :** `src/app/components/toc-sidebar/toc-sidebar.component.ts`

- Transforme la liste plate de headings en arbre hiérarchique (`TreeNode[]`)
- Algorithme de stack pour construire la hiérarchie parent/enfant
- `selectionMode="single"` requis pour que `onNodeSelect` fonctionne
- Scroll programmatique vers la section (calcul de position relative au container)

### FileLoaderComponent

**Fichier :** `src/app/components/file-loader/file-loader.component.ts`

- Deux inputs : `<input type="file" accept=".md" multiple>` et `<input webkitdirectory>`
- Dialogue de confirmation PrimeNG (Ajouter / Remplacer)
- Méthode `onDrop()` exposée pour le drag & drop global
- Lecture asynchrone des fichiers via `File.text()`

### FileSidebarComponent

**Fichier :** `src/app/components/file-sidebar/file-sidebar.component.ts`

- PrimeNG Listbox bindé sur `filteredFiles()` signal
- Filtre intégré par nom de fichier
- Sélection = `setActive()` sur le service

### SearchBarComponent

**Fichier :** `src/app/components/search-bar/search-bar.component.ts`

- PrimeNG InputText avec icône recherche
- Two-way binding qui met à jour `MarkdownService.setSearchTerm()`

## 4. Design System

### Tokens CSS

Le design utilise des variables CSS custom (`--hi-*`) définies dans `:root` avec override dans `body.dark-theme` :

- **Couleurs** : palette teal (`#299a8d`) avec variantes dark/subtle/glow
- **Ombres** : 3 niveaux (sm, md, lg) + glow
- **Radius** : 8px standard, 12px large
- **Transition** : 250ms cubic-bezier(0.4, 0, 0.2, 1)
- **Typographie** : Inter (UI) + JetBrains Mono (code)

### Thème Dynamique

Le switch de thème fonctionne en 2 parties :
1. `<link id="theme-link">` dans `index.html` charge le CSS PrimeNG (lara-light-blue ou lara-dark-blue)
2. `body.dark-theme` active les variables CSS custom pour le design personnalisé

### Animations

| Animation | Usage | Durée |
|-----------|-------|-------|
| `fadeIn` | Layout global | 0.4s |
| `fadeSlideIn` | Contenu markdown (stagger 40ms) | 0.4s |
| `fadeSlideInLeft` | Sidebar TOC | 0.5s |
| `fadeSlideInRight` | Sidebar fichiers | 0.5s |
| `pulse` | Icône empty state | 2s infinite |

### Code Blocks (Terminal)

Les blocs de code sont rendus dans un wrapper `.terminal-block` :
- Header avec 3 dots macOS (rouge/jaune/vert) + nom du langage
- Fond dark (#1e1e2e) inspiré Catppuccin Mocha
- Syntax highlighting custom avec palette de couleurs contrastées
- Effet hover : `translateY(-2px)` + shadow plus profonde

## 5. Build & Développement

### Prérequis

- Node.js 18+
- npm 9+

### Installation

```bash
cd markdown-viewer
npm install
```

### Développement

```bash
npx ng serve
# http://localhost:4200
```

### Build Production

```bash
npx ng build --configuration=production
# Output: dist/markdown-viewer/
```

### Tests

```bash
npx ng test --watch=false
```

## 6. Points Techniques Notables

### Scroll dans un conteneur

Le `body` a `overflow: hidden`. Le scroll se fait dans `.main-content` (`overflow-y: auto`). `scrollIntoView()` ne fonctionne pas dans cette configuration. Solution : calcul manuel de la position relative avec `getBoundingClientRect()` + `container.scrollTo()`.

### innerHTML et événements

Angular ne bind pas les événements sur le contenu injecté via `[innerHTML]`. Solution : `addEventListener` natif sur le `nativeElement` du composant dans `ngAfterViewInit()`, avec cleanup dans `ngOnDestroy()`.

### Slugify Unicode

Le slugify utilise `/[^\p{L}\p{N}\s-]/gu` (flag Unicode) pour conserver les caractères accentués dans les IDs des headings, assurant la correspondance avec les liens internes Markdown.

### Chargement de thème dynamique

Les thèmes PrimeNG sont copiés dans `public/themes/` (servis comme assets statiques). Le toggle change le `href` du `<link id="theme-link">`, ce qui force le navigateur à recharger le CSS.
