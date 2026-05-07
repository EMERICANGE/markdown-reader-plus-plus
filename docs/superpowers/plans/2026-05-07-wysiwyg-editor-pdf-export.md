# WYSIWYG Editor & PDF Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WYSIWYG markdown editor (TipTap) with split view and PDF export (html2pdf.js) to the existing Angular 18 Markdown Viewer.

**Architecture:** Enhancement in-place — a new `editMode` signal toggles the central panel between read-only view and split view (editor | live preview). Two new services (EditorService, PdfService) and two new components (MarkdownEditorComponent, PdfExportDialogComponent) integrate into the existing standalone component architecture.

**Tech Stack:** Angular 18, TipTap/ngx-tiptap, html2pdf.js, IndexedDB (idb), Mermaid, KaTeX, lowlight

---

## File Structure

### New Files

| Path | Responsibility |
|------|---------------|
| `src/app/services/editor.service.ts` | Editor state, draft management, auto-save, IndexedDB persistence |
| `src/app/services/pdf.service.ts` | PDF generation with two style templates |
| `src/app/components/markdown-editor/markdown-editor.component.ts` | TipTap editor wrapper, toolbar, BubbleMenu |
| `src/app/components/markdown-editor/markdown-editor.component.html` | Editor template with toolbar + TipTap container |
| `src/app/components/markdown-editor/markdown-editor.component.scss` | Editor styles, toolbar layout, bubble menu |
| `src/app/components/markdown-editor/extensions/mermaid.extension.ts` | Custom NodeView for Mermaid diagrams |
| `src/app/components/markdown-editor/extensions/katex.extension.ts` | Custom NodeView for LaTeX formulas |
| `src/app/components/markdown-editor/extensions/embed.extension.ts` | Custom NodeView for video/iframe embeds |
| `src/app/components/markdown-editor/extensions/slash-commands.extension.ts` | Floating menu with slash command suggestions |
| `src/app/components/pdf-export-dialog/pdf-export-dialog.component.ts` | Export modal logic |
| `src/app/components/pdf-export-dialog/pdf-export-dialog.component.html` | Export modal template |
| `src/app/components/pdf-export-dialog/pdf-export-dialog.component.scss` | Export modal styles |
| `src/app/components/editor-status-bar/editor-status-bar.component.ts` | Status bar (save state, cursor pos, file size) |

### Modified Files

| Path | Changes |
|------|---------|
| `package.json` | Add TipTap, ngx-tiptap, mermaid, katex, html2pdf.js, idb, lowlight deps |
| `src/app/app.component.ts` | Add editMode signal, import new components |
| `src/app/app.component.html` | Conditional split view layout, new toolbar buttons |
| `src/app/app.component.scss` | Add split-view grid styles, editor toolbar area |
| `src/styles.scss` | Add PDF export styles (web + document), editor global styles |
| `src/app/services/markdown.service.ts` | Add `editMode` signal, `draftContent` signal |
| `src/app/components/markdown-viewer/markdown-viewer.component.ts` | Accept optional `content` input for preview mode |
| `angular.json` | Add KaTeX CSS and Mermaid to assets/styles if needed |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install TipTap core and extensions**

```bash
cd C:/tools/Demo-Projects/markdown-viewer
npm install @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-image @tiptap/extension-underline @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-code-block-lowlight @tiptap/extension-bubble-menu @tiptap/extension-floating-menu @tiptap/extension-placeholder ngx-tiptap tiptap-markdown
```

- [ ] **Step 2: Install rendering libraries**

```bash
npm install mermaid katex lowlight
npm install -D @types/katex
```

- [ ] **Step 3: Install PDF and storage libraries**

```bash
npm install html2pdf.js idb
```

- [ ] **Step 4: Verify installation compiles**

Run: `npx ng build --configuration development 2>&1 | head -20`
Expected: Build succeeds (or only warnings, no errors)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install TipTap, mermaid, katex, html2pdf.js, idb dependencies"
```

---

## Task 2: Add editMode to MarkdownService

**Files:**
- Modify: `src/app/services/markdown.service.ts`

- [ ] **Step 1: Add editMode and draftContent signals**

Add these signals and methods to `MarkdownService`:

```typescript
// Add to existing signals section
private _editMode = signal<boolean>(false);
private _draftContent = signal<string>('');

readonly editMode = this._editMode.asReadonly();
readonly draftContent = this._draftContent.asReadonly();

toggleEditMode(): void {
  this._editMode.update(v => !v);
  if (this._editMode()) {
    const file = this._activeFile();
    if (file) {
      this._draftContent.set(file.content);
    }
  }
}

setEditMode(value: boolean): void {
  this._editMode.set(value);
}

