# Documentation Pédagogique — Markdown Reader++

## 1. Objectifs d'apprentissage

Ce projet est un excellent support pour apprendre :

- **Angular 18+** : standalone components, signals, computed, services injectables
- **Gestion d'état réactive** : pattern service + signals (alternative légère à NgRx)
- **PrimeNG** : intégration de composants UI professionnels
- **Manipulation du DOM** : event listeners natifs, scroll programmatique, innerHTML
- **CSS avancé** : variables custom, animations, grid layout, transitions
- **Markdown** : parsing, rendering custom, syntax highlighting

## 2. Concepts clés expliqués

### 2.1 Standalone Components (Angular 18)

Depuis Angular 15, les composants peuvent être "standalone" — ils n'ont pas besoin d'être déclarés dans un NgModule.

```typescript
@Component({
  selector: 'app-search-bar',
  standalone: true,          // Pas besoin de NgModule
  imports: [FormsModule],    // Les dépendances sont déclarées ici
  template: `...`,
})
export class SearchBarComponent { }
```

**Avantage** : moins de boilerplate, meilleure encapsulation, tree-shaking plus efficace.

### 2.2 Angular Signals

Les Signals sont le nouveau système de réactivité d'Angular (introduit en Angular 16) :

```typescript
// Signal = valeur réactive
private _files = signal<MarkdownFile[]>([]);

// Signal en lecture seule (exposé aux composants)
readonly files = this._files.asReadonly();

// Computed = valeur dérivée (recalculée automatiquement)
readonly filteredFiles = computed(() => {
  const term = this._searchTerm().toLowerCase();
  if (!term) return this._files();
  return this._files().filter(f => f.name.includes(term));
});

// Mise à jour
this._files.update(current => [...current, ...newFiles]);
this._files.set(newFiles);
```

**Pourquoi Signals plutôt que RxJS/BehaviorSubject ?**
- Syntaxe plus simple (pas de `subscribe`, pas de `| async`)
- Pas de fuite mémoire (pas de unsubscribe à gérer)
- Meilleure performance (Angular sait précisément ce qui a changé)
- Idéal pour l'état synchrone local

### 2.3 Pattern Service Central

Le `MarkdownService` centralise tout l'état de l'application :

```
┌─────────────────────────────────────────┐
│            MarkdownService              │
│                                         │
│  Signals:                               │
│    _files, _activeFile, _searchTerm     │
│                                         │
│  Computed:                              │
│    headings(), filteredFiles()          │
│                                         │
│  Methods:                               │
│    addFiles(), setActive(), etc.        │
└─────────────────────────────────────────┘
         ▲              │
         │              ▼
   Composants      Composants
   (écrivent)      (lisent)
```

**Principe** : Les composants appellent des méthodes pour modifier l'état, et lisent des signals/computed pour afficher les données. Il n'y a pas de communication directe entre composants — tout passe par le service.

### 2.4 Injection de dépendances

Angular utilise l'injection de dépendances. Avec `inject()` (préféré aux paramètres de constructeur) :

```typescript
export class FileSidebarComponent {
  // Angular injecte automatiquement le singleton MarkdownService
  private markdownService = inject(MarkdownService);

  // On peut directement binder les signals dans le template
  files = this.markdownService.filteredFiles;
}
```

### 2.5 Computed Signals

Un `computed` est un signal dérivé. Il se recalcule automatiquement quand ses dépendances changent :

```typescript
// Se recalcule quand _activeFile() change
readonly headings = computed<TocHeading[]>(() => {
  const file = this._activeFile();  // Dépendance trackée
  if (!file) return [];
  return this.extractHeadings(file.content);
});
```

**Important** : Angular détecte automatiquement les dépendances en lisant quels signals sont appelés dans la fonction.

### 2.6 Rendu Markdown Custom

La librairie `marked` permet de personnaliser le rendu via un Renderer :

```typescript
const markedInstance = new Marked();
markedInstance.use({
  renderer: {
    // Custom heading : ajoute un id pour la navigation
    heading({ text, depth }) {
      const id = slugify(text);
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    },
    // Custom code block : wrapping terminal
    code({ text, lang }) {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<div class="terminal-block">...</div>`;
    },
  },
});
```

### 2.7 Gestion des événements dans innerHTML

Angular ne gère pas les événements dans le contenu injecté via `[innerHTML]`. Solution :

```typescript
// ❌ Ne fonctionne PAS pour innerHTML
@HostListener('click', ['$event'])

