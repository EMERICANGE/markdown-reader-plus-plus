# WYSIWYG Editor & PDF Export — Design Spec

## Overview

Add two major features to the Angular 18 Markdown Viewer app:
1. **WYSIWYG Markdown Editor** — visual editing with split view (editor + live preview)
2. **PDF Export** — export rendered markdown as PDF with two style options

## Architecture

### Approach: Enhancement in-place

The existing layout gains an `editMode` state. When active, the central panel splits into editor (left) and live preview (right). TOC and file sidebars remain visible in both modes.

### New Services

- **`EditorService`** — manages TipTap editor state, draft content, undo/redo history, auto-save logic
- **`PdfService`** — handles PDF generation with html2pdf.js, style templates, pagination

### New Components

- **`MarkdownEditorComponent`** — TipTap wrapper with fixed toolbar + BubbleMenu
- **`PdfExportDialogComponent`** — modal with style selection and export options

### Modified Components

- **`AppComponent`** — central panel switches between view-only and split view based on `editMode`
- **Toolbar** — gains "Éditer" toggle button and "Export PDF" button

### Data Flow (Edit Mode)

```
TipTap Editor → serialize to markdown → MarkdownService.draftContent signal
  → MarkdownViewerComponent (live preview)
  → IndexedDB (auto-save every 5s when content changes)
```

## Feature 1: WYSIWYG Editor

### Library

**TipTap** via `ngx-tiptap` (Angular bindings for TipTap/ProseMirror).

### Extensions

| Category | Extensions |
|----------|-----------|
| Core | StarterKit (paragraphs, headings H1-H6, bold, italic, strike, code, blockquote, lists, hard break, horizontal rule) |
| Blocks | Table, TaskList/TaskItem (checkboxes), CodeBlockLowlight (syntax highlighting) |
| Inline | Link, Image, Underline, TextStyle, Color, Highlight |
| Drag & Drop | Custom drag handle via NodeView |
| Diagrams | Custom NodeView for Mermaid (rendered via `mermaid.js`) |
| Math | Custom NodeView for LaTeX (rendered via `katex`) |
| Embeds | Custom extension for iframe/video |
| Menus | BubbleMenu (floating on selection), FloatingMenu (slash commands) |

### Toolbar (Fixed)

| Group | Actions |
|-------|---------|
| Text | H1, H2, H3, H4, H5, H6, Paragraph |
| Format | Bold, Italic, Underline, Strikethrough, Color, Highlight |
| Lists | Bullet, Ordered, Checklist |
| Blocks | Blockquote, Code Block, Table, Horizontal Rule |
| Insert | Image, Link, Mermaid Diagram, LaTeX Formula, Video Embed |
| Actions | Undo, Redo, Save (.md download), Fullscreen |

### BubbleMenu (Floating, on text selection)

Bold, Italic, Underline, Link, Color, Inline Code

### Slash Commands

Typing `/` opens a contextual menu to quickly insert: heading, table, code block, mermaid, latex, image, embed.

### Serialization

- **TipTap → Markdown:** via `tiptap-markdown` extension or custom ProseMirror serializer
- **Markdown → TipTap:** parse existing `.md` content into ProseMirror document on file open

### Layout (Edit Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar: [Logo] [Éditer(active)] [Export PDF] [Save] [Theme]    │
├─────────────────────────────────────────────────────────────────┤
│ Editor Toolbar: [H1][H2][H3]|[B][I][U][S]|[•][1.][☑]|...     │
├────────┬──────────────────┬──────────────────┬─────────────────┤
│  TOC   │  WYSIWYG Editor  │  Live Preview    │  File List      │
│        │                  │                  │                 │
│  H1    │  # Title         │  Title (rendered)│  README.md ●    │
│   H2   │  Text with       │  Text with       │  GUIDE.md       │
│   H2   │  **bold**        │  bold            │  CHANGELOG.md   │
│        │                  │                  │                 │
├────────┴──────────────────┴──────────────────┴─────────────────┤
│ Status: ✓ Saved | Line 12, Col 34 | 1.2 KB                     │
└─────────────────────────────────────────────────────────────────┘
```

## Feature 2: PDF Export

### Library

**html2pdf.js** (client-side, wraps html2canvas + jsPDF). No server required.

### Two Export Styles

| Aspect | Style "Web" | Style "Document" |
|--------|-------------|-----------------|
| Appearance | Matches app rendering (colors, terminal code blocks, teal accent) | Clean print-friendly (black/white, serif font, wide margins) |
| Code blocks | Dark background, language badges, RGB dots | Light gray background, simple border, monospace |
| Headings | App style (teal, custom font) | Academic (Georgia/Times, optional numbering) |
| Images | Original size | Resized to fit page |
| Links | Teal colored | Underlined, black |

### Export Modal Options

- **Style:** Web / Document (radio with mini-preview)
- **Page format:** A4, Letter (dropdown)
- **Orientation:** Portrait, Landscape (dropdown)
- **Include TOC:** Checkbox — generates table of contents as first page
- **Page numbers:** Checkbox — footer with page numbers
- **Header:** Checkbox — filename in header
- **Filename:** Pre-filled with original `.md` name, editable

### Export Flow

1. User clicks "Export PDF" button in toolbar
2. Modal opens with options
3. On confirm: generate hidden DOM with chosen style applied
4. html2pdf.js captures DOM → canvas → PDF
5. Auto-download the `.pdf` file

### Pagination

- `html2pdf.js` handles automatic page breaks
- CSS `page-break-before` on H1/H2 for clean splitting
- Optional header/footer on each page

## Feature 3: Persistence & Save

### Auto-save (IndexedDB)

- Saves automatically every 5 seconds when content changes
- Storage structure:
  ```json
  {
    "id": "hash-of-filename",
    "fileName": "README.md",
    "markdownContent": "# Title\n...",
    "lastModified": 1706000000000,
    "isDirty": true
  }
  ```
- Visual indicator in status bar: "✓ Sauvegardé" / "Non sauvegardé..."
- On loading a file with existing draft: prompt "Un brouillon existe, reprendre ou ignorer ?"

### Download .md

- Button "Sauvegarder" in editor toolbar
- Serializes TipTap document → pure markdown
- Downloads via `Blob` + `URL.createObjectURL` + `<a download>`
- Filename matches original (e.g., `README.md`)

### Conflict Resolution

- If user reloads same file from disk while draft exists → confirmation dialog (keep draft / overwrite with new)
- "Supprimer le brouillon" button to reset auto-save for current file

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@tiptap/core` | Editor core |
| `@tiptap/starter-kit` | Basic extensions bundle |
| `@tiptap/extension-*` | Individual extensions (table, task-list, link, image, underline, text-style, color, highlight, code-block-lowlight, bubble-menu, floating-menu) |
| `ngx-tiptap` | Angular bindings |
| `tiptap-markdown` | Markdown serialization/parsing |
| `mermaid` | Diagram rendering |
| `katex` | LaTeX formula rendering |
| `html2pdf.js` | PDF generation |
| `idb` | IndexedDB wrapper (lightweight) |
| `lowlight` | Syntax highlighting for code blocks (used by CodeBlockLowlight) |

## UI/UX Details

- Mode toggle: "Éditer" button in main toolbar, teal when active
- Split view divider: vertical teal line, draggable to resize panels
- Status bar (edit mode only): save state, cursor position, file size
- TOC updates in real-time from editor content
- File sidebar allows switching files without leaving edit mode
- Keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+S (download), etc.

## Non-Goals

- No collaborative editing (single user)
- No server-side storage or backend
- No version history beyond the current draft
- No file creation from scratch (must load a .md first, then edit)