setDraftContent(content: string): void {
  this._draftContent.set(content);
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/services/markdown.service.ts
git commit -m "feat: add editMode and draftContent signals to MarkdownService"
```

---

## Task 3: Create EditorService with IndexedDB Persistence

**Files:**
- Create: `src/app/services/editor.service.ts`

- [ ] **Step 1: Create the EditorService**

Write `src/app/services/editor.service.ts`:

```typescript
import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { MarkdownService } from './markdown.service';

interface DraftEntry {
  id: string;
  fileName: string;
  markdownContent: string;
  lastModified: number;
  isDirty: boolean;
}

@Injectable({ providedIn: 'root' })
export class EditorService implements OnDestroy {
  private markdownService = inject(MarkdownService);
  private db: IDBPDatabase | null = null;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private lastSavedContent = '';

  readonly saveStatus = signal<'saved' | 'unsaved' | 'saving'>('saved');
  readonly cursorPosition = signal<{ line: number; col: number }>({ line: 1, col: 1 });

  async init(): Promise<void> {
    this.db = await openDB('markdown-editor-drafts', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
      },
    });
    this.startAutoSave();
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveDraft();
    }, 5000);
  }

  async saveDraft(): Promise<void> {
    const file = this.markdownService.activeFile();
    const content = this.markdownService.draftContent();
    if (!file || !content || content === this.lastSavedContent) return;

    this.saveStatus.set('saving');
    const id = this.hashFileName(file.name);
    const entry: DraftEntry = {
      id,
      fileName: file.name,
      markdownContent: content,
      lastModified: Date.now(),
      isDirty: true,
    };

    if (this.db) {
      await this.db.put('drafts', entry);
    }
    this.lastSavedContent = content;
    this.saveStatus.set('saved');
  }

  async loadDraft(fileName: string): Promise<DraftEntry | undefined> {
    if (!this.db) return undefined;
    const id = this.hashFileName(fileName);
    return this.db.get('drafts', id);
  }

  async deleteDraft(fileName: string): Promise<void> {
    if (!this.db) return;
    const id = this.hashFileName(fileName);
    await this.db.delete('drafts', id);
  }

  setCursorPosition(line: number, col: number): void {
    this.cursorPosition.set({ line, col });
  }

  downloadMarkdown(): void {
    const file = this.markdownService.activeFile();
    const content = this.markdownService.draftContent();
    if (!file || !content) return;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  private hashFileName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `draft-${Math.abs(hash)}`;
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/services/editor.service.ts
git commit -m "feat: create EditorService with IndexedDB auto-save"
```

---

## Task 4: Create PdfService

**Files:**
- Create: `src/app/services/pdf.service.ts`

- [ ] **Step 1: Create the PdfService**

Write `src/app/services/pdf.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { MarkdownService } from './markdown.service';

export interface PdfExportOptions {
  style: 'web' | 'document';
  pageFormat: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  includeToc: boolean;
  pageNumbers: boolean;
  headerFileName: boolean;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  private markdownService = inject(MarkdownService);

  async exportToPdf(contentElement: HTMLElement, options: PdfExportOptions): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;

    const container = document.createElement('div');
    container.innerHTML = contentElement.innerHTML;
    this.applyStyle(container, options);

    if (options.includeToc) {
      const tocHtml = this.generateTocHtml(container);
      container.insertAdjacentHTML('afterbegin', tocHtml);
    }

    const pdfOptions = {
      margin: options.style === 'document' ? [20, 20, 20, 20] : [10, 10, 10, 10],
      filename: options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: {
        unit: 'mm',
        format: options.pageFormat,
        orientation: options.orientation,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(pdfOptions).from(container).save();
  }

  private applyStyle(container: HTMLElement, options: PdfExportOptions): void {
    if (options.style === 'document') {
      container.style.fontFamily = 'Georgia, "Times New Roman", serif';
      container.style.color = '#111';
      container.style.lineHeight = '1.8';
      container.style.fontSize = '12pt';

      container.querySelectorAll('.terminal-block').forEach(block => {
        const el = block as HTMLElement;
        el.style.background = '#f5f5f5';
        el.style.border = '1px solid #ddd';
        el.style.borderRadius = '4px';
        el.style.padding = '12px';
        const header = el.querySelector('.terminal-header') as HTMLElement;
        if (header) header.style.display = 'none';
      });

      container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        const el = heading as HTMLElement;
        el.style.color = '#111';
        el.style.fontFamily = 'Georgia, "Times New Roman", serif';
      });

      container.querySelectorAll('a').forEach(link => {
        const el = link as HTMLElement;
        el.style.color = '#111';
        el.style.textDecoration = 'underline';
      });

      container.querySelectorAll('h1, h2').forEach(el => {
        (el as HTMLElement).style.pageBreakBefore = 'auto';
        (el as HTMLElement).style.marginTop = '24pt';
      });
    }

    if (options.pageNumbers) {
      container.style.counterReset = 'page';
    }
  }

  private generateTocHtml(container: HTMLElement): string {
    const headings = container.querySelectorAll('h1, h2, h3');
    let tocHtml = '<div style="page-break-after: always; margin-bottom: 2rem;">';
    tocHtml += '<h1 style="text-align: center; margin-bottom: 2rem;">Table des matières</h1>';
    tocHtml += '<ul style="list-style: none; padding: 0; line-height: 2;">';

    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      const indent = (level - 1) * 20;
      const text = heading.textContent || '';
      tocHtml += `<li style="padding-left: ${indent}px; font-size: ${level === 1 ? '14pt' : '11pt'}; font-weight: ${level <= 2 ? 'bold' : 'normal'};">${text}</li>`;
    });

    tocHtml += '</ul></div>';
    return tocHtml;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/services/pdf.service.ts
git commit -m "feat: create PdfService with web and document export styles"
```

---

## Task 5: Create Custom TipTap Extensions (Mermaid, KaTeX, Embed)

**Files:**
- Create: `src/app/components/markdown-editor/extensions/mermaid.extension.ts`
- Create: `src/app/components/markdown-editor/extensions/katex.extension.ts`
- Create: `src/app/components/markdown-editor/extensions/embed.extension.ts`

- [ ] **Step 1: Create Mermaid extension**

Write `src/app/components/markdown-editor/extensions/mermaid.extension.ts`:

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: 'graph TD\n  A-->B' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid', class: 'mermaid-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('mermaid-block-wrapper');

      const renderArea = document.createElement('div');
      renderArea.classList.add('mermaid-render');
      container.appendChild(renderArea);

      const editButton = document.createElement('button');
      editButton.textContent = 'Éditer';
      editButton.classList.add('mermaid-edit-btn');
      container.appendChild(editButton);

      const renderMermaid = async (code: string) => {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
          renderArea.innerHTML = svg;
        } catch {
          renderArea.innerHTML = `<pre class="mermaid-error">${code}</pre>`;
        }
      };

      renderMermaid(node.attrs['content']);

      editButton.addEventListener('click', () => {
        const currentContent = node.attrs['content'];
        const newContent = prompt('Mermaid diagram code:', currentContent);
        if (newContent !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { content: newContent });
            return true;
          }).run();
          renderMermaid(newContent);
        }
      });

      return { dom: container };
    };
  },
});
```

- [ ] **Step 2: Create KaTeX extension**

Write `src/app/components/markdown-editor/extensions/katex.extension.ts`:

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