// ✅ Fonctionne : listener natif sur le host element
ngAfterViewInit() {
  this.el.nativeElement.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor?.getAttribute('href')?.startsWith('#')) {
      e.preventDefault();
      this.scrollToId(anchor.getAttribute('href').substring(1));
    }
  });
}
```

**Pourquoi ça marche** : les événements DOM "bubblent" — un clic sur un `<a>` dans le innerHTML remonte jusqu'au host element où notre listener le capture.

### 2.8 Scroll programmatique dans un conteneur

Quand le scroll est dans un conteneur (pas le document) :

```typescript
scrollToId(id: string) {
  const element = document.getElementById(id);
  const container = document.querySelector('.main-content');

  // Calcul de la position relative au conteneur
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = elementRect.top - containerRect.top + container.scrollTop;

  // Scroll dans le conteneur (pas le document)
  container.scrollTo({ top: offset - 16, behavior: 'smooth' });
}
```

**Pourquoi pas `scrollIntoView()` ?** Parce que le `body` a `overflow: hidden`. Le navigateur essaie de scroller le viewport (bloqué) au lieu du conteneur interne.

### 2.9 CSS Grid Layout

Le layout 3 colonnes utilise CSS Grid :

```css
.app-layout {
  display: grid;
  grid-template-columns: 260px 1fr 280px;  /* TOC | Content | Files */
  grid-template-rows: auto 1fr;            /* Toolbar | Rest */
  grid-template-areas:
    "header header header"
    "toc main files";
  height: 100vh;
}

.toc-sidebar { grid-area: toc; }
.main-content { grid-area: main; }
.file-sidebar { grid-area: files; }
```

### 2.10 Thème dynamique avec CSS Custom Properties

```css
/* Variables par défaut (thème clair) */
:root {
  --hi-primary: #299a8d;
  --hi-bg: #ffffff;
  --hi-text-primary: #161C24;
}

/* Override pour thème sombre */
body.dark-theme {
  --hi-primary: #3dbdae;
  --hi-bg: #161C24;
  --hi-text-primary: #F4F6F8;
}
```

Le switch se fait en ajoutant/retirant la classe `dark-theme` sur `<body>`.
Les composants utilisent `var(--hi-primary)` — la valeur change automatiquement.

### 2.11 Animations CSS échelonnées (Stagger)

```scss
.markdown-body > * {
  animation: fadeSlideIn 0.4s ease-out both;
}

// Chaque enfant a un délai croissant
@for $i from 1 through 30 {
  .markdown-body > *:nth-child(#{$i}) {
    animation-delay: #{$i * 0.04}s;  // 40ms, 80ms, 120ms...
  }
}
```

**Résultat** : les éléments apparaissent en cascade, créant une sensation de fluidité.

## 3. Exercices suggérés

### Niveau débutant

1. **Ajouter un compteur de mots** : afficher le nombre de mots du fichier actif dans la toolbar
2. **Ajouter un bouton "copier"** sur les blocs de code terminal
3. **Personnaliser les couleurs** : modifier les variables CSS pour créer votre propre thème

### Niveau intermédiaire

4. **Persistance localStorage** : sauvegarder les fichiers chargés pour les retrouver au rechargement
5. **Recherche globale** : chercher dans le contenu de tous les fichiers (pas seulement le nom)
6. **Export PDF** : ajouter un bouton pour exporter le rendu en PDF

### Niveau avancé

7. **Mode édition** : ajouter un éditeur Markdown split-view (édition à gauche, preview à droite)
8. **Synchronisation scroll** : quand on scrolle le contenu, mettre en surbrillance le heading actif dans la TOC
9. **Support Mermaid** : rendre les diagrammes Mermaid dans les blocs de code

## 4. Ressources complémentaires

- [Documentation Angular Signals](https://angular.dev/guide/signals)
- [PrimeNG Components](https://primeng.org/)
- [Marked.js Documentation](https://marked.js.org/)
- [Highlight.js](https://highlightjs.org/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Catppuccin Theme](https://github.com/catppuccin/catppuccin)
