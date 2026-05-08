# PDF to Markdown Conversion — Design Spec

## Overview

Add PDF import capability to the markdown-viewer app. Users can import any PDF (text-based or scanned) and get a well-structured markdown file with images preserved.

## Constraints

- 100% client-side (no backend)
- Images stored in IndexedDB with blob URLs
- OCR fallback for scanned pages (Tesseract.js)
- Intelligent reconstruction (not raw text dump)

## Architecture

```
[PDF File] → [PdfImportService]
                 ├── PDF.js (text extraction + metadata + images)
                 ├── MarkdownReconstructor (intelligent assembly)
                 └── Tesseract.js (OCR fallback for image-only pages)
             → [MarkdownFile] → added to MarkdownService
```

## New Components

### PdfImportService (`services/pdf-import.service.ts`)

Orchestrator service responsible for:
- Loading PDF via pdfjs-dist
- Iterating pages and extracting structured text content (positions, font sizes, font names)
- Extracting embedded images from each page
- Detecting image-only pages (text content < 10 chars) and triggering OCR
- Coordinating with MarkdownReconstructor and ImageStorageService
- Emitting progress events for the UI

### MarkdownReconstructor (`services/markdown-reconstructor.service.ts`)

Transforms raw PDF.js text items into clean markdown:
- **Headings:** Detected by relative font size (largest = h1, second = h2, etc.)
- **Paragraphs:** Consecutive lines at same size/font merged into single paragraphs
- **Lists:** Detected by indentation + bullet/number prefixes
- **Bold/Italic:** Detected via fontName metadata (contains "Bold"/"Italic")
- **Tables:** Detected by vertical/horizontal cell alignment patterns
- **Links:** Detected via PDF annotation data
- **Line break cleanup:** Remove arbitrary line breaks within logical paragraphs

### ImageStorageService (`services/image-storage.service.ts`)

Manages image persistence:
- Stores extracted images in IndexedDB (using existing `idb` dependency)
- Returns blob URLs for markdown references
- Associates images with their parent markdown file (for cleanup on delete)
- Key format: `img-${fileHash}-${pageNum}-${imgIndex}`

### PdfImportDialogComponent (`components/pdf-import-dialog/`)

PrimeNG dialog with:
- File selection (accept `.pdf`)
- Progress bar with status messages ("Extracting page 3/12…", "OCR in progress…")
- Markdown preview of the result (rendered via existing markdown-viewer)
- "Import" button to confirm and add to file list
- "Cancel" button to abort

## User Flow

1. User clicks "Import PDF" button (in file-sidebar toolbar)
2. Dialog opens → user selects a PDF file
3. Progress displayed in real-time:
   - Page-by-page extraction
   - OCR indicator when fallback activates
4. Preview of generated markdown shown in dialog
5. User clicks "Import" → file added to MarkdownService as a regular MarkdownFile
6. Images stored in IndexedDB, referenced via blob URLs in markdown content

## OCR Strategy

- Per-page detection: if PDF.js extracts < 10 characters from a page, it's considered image-only
- Image-only pages are rendered to canvas at 300 DPI, then sent to Tesseract.js
- Tesseract.js worker loaded lazily (only downloaded if OCR is needed)
- Language: French + English by default (configurable)

## Markdown Reconstruction Rules

### Heading Detection
- Group all unique font sizes found in the document
- Map top 3 sizes to h1, h2, h3 (relative to document, not absolute)
- Text at these sizes that appears on its own line = heading

### Paragraph Assembly
- Text items on consecutive lines with same font size and name = same paragraph
- Large vertical gaps between items = paragraph break
- Items with different font size or on a clearly separate line = new block

### List Detection
- Lines starting with `•`, `-`, `*`, or `1.`, `2.` patterns = list items
- Indentation level determines nesting

### Table Detection
- Multiple text items aligned in consistent columns across consecutive rows
- Convert to markdown table with `|` separators and alignment row

### Bold/Italic
- fontName containing "Bold" → wrap in `**`
- fontName containing "Italic" or "Oblique" → wrap in `*`
- fontName containing both → wrap in `***`

## Dependencies to Add

| Package | Purpose | Load Strategy |
|---------|---------|---------------|
| `pdfjs-dist` | PDF parsing and text extraction | Eager (imported in PdfImportService) |
| `tesseract.js` | OCR for scanned pages | Lazy (loaded only when OCR needed) |

## Integration Points

- **MarkdownService:** `addFile()` used to add converted file to the app
- **IndexedDB (idb):** Existing dependency reused for image storage
- **PrimeNG:** Dialog, ProgressBar, Button components for the import modal
- **File-sidebar:** New "Import PDF" button added to toolbar

## Error Handling

- Corrupted/password-protected PDF → show error message in dialog
- OCR timeout (>60s per page) → skip page with warning, continue others
- Large PDF (>50 pages) → show warning, allow user to select page range
- Image extraction failure → skip image, add placeholder `[Image extraction failed]`

## Performance Considerations

- PDF.js worker runs in Web Worker (non-blocking)
- Tesseract.js runs in Web Worker (non-blocking)
- Progress updates via signals/observables for reactive UI
- Large PDFs: process pages sequentially to limit memory usage
- Blob URLs revoked on file deletion to prevent memory leaks