export const KatexBlock = Node.create({
  name: 'katexBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: 'E = mc^2' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="katex"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'katex', class: 'katex-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('katex-block-wrapper');

      const renderArea = document.createElement('div');
      renderArea.classList.add('katex-render');
      container.appendChild(renderArea);

      const editButton = document.createElement('button');
      editButton.textContent = 'Éditer';
      editButton.classList.add('katex-edit-btn');
      container.appendChild(editButton);

      const renderKatex = async (formula: string) => {
        try {
          const katex = (await import('katex')).default;
          renderArea.innerHTML = katex.renderToString(formula, {
            throwOnError: false,
            displayMode: true,
          });
        } catch {
          renderArea.innerHTML = `<pre class="katex-error">${formula}</pre>`;
        }
      };

      renderKatex(node.attrs['content']);

      editButton.addEventListener('click', () => {
        const currentContent = node.attrs['content'];
        const newContent = prompt('LaTeX formula:', currentContent);
        if (newContent !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { content: newContent });
            return true;
          }).run();
          renderKatex(newContent);
        }
      });

      return { dom: container };
    };
  },
});
```

- [ ] **Step 3: Create Embed extension**

Write `src/app/components/markdown-editor/extensions/embed.extension.ts`:

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      width: { default: '100%' },
      height: { default: '315' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'embed', class: 'embed-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('embed-block-wrapper');

      const iframe = document.createElement('iframe');
      iframe.src = node.attrs['src'];
      iframe.width = node.attrs['width'];
      iframe.height = node.attrs['height'];
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.setAttribute('allowfullscreen', '');
      container.appendChild(iframe);

      const editButton = document.createElement('button');
      editButton.textContent = 'Modifier URL';
      editButton.classList.add('embed-edit-btn');
      container.appendChild(editButton);

      editButton.addEventListener('click', () => {
        const newSrc = prompt('URL de la vidéo/embed:', node.attrs['src']);
        if (newSrc !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, src: newSrc });
            return true;
          }).run();
          iframe.src = newSrc;
        }
      });

      return { dom: container };
    };
  },
});
```

- [ ] **Step 4: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/components/markdown-editor/extensions/
git commit -m "feat: create custom TipTap extensions for Mermaid, KaTeX, and embeds"
```

---

## Task 6: Create Slash Commands Extension

**Files:**
- Create: `src/app/components/markdown-editor/extensions/slash-commands.extension.ts`

- [ ] **Step 1: Create slash commands extension**

Write `src/app/components/markdown-editor/extensions/slash-commands.extension.ts`:

```typescript
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps } from '@tiptap/suggestion';

export interface SlashCommandItem {
  title: string;
  icon: string;
  command: (props: { editor: any; range: any }) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Ordered List',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Code Block',
    icon: '</>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    icon: '❝',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Table',
    icon: '▦',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Horizontal Rule',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Mermaid Diagram',
    icon: '◈',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = editor.schema.nodes['mermaidBlock'].create({ content: 'graph TD\n  A-->B' });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    },
  },
  {
    title: 'LaTeX Formula',
    icon: '∑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = editor.schema.nodes['katexBlock'].create({ content: 'E = mc^2' });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    },
  },
  {
    title: 'Video Embed',
    icon: '▶',
    command: ({ editor, range }) => {
      const url = prompt('URL de la vidéo:');
      if (url) {
        editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
          if (dispatch) {
            const node = editor.schema.nodes['embedBlock'].create({ src: url });
            tr.replaceSelectionWith(node);
          }
          return true;
        }).run();
      }
    },
  },
  {
    title: 'Image',
    icon: '🖼',
    command: ({ editor, range }) => {
      const url = prompt("URL de l'image:");
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
];

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return slashCommandItems.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let popup: HTMLElement | null = null;
          let selectedIndex = 0;
          let items: SlashCommandItem[] = [];

          return {
            onStart: (props: SuggestionProps) => {
              popup = document.createElement('div');
              popup.classList.add('slash-command-menu');
              items = props.items as unknown as SlashCommandItem[];
              updatePopup(popup, items, selectedIndex, props);
              document.body.appendChild(popup);
              positionPopup(popup, props);
            },
            onUpdate: (props: SuggestionProps) => {
              items = props.items as unknown as SlashCommandItem[];
              selectedIndex = 0;
              if (popup) {
                updatePopup(popup, items, selectedIndex, props);
                positionPopup(popup, props);
              }
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length;
                if (popup) updatePopup(popup, items, selectedIndex, null);
                return true;
              }
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                if (popup) updatePopup(popup, items, selectedIndex, null);
                return true;
              }
              if (event.key === 'Enter') {
                if (items[selectedIndex]) {
                  items[selectedIndex].command({ editor: null, range: null });
                }
                return true;
              }
              return false;
            },
            onExit: () => {
              if (popup) {
                popup.remove();
                popup = null;
              }
            },
          };
        },
      }),
    ];
  },
});

function updatePopup(popup: HTMLElement, items: SlashCommandItem[], selectedIndex: number, props: SuggestionProps | null): void {
  popup.innerHTML = items.map((item, index) =>
    `<div class="slash-command-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
      <span class="slash-command-icon">${item.icon}</span>
      <span class="slash-command-title">${item.title}</span>
    </div>`
  ).join('');

  popup.querySelectorAll('.slash-command-item').forEach((el, index) => {
    el.addEventListener('click', () => {
      if (props && items[index]) {
        props.command(items[index] as any);
      }
    });
  });
}

function positionPopup(popup: HTMLElement, props: SuggestionProps): void {
  const rect = props.clientRect?.();
  if (rect) {
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 8}px`;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/components/markdown-editor/extensions/slash-commands.extension.ts
git commit -m "feat: create slash commands extension for quick block insertion"
```

---

## Task 7: Create MarkdownEditorComponent

**Files:**
- Create: `src/app/components/markdown-editor/markdown-editor.component.ts`
- Create: `src/app/components/markdown-editor/markdown-editor.component.html`
- Create: `src/app/components/markdown-editor/markdown-editor.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Write `src/app/components/markdown-editor/markdown-editor.component.ts`:

```typescript
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import { NgxTiptapModule } from 'ngx-tiptap';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { MarkdownService } from '../../services/markdown.service';
import { EditorService } from '../../services/editor.service';
import { MermaidBlock } from './extensions/mermaid.extension';
import { KatexBlock } from './extensions/katex.extension';
import { EmbedBlock } from './extensions/embed.extension';
import { SlashCommands } from './extensions/slash-commands.extension';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxTiptapModule],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {
  private markdownService = inject(MarkdownService);
  private editorService = inject(EditorService);

  editor!: Editor;
  bubbleMenuEditor!: Editor;

  readonly saveStatus = this.editorService.saveStatus;
  readonly cursorPosition = this.editorService.cursorPosition;

  ngOnInit(): void {
    const lowlight = createLowlight(common);

    this.editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        Link.configure({ openOnClick: false }),
        Image,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        CodeBlockLowlight.configure({ lowlight }),
        BubbleMenu,
        Placeholder.configure({ placeholder: 'Tapez "/" pour insérer un bloc...' }),
        Markdown,
        MermaidBlock,
        KatexBlock,
        EmbedBlock,
        SlashCommands,
      ],
      content: '',
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown();
        this.markdownService.setDraftContent(markdown);
      },
      onSelectionUpdate: ({ editor }) => {
        const { from } = editor.state.selection;
        const resolved = editor.state.doc.resolve(from);
        this.editorService.setCursorPosition(resolved.depth, from);
      },
    });

    const file = this.markdownService.activeFile();
    if (file) {
      this.loadContent(file.content);
    }

    this.editorService.init();
  }

  loadContent(markdown: string): void {
    this.editor.commands.setContent(markdown);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // Toolbar actions
  toggleBold(): void { this.editor.chain().focus().toggleBold().run(); }
  toggleItalic(): void { this.editor.chain().focus().toggleItalic().run(); }
  toggleUnderline(): void { this.editor.chain().focus().toggleUnderline().run(); }
  toggleStrike(): void { this.editor.chain().focus().toggleStrike().run(); }
  toggleBulletList(): void { this.editor.chain().focus().toggleBulletList().run(); }
  toggleOrderedList(): void { this.editor.chain().focus().toggleOrderedList().run(); }
  toggleTaskList(): void { this.editor.chain().focus().toggleTaskList().run(); }
  toggleBlockquote(): void { this.editor.chain().focus().toggleBlockquote().run(); }
  toggleCodeBlock(): void { this.editor.chain().focus().toggleCodeBlock().run(); }
  setHorizontalRule(): void { this.editor.chain().focus().setHorizontalRule().run(); }
  undo(): void { this.editor.chain().focus().undo().run(); }
  redo(): void { this.editor.chain().focus().redo().run(); }

  setHeading(level: 1 | 2 | 3 | 4 | 5 | 6): void {
    this.editor.chain().focus().toggleHeading({ level }).run();
  }

  insertTable(): void {
    this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  insertImage(): void {
    const url = prompt("URL de l'image:");
    if (url) {
      this.editor.chain().focus().setImage({ src: url }).run();
    }
  }

  insertLink(): void {
    const url = prompt('URL du lien:');
    if (url) {
      this.editor.chain().focus().setLink({ href: url }).run();
    }
  }

  insertMermaid(): void {
    const content = prompt('Code Mermaid:', 'graph TD\n  A-->B');
    if (content) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['mermaidBlock'].create({ content });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  insertKatex(): void {
    const content = prompt('Formule LaTeX:', 'E = mc^2');
    if (content) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['katexBlock'].create({ content });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  insertEmbed(): void {
    const src = prompt('URL vidéo/embed:');
    if (src) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['embedBlock'].create({ src });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  setColor(color: string): void {
    this.editor.chain().focus().setColor(color).run();
  }

  toggleHighlight(color: string): void {
    this.editor.chain().focus().toggleHighlight({ color }).run();
  }

  downloadFile(): void {
    this.editorService.downloadMarkdown();
  }
}
```

- [ ] **Step 2: Create the component template**

Write `src/app/components/markdown-editor/markdown-editor.component.html`:

```html
<div class="editor-container">
  <!-- Fixed Toolbar -->
  <div class="editor-toolbar">
    <!-- Text Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="setHeading(1)" [class.active]="editor.isActive('heading', {level: 1})" title="Heading 1">H1</button>
      <button class="toolbar-btn" (click)="setHeading(2)" [class.active]="editor.isActive('heading', {level: 2})" title="Heading 2">H2</button>
      <button class="toolbar-btn" (click)="setHeading(3)" [class.active]="editor.isActive('heading', {level: 3})" title="Heading 3">H3</button>
    </div>

    <span class="toolbar-divider"></span>

    <!-- Format Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="toggleBold()" [class.active]="editor.isActive('bold')" title="Gras (Ctrl+B)"><b>B</b></button>
      <button class="toolbar-btn" (click)="toggleItalic()" [class.active]="editor.isActive('italic')" title="Italique (Ctrl+I)"><i>I</i></button>
      <button class="toolbar-btn" (click)="toggleUnderline()" [class.active]="editor.isActive('underline')" title="Souligné (Ctrl+U)"><u>U</u></button>
      <button class="toolbar-btn" (click)="toggleStrike()" [class.active]="editor.isActive('strike')" title="Barré"><s>S</s></button>
      <button class="toolbar-btn color-btn" title="Couleur du texte">
        <span class="color-indicator" style="background: currentColor;"></span>
        <input type="color" (input)="setColor($any($event.target).value)" class="color-input">
        A
      </button>
      <button class="toolbar-btn color-btn" title="Surlignage">
        <input type="color" value="#ffff00" (input)="toggleHighlight($any($event.target).value)" class="color-input">
        <span class="highlight-icon">H</span>
      </button>
    </div>

    <span class="toolbar-divider"></span>

    <!-- Lists Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="toggleBulletList()" [class.active]="editor.isActive('bulletList')" title="Liste à puces">•</button>
      <button class="toolbar-btn" (click)="toggleOrderedList()" [class.active]="editor.isActive('orderedList')" title="Liste numérotée">1.</button>
      <button class="toolbar-btn" (click)="toggleTaskList()" [class.active]="editor.isActive('taskList')" title="Checklist">☑</button>
    </div>

    <span class="toolbar-divider"></span>

    <!-- Blocks Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="toggleBlockquote()" [class.active]="editor.isActive('blockquote')" title="Citation">❝</button>
      <button class="toolbar-btn" (click)="toggleCodeBlock()" [class.active]="editor.isActive('codeBlock')" title="Bloc de code">&lt;/&gt;</button>
      <button class="toolbar-btn" (click)="insertTable()" title="Tableau">▦</button>
      <button class="toolbar-btn" (click)="setHorizontalRule()" title="Séparateur">—</button>
    </div>

    <span class="toolbar-divider"></span>

    <!-- Insert Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="insertImage()" title="Image">🖼</button>
      <button class="toolbar-btn" (click)="insertLink()" title="Lien">🔗</button>
      <button class="toolbar-btn" (click)="insertMermaid()" title="Diagramme Mermaid">◈</button>
      <button class="toolbar-btn" (click)="insertKatex()" title="Formule LaTeX">∑</button>
      <button class="toolbar-btn" (click)="insertEmbed()" title="Embed vidéo">▶</button>
    </div>

    <span class="toolbar-divider"></span>

    <!-- Actions Group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" (click)="undo()" title="Annuler (Ctrl+Z)">↩</button>
      <button class="toolbar-btn" (click)="redo()" title="Rétablir (Ctrl+Y)">↪</button>
      <button class="toolbar-btn save-btn" (click)="downloadFile()" title="Télécharger .md (Ctrl+S)">💾</button>
    </div>
  </div>

  <!-- TipTap Editor -->
  <div class="editor-content">
    <tiptap-editor [editor]="editor"></tiptap-editor>

    <!-- Bubble Menu -->
    <tiptap-bubble-menu [editor]="editor" class="bubble-menu">
      <button (click)="toggleBold()" [class.active]="editor.isActive('bold')"><b>B</b></button>
      <button (click)="toggleItalic()" [class.active]="editor.isActive('italic')"><i>I</i></button>
      <button (click)="toggleUnderline()" [class.active]="editor.isActive('underline')"><u>U</u></button>
      <button (click)="insertLink()">🔗</button>
      <button (click)="toggleCodeBlock()">code</button>
    </tiptap-bubble-menu>
  </div>
</div>
```

- [ ] **Step 3: Create the component styles**

Write `src/app/components/markdown-editor/markdown-editor.component.scss`:

```scss
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  background: var(--hi-bg-neutral);
  border-bottom: 1px solid var(--hi-border);
  flex-wrap: wrap;
  gap: 0.25rem;
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--hi-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all var(--hi-transition);

  &:hover {
    background: var(--hi-primary-subtle);
    color: var(--hi-primary);
  }

  &.active {
    background: var(--hi-primary-subtle);
    color: var(--hi-primary);
    font-weight: 600;
  }

  &.save-btn {
    width: auto;
    padding: 0 8px;
  }
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--hi-border);
  margin: 0 0.35rem;
}

.color-btn {
  position: relative;
  overflow: hidden;
}

.color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;

  :host ::ng-deep {
    .tiptap {
      outline: none;
      min-height: 100%;
      font-family: var(--hi-font);
      font-size: 0.9rem;
      line-height: 1.7;
      color: var(--hi-text-primary);

      > * + * {
        margin-top: 0.75em;
      }

      h1, h2, h3, h4, h5, h6 {
        color: var(--hi-primary);
        font-weight: 600;
      }

      h1 { font-size: 1.8rem; }
      h2 { font-size: 1.5rem; }
      h3 { font-size: 1.25rem; }

      pre {
        background: var(--hi-bg-neutral);
        border: 1px solid var(--hi-border);
        border-radius: var(--hi-radius);
        padding: 1rem;
        overflow-x: auto;

        code {
          font-family: var(--hi-font-mono);
          font-size: 0.85rem;
        }
      }

      blockquote {
        border-left: 3px solid var(--hi-primary);
        padding-left: 1rem;
        color: var(--hi-text-secondary);
        margin-left: 0;
      }

      table {
        border-collapse: collapse;
        width: 100%;

        td, th {
          border: 1px solid var(--hi-border);
          padding: 0.5rem 0.75rem;
        }

        th {
          background: var(--hi-bg-neutral);
          font-weight: 600;
        }
      }

      ul[data-type="taskList"] {
        list-style: none;
        padding-left: 0;

        li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;

          input[type="checkbox"] {
            accent-color: var(--hi-primary);
            margin-top: 0.25rem;
          }
        }
      }

      img {
        max-width: 100%;
        border-radius: var(--hi-radius);
      }

      a {
        color: var(--hi-primary);
        text-decoration: underline;
      }

      .is-empty::before {
        content: attr(data-placeholder);
        color: var(--hi-text-tertiary);
        pointer-events: none;
        float: left;
        height: 0;
      }
    }
  }
}

// Bubble menu
:host ::ng-deep .bubble-menu {
  display: flex;
  gap: 2px;
  background: var(--hi-bg-neutral);
  border: 1px solid var(--hi-border);
  border-radius: var(--hi-radius);
  padding: 4px;
  box-shadow: var(--hi-shadow-md);

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--hi-text-secondary);
    font-size: 0.8rem;
    cursor: pointer;

    &:hover {
      background: var(--hi-primary-subtle);
      color: var(--hi-primary);
    }

    &.active {
      background: var(--hi-primary-subtle);
      color: var(--hi-primary);
    }
  }
}

// Custom block styles
:host ::ng-deep {
  .mermaid-block-wrapper,
  .katex-block-wrapper,
  .embed-block-wrapper {
    position: relative;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid var(--hi-border);
    border-radius: var(--hi-radius);
    background: var(--hi-bg-neutral);

    .mermaid-edit-btn,
    .katex-edit-btn,
    .embed-edit-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      font-size: 0.7rem;
      border: 1px solid var(--hi-border);
      border-radius: 4px;
      background: var(--hi-bg);
      color: var(--hi-text-secondary);
      cursor: pointer;

      &:hover {
        border-color: var(--hi-primary);
        color: var(--hi-primary);
      }
    }
  }
}

// Slash command menu
:host ::ng-deep .slash-command-menu {
  background: var(--hi-bg);
  border: 1px solid var(--hi-border);
  border-radius: var(--hi-radius);
  box-shadow: var(--hi-shadow-lg);
  padding: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  min-width: 200px;
  z-index: 1000;

  .slash-command-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;

    &:hover, &.selected {
      background: var(--hi-primary-subtle);
      color: var(--hi-primary);
    }

    .slash-command-icon {
      width: 24px;
      text-align: center;
      font-size: 0.9rem;
    }
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/components/markdown-editor/
git commit -m "feat: create MarkdownEditorComponent with TipTap, toolbar, and bubble menu"
```

---

## Task 8: Create EditorStatusBarComponent

**Files:**
- Create: `src/app/components/editor-status-bar/editor-status-bar.component.ts`

- [ ] **Step 1: Create the status bar component**

Write `src/app/components/editor-status-bar/editor-status-bar.component.ts`:

```typescript
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorService } from '../../services/editor.service';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-editor-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-bar">
      <span class="status-save" [class.saved]="saveStatus() === 'saved'" [class.saving]="saveStatus() === 'saving'">
        @if (saveStatus() === 'saved') {
          ✓ Sauvegardé
        } @else if (saveStatus() === 'saving') {
          ⟳ Sauvegarde...
        } @else {
          ● Non sauvegardé
        }
      </span>
      <span class="status-separator">|</span>
      <span class="status-cursor">Ligne {{ cursorPosition().line }}, Col {{ cursorPosition().col }}</span>
      <span class="status-separator">|</span>
      <span class="status-size">{{ fileSize() }}</span>
    </div>
  `,
  styles: [`
    .status-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.3rem 1rem;
      background: var(--hi-bg-neutral);
      border-top: 1px solid var(--hi-border);
      font-size: 0.75rem;
      color: var(--hi-text-tertiary);
      flex-shrink: 0;
    }
    .status-save {
      &.saved { color: var(--hi-primary); }
      &.saving { color: var(--hi-secondary); }
    }
    .status-separator {
      color: var(--hi-border);
    }
  `],
})
export class EditorStatusBarComponent {
  private editorService = inject(EditorService);
  private markdownService = inject(MarkdownService);

  readonly saveStatus = this.editorService.saveStatus;
  readonly cursorPosition = this.editorService.cursorPosition;

  readonly fileSize = computed(() => {
    const content = this.markdownService.draftContent();
    if (!content) return '0 B';
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/components/editor-status-bar/editor-status-bar.component.ts
git commit -m "feat: create EditorStatusBarComponent showing save state, cursor, and file size"
```

---

## Task 9: Create PdfExportDialogComponent

**Files:**
- Create: `src/app/components/pdf-export-dialog/pdf-export-dialog.component.ts`
- Create: `src/app/components/pdf-export-dialog/pdf-export-dialog.component.html`
- Create: `src/app/components/pdf-export-dialog/pdf-export-dialog.component.scss`

- [ ] **Step 1: Create the dialog component TypeScript**

Write `src/app/components/pdf-export-dialog/pdf-export-dialog.component.ts`:

```typescript
import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MarkdownService } from '../../services/markdown.service';
import { PdfService, PdfExportOptions } from '../../services/pdf.service';

@Component({
  selector: 'app-pdf-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    CheckboxModule,
    InputTextModule,
    RadioButtonModule,
  ],
  templateUrl: './pdf-export-dialog.component.html',
  styleUrl: './pdf-export-dialog.component.scss',
})
export class PdfExportDialogComponent {
  private markdownService = inject(MarkdownService);
  private pdfService = inject(PdfService);

  visible = signal(false);
  exporting = signal(false);

  style: 'web' | 'document' = 'web';
  pageFormat: 'a4' | 'letter' = 'a4';
  orientation: 'portrait' | 'landscape' = 'portrait';
  includeToc = true;
  pageNumbers = true;
  headerFileName = false;
  fileName = '';

  pageFormats = [
    { label: 'A4', value: 'a4' },
    { label: 'Letter', value: 'letter' },
  ];

  orientations = [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Paysage', value: 'landscape' },
  ];

  open(): void {
    const file = this.markdownService.activeFile();
    if (file) {
      this.fileName = file.name.replace(/\.md$/, '');
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  async exportPdf(): Promise<void> {
    this.exporting.set(true);

    const contentEl = document.querySelector('.markdown-body') as HTMLElement;
    if (!contentEl) {
      this.exporting.set(false);
      return;
    }

    const options: PdfExportOptions = {
      style: this.style,
      pageFormat: this.pageFormat,
      orientation: this.orientation,
      includeToc: this.includeToc,
      pageNumbers: this.pageNumbers,
      headerFileName: this.headerFileName,
      fileName: this.fileName,
    };

    await this.pdfService.exportToPdf(contentEl, options);
    this.exporting.set(false);
    this.close();
  }
}
```

- [ ] **Step 2: Create the dialog template**

Write `src/app/components/pdf-export-dialog/pdf-export-dialog.component.html`:

```html
<p-dialog
  header="Exporter en PDF"
  [(visible)]="visible"
  [modal]="true"
  [style]="{ width: '500px' }"
  [closable]="true"
  [draggable]="false">

  <!-- Style Selection -->
  <div class="export-section">
    <label class="section-label">Style d'export</label>
    <div class="style-options">
      <div class="style-card" [class.selected]="style === 'web'" (click)="style = 'web'">
        <p-radioButton name="style" value="web" [(ngModel)]="style"></p-radioButton>
        <div class="style-info">
          <span class="style-title">Style Web</span>
          <span class="style-desc">Fidèle à l'affichage dans l'app</span>
        </div>
        <div class="style-preview web-preview">
          <div class="preview-heading">Titre</div>
          <div class="preview-text">Texte avec <span class="preview-link">lien</span></div>
          <div class="preview-code-web">code</div>
        </div>
      </div>

      <div class="style-card" [class.selected]="style === 'document'" (click)="style = 'document'">
        <p-radioButton name="style" value="document" [(ngModel)]="style"></p-radioButton>
        <div class="style-info">
          <span class="style-title">Style Document</span>
          <span class="style-desc">Sobre et imprimable</span>
        </div>
        <div class="style-preview doc-preview">
          <div class="preview-heading">Titre</div>
          <div class="preview-text">Texte avec <span class="preview-link">lien</span></div>
          <div class="preview-code-doc">code</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Options -->
  <div class="export-section">
    <label class="section-label">Options</label>
    <div class="options-grid">
      <div class="option-field">
        <label>Format de page</label>
        <p-dropdown [options]="pageFormats" [(ngModel)]="pageFormat" optionLabel="label" optionValue="value"></p-dropdown>
      </div>
      <div class="option-field">
        <label>Orientation</label>
        <p-dropdown [options]="orientations" [(ngModel)]="orientation" optionLabel="label" optionValue="value"></p-dropdown>
      </div>
    </div>

    <div class="checkboxes">
      <div class="checkbox-row">
        <p-checkbox [(ngModel)]="includeToc" [binary]="true" inputId="toc"></p-checkbox>
        <label for="toc">Inclure la table des matières en première page</label>
      </div>
      <div class="checkbox-row">
        <p-checkbox [(ngModel)]="pageNumbers" [binary]="true" inputId="pageNumbers"></p-checkbox>
        <label for="pageNumbers">Numéros de page en pied de page</label>
      </div>
      <div class="checkbox-row">
        <p-checkbox [(ngModel)]="headerFileName" [binary]="true" inputId="header"></p-checkbox>
        <label for="header">Nom du fichier en en-tête</label>
      </div>
    </div>
  </div>

  <!-- Filename -->
  <div class="export-section">
    <label class="section-label">Nom du fichier</label>
    <div class="filename-field">
      <input type="text" pInputText [(ngModel)]="fileName" class="filename-input">
      <span class="filename-ext">.pdf</span>
    </div>
  </div>

  <!-- Footer -->
  <ng-template pTemplate="footer">
    <p-button label="Annuler" [text]="true" (onClick)="close()"></p-button>
    <p-button label="Exporter PDF" icon="pi pi-download" (onClick)="exportPdf()" [loading]="exporting()"></p-button>
  </ng-template>
</p-dialog>
```

- [ ] **Step 3: Create the dialog styles**

Write `src/app/components/pdf-export-dialog/pdf-export-dialog.component.scss`:

```scss
.export-section {
  margin-bottom: 1.25rem;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--hi-text-tertiary);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.style-options {
  display: flex;
  gap: 0.75rem;
}

.style-card {
  flex: 1;
  border: 2px solid var(--hi-border);
  border-radius: var(--hi-radius);
  padding: 0.75rem;
  cursor: pointer;
  transition: border-color var(--hi-transition);

  &.selected {
    border-color: var(--hi-primary);
  }

  &:hover:not(.selected) {
    border-color: var(--hi-border-hover);
  }
}

.style-info {
  margin: 0.5rem 0;

  .style-title {
    display: block;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .style-desc {
    font-size: 0.75rem;
    color: var(--hi-text-tertiary);
  }
}

.style-preview {
  border-radius: 4px;
  padding: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.65rem;
}

.web-preview {
  background: var(--hi-bg-neutral);

  .preview-heading {
    color: var(--hi-primary);
    font-weight: bold;
  }

  .preview-link {
    color: var(--hi-primary);
  }

  .preview-code-web {
    background: #1a1a2e;
    color: #7ec8c0;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    margin-top: 4px;
  }
}

.doc-preview {
  background: #fafafa;

  .preview-heading {
    color: #111;
    font-weight: bold;
    font-family: Georgia, serif;
  }

  .preview-text {
    color: #333;
    font-family: Georgia, serif;
  }

  .preview-link {
    text-decoration: underline;
    color: #111;
  }

  .preview-code-doc {
    background: #f0f0f0;
    border: 1px solid #ddd;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    margin-top: 4px;
    color: #333;
  }
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.option-field {
  label {
    display: block;
    font-size: 0.8rem;
    color: var(--hi-text-secondary);
    margin-bottom: 0.25rem;
  }

  :host ::ng-deep .p-dropdown {
    width: 100%;
  }
}

.checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.filename-field {
  display: flex;
  align-items: center;
  gap: 0;

  .filename-input {
    flex: 1;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .filename-ext {
    padding: 0.5rem 0.75rem;
    background: var(--hi-bg-neutral);
    border: 1px solid var(--hi-border);
    border-left: none;
    border-radius: 0 var(--hi-radius) var(--hi-radius) 0;
    color: var(--hi-text-tertiary);
    font-size: 0.85rem;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pdf-export-dialog/
git commit -m "feat: create PdfExportDialogComponent with style selection and export options"
```

---

## Task 10: Modify MarkdownViewerComponent for Preview Mode

**Files:**
- Modify: `src/app/components/markdown-viewer/markdown-viewer.component.ts`

- [ ] **Step 1: Add optional content input for live preview**

Modify `src/app/components/markdown-viewer/markdown-viewer.component.ts` to accept an optional `previewContent` input that overrides the active file content when in edit mode:

Add import at top:
```typescript
import { Component, inject, computed, ElementRef, AfterViewInit, OnDestroy, effect, input } from '@angular/core';
```

Add input signal inside the class:
```typescript
previewContent = input<string | undefined>(undefined);
```

Modify `renderedHtml` computed to use `previewContent` when available:
```typescript
renderedHtml = computed<SafeHtml>(() => {
  const preview = this.previewContent();
  const file = this.activeFile();
  const content = preview ?? file?.content;
  if (!content) return '';
  const html = this.renderMarkdown(content);
  const highlighted = this.highlightSearchTerm(html);
  return this.sanitizer.bypassSecurityTrustHtml(highlighted);
});
```

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/components/markdown-viewer/markdown-viewer.component.ts
git commit -m "feat: add previewContent input to MarkdownViewerComponent for live preview"
```

---

## Task 11: Update AppComponent with Edit Mode and Split View

**Files:**
- Modify: `src/app/app.component.ts`
- Modify: `src/app/app.component.html`
- Modify: `src/app/app.component.scss`

- [ ] **Step 1: Update AppComponent TypeScript**

Replace `src/app/app.component.ts` with:

```typescript
import { Component, signal, ViewChild, inject } from '@angular/core';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { SharedModule } from 'primeng/api';
import { FileLoaderComponent } from './components/file-loader/file-loader.component';
import { FileSidebarComponent } from './components/file-sidebar/file-sidebar.component';
import { TocSidebarComponent } from './components/toc-sidebar/toc-sidebar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { MarkdownEditorComponent } from './components/markdown-editor/markdown-editor.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { PdfExportDialogComponent } from './components/pdf-export-dialog/pdf-export-dialog.component';
import { EditorStatusBarComponent } from './components/editor-status-bar/editor-status-bar.component';
import { MarkdownService } from './services/markdown.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarModule,
    ButtonModule,
    SharedModule,
    FileLoaderComponent,
    FileSidebarComponent,
    TocSidebarComponent,
    MarkdownViewerComponent,
    MarkdownEditorComponent,
    SearchBarComponent,
    PdfExportDialogComponent,
    EditorStatusBarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild(FileLoaderComponent) fileLoader!: FileLoaderComponent;
  @ViewChild(PdfExportDialogComponent) pdfDialog!: PdfExportDialogComponent;

  private markdownService = inject(MarkdownService);

  darkTheme = signal(false);
  dragOver = signal(false);

  readonly editMode = this.markdownService.editMode;
  readonly draftContent = this.markdownService.draftContent;
  readonly activeFile = this.markdownService.activeFile;

  toggleTheme(): void {
    this.darkTheme.update(v => !v);
    const themeLink = document.getElementById('theme-link') as HTMLLinkElement;

    if (this.darkTheme()) {
      document.body.classList.add('dark-theme');
      themeLink.href = 'themes/lara-dark-blue/theme.css';
    } else {
      document.body.classList.remove('dark-theme');
      themeLink.href = 'themes/lara-light-blue/theme.css';
    }
  }

  toggleEditMode(): void {
    this.markdownService.toggleEditMode();
  }

  openPdfExport(): void {
    this.pdfDialog.open();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.fileLoader.onDrop(event);
  }
}
```

- [ ] **Step 2: Update AppComponent template**

Replace `src/app/app.component.html` with:

```html
<div class="app-layout"
  [class.drag-over]="dragOver()"
  [class.edit-mode]="editMode()"
  (dragover)="onDragOver($event)"
  (dragleave)="onDragLeave()"
  (drop)="onDrop($event)">
  <p-toolbar class="app-toolbar">
    <ng-template pTemplate="start">
      <div class="toolbar-brand">
        <i class="pi pi-book" style="font-size: 1.25rem; color: var(--hi-primary);"></i>
        <span class="toolbar-title">Markdown Viewer</span>
      </div>
      <app-file-loader></app-file-loader>
    </ng-template>
    <ng-template pTemplate="center">
      <app-search-bar></app-search-bar>
    </ng-template>
    <ng-template pTemplate="end">
      <p-button
        icon="pi pi-pencil"
        [rounded]="true"
        [text]="!editMode()"
        [severity]="editMode() ? undefined : 'secondary'"
        (onClick)="toggleEditMode()"
        pTooltip="Mode édition"
        [disabled]="!activeFile()">
      </p-button>
      <p-button
        icon="pi pi-file-pdf"
        [rounded]="true"
        [text]="true"
        severity="secondary"
        (onClick)="openPdfExport()"
        pTooltip="Exporter en PDF"
        [disabled]="!activeFile()">
      </p-button>
      <p-button
        [icon]="darkTheme() ? 'pi pi-sun' : 'pi pi-moon'"
        [rounded]="true"
        [text]="true"
        (onClick)="toggleTheme()">
      </p-button>
    </ng-template>
  </p-toolbar>

  <aside class="toc-sidebar">
    <app-toc-sidebar></app-toc-sidebar>
  </aside>

  @if (editMode()) {
    <div class="split-view">
      <div class="editor-panel">
        <app-markdown-editor></app-markdown-editor>
      </div>
      <div class="split-divider"></div>
      <div class="preview-panel">
        <div class="panel-label">Aperçu</div>
        <app-markdown-viewer [previewContent]="draftContent()"></app-markdown-viewer>
      </div>
    </div>
    <app-editor-status-bar></app-editor-status-bar>
  } @else {
    <main class="main-content">
      <app-markdown-viewer></app-markdown-viewer>
    </main>
  }

  <aside class="file-sidebar">
    <app-file-sidebar></app-file-sidebar>
  </aside>

  <app-pdf-export-dialog></app-pdf-export-dialog>
</div>
```

- [ ] **Step 3: Update AppComponent styles**

Add to `src/app/app.component.scss`:

```scss
:host {
  display: block;
  height: 100vh;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 1.25rem;
}

.toolbar-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--hi-text-primary);
  letter-spacing: -0.01em;
}
```

- [ ] **Step 4: Update global styles for split view**

Add the following to `src/styles.scss` (after the `.main-content` block around line 171):

```scss
/* ===== Edit Mode Layout ===== */
.app-layout.edit-mode {
  grid-template-columns: 220px 1fr 220px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "toc split files"
    "header header header";
}

.split-view {
  grid-area: main;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.editor-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.split-divider {
  width: 3px;
  background: var(--hi-primary);
  cursor: col-resize;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity var(--hi-transition);

  &:hover {
    opacity: 1;
  }
}

.preview-panel {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: var(--hi-bg);
  position: relative;
}

.panel-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--hi-text-tertiary);
  margin-bottom: 0.75rem;
  font-weight: 600;
}

app-editor-status-bar {
  grid-column: 1 / -1;
}
```

- [ ] **Step 5: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/app.component.ts src/app/app.component.html src/app/app.component.scss src/styles.scss
git commit -m "feat: integrate edit mode split view and PDF export into AppComponent"
```

---

## Task 12: Add KaTeX CSS to Angular Configuration

**Files:**
- Modify: `angular.json`

- [ ] **Step 1: Add KaTeX stylesheet**

In `angular.json`, locate the `styles` array inside `projects > markdown-viewer > architect > build > options` and add the KaTeX CSS:

```json
"styles": [
  "node_modules/katex/dist/katex.min.css",
  "src/styles.scss"
]
```

(Keep existing entries, just prepend the katex line before `src/styles.scss`)

- [ ] **Step 2: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add angular.json
git commit -m "chore: add KaTeX CSS to angular.json styles"
```

---

## Task 13: Add .superpowers to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add entry**

Add to `.gitignore`:
```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Build the application**

```bash
cd C:/tools/Demo-Projects/markdown-viewer
npx ng build --configuration development
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and test manually**

```bash
npx ng serve --open
```

Test the following in the browser:
1. Load a `.md` file
2. Click the "Éditer" button → verify split view appears with editor on left, preview on right
3. Type in the editor → verify preview updates in real-time
4. Use toolbar buttons (bold, heading, list) → verify they work
5. Type `/` → verify slash command menu appears
6. Click "Export PDF" → verify modal opens with options
7. Select "Style Web" → export → verify PDF downloads
8. Select "Style Document" → export → verify PDF downloads with different style
9. Wait 5s → verify "Sauvegardé" status appears
10. Reload page → verify draft recovery prompt appears

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from end-to-end testing"
```
