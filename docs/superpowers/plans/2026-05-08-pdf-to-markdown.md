# PDF-to-Markdown Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side PDF import with OCR fallback that converts any PDF (text or scanned) into structured markdown with images stored in IndexedDB.

**Architecture:** PdfImportService orchestrates PDF.js for text/image extraction, MarkdownReconstructor for intelligent markdown assembly, and lazy-loaded Tesseract.js for OCR on image-only pages. Images go to IndexedDB via ImageStorageService and are referenced with blob URLs.

**Tech Stack:** Angular 18, pdfjs-dist, tesseract.js, idb (existing), PrimeNG Dialog/ProgressBar, Angular Signals

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/app/services/image-storage.service.ts` | IndexedDB image CRUD, blob URL lifecycle |
| `src/app/services/markdown-reconstructor.service.ts` | PDF text items → structured markdown |
| `src/app/services/pdf-import.service.ts` | Orchestrator: PDF.js + OCR + reconstruction |
| `src/app/components/pdf-import-dialog/pdf-import-dialog.component.ts` | Import UI: file select, progress, preview |
| `src/app/components/pdf-import-dialog/pdf-import-dialog.component.html` | Template |
| `src/app/components/pdf-import-dialog/pdf-import-dialog.component.scss` | Styles |
| `src/app/app.component.ts` | Add import for PdfImportDialogComponent |
| `src/app/app.component.html` | Add "Import PDF" button + dialog tag |

---

### Task 1: Install Dependencies and Configure PDF.js Worker

**Files:**
- Modify: `package.json`
- Modify: `angular.json` (assets section)

- [ ] **Step 1: Install pdfjs-dist and tesseract.js**

```bash
npm install pdfjs-dist tesseract.js
```

- [ ] **Step 2: Configure PDF.js worker in angular.json assets**

In `angular.json`, under `projects.markdown-viewer.architect.build.options.assets`, add the PDF.js worker file so it's available at runtime:

```json
{
  "glob": "pdf.worker.min.mjs",
  "input": "node_modules/pdfjs-dist/build",
  "output": "/"
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json angular.json
git commit -m "feat: add pdfjs-dist and tesseract.js dependencies"
```

---

### Task 2: ImageStorageService

**Files:**
- Create: `src/app/services/image-storage.service.ts`
- Test: `src/app/services/image-storage.service.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/services/image-storage.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ImageStorageService } from './image-storage.service';

describe('ImageStorageService', () => {
  let service: ImageStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve an image', async () => {
    await service.init();
    const blob = new Blob(['fake-image'], { type: 'image/png' });
    const url = await service.storeImage('file-hash-1', 1, 0, blob);
    expect(url).toMatch(/^blob:/);
  });

  it('should delete images for a file', async () => {
    await service.init();
    const blob = new Blob(['fake-image'], { type: 'image/png' });
    await service.storeImage('file-hash-2', 1, 0, blob);
    await service.storeImage('file-hash-2', 1, 1, blob);
    await service.deleteImagesForFile('file-hash-2');
    const urls = await service.getImageUrlsForFile('file-hash-2');
    expect(urls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: FAIL — ImageStorageService not found.

- [ ] **Step 3: Implement ImageStorageService**

```typescript
// src/app/services/image-storage.service.ts
import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

interface StoredImage {
  id: string;
  fileHash: string;
  pageNum: number;
  imgIndex: number;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class ImageStorageService {
  private db: IDBPDatabase | null = null;
  private blobUrls = new Map<string, string>();

  async init(): Promise<void> {
    this.db = await openDB('markdown-viewer-images', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'id' });
          store.createIndex('byFileHash', 'fileHash', { unique: false });
        }
      },
    });
  }

  async storeImage(fileHash: string, pageNum: number, imgIndex: number, blob: Blob): Promise<string> {
    if (!this.db) await this.init();
    const id = `img-${fileHash}-${pageNum}-${imgIndex}`;
    const entry: StoredImage = { id, fileHash, pageNum, imgIndex, blob };
    await this.db!.put('images', entry);
    const url = URL.createObjectURL(blob);
    this.blobUrls.set(id, url);
    return url;
  }

  async getImageUrlsForFile(fileHash: string): Promise<string[]> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    return entries.map(entry => {
      const existing = this.blobUrls.get(entry.id);
      if (existing) return existing;
      const url = URL.createObjectURL(entry.blob);
      this.blobUrls.set(entry.id, url);
      return url;
    });
  }

  async deleteImagesForFile(fileHash: string): Promise<void> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    for (const entry of entries) {
      const url = this.blobUrls.get(entry.id);
      if (url) {
        URL.revokeObjectURL(url);
        this.blobUrls.delete(entry.id);
      }
      await this.db!.delete('images', entry.id);
    }
  }

  async restoreUrlsForFile(fileHash: string): Promise<Map<string, string>> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    const urlMap = new Map<string, string>();
    for (const entry of entries) {
      const url = URL.createObjectURL(entry.blob);
      this.blobUrls.set(entry.id, url);
      urlMap.set(entry.id, url);
    }
    return urlMap;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/image-storage.service.ts src/app/services/image-storage.service.spec.ts
git commit -m "feat: add ImageStorageService for IndexedDB image persistence"
```

---

### Task 3: MarkdownReconstructor Service

**Files:**
- Create: `src/app/services/markdown-reconstructor.service.ts`
- Test: `src/app/services/markdown-reconstructor.service.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/services/markdown-reconstructor.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { MarkdownReconstructorService, PdfTextItem, PdfPageData } from './markdown-reconstructor.service';

describe('MarkdownReconstructorService', () => {
  let service: MarkdownReconstructorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkdownReconstructorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect headings by font size', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Main Title', fontSize: 24, fontName: 'Arial-Bold', x: 50, y: 700, width: 200, height: 24 },
        { str: 'Some body text here.', fontSize: 12, fontName: 'Arial', x: 50, y: 650, width: 300, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('# Main Title');
    expect(result).toContain('Some body text here.');
  });

  it('should detect bold and italic from font names', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Normal ', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 50, height: 12 },
        { str: 'bold text', fontSize: 12, fontName: 'Arial-Bold', x: 100, y: 700, width: 60, height: 12 },
        { str: ' and ', fontSize: 12, fontName: 'Arial', x: 160, y: 700, width: 30, height: 12 },
        { str: 'italic text', fontSize: 12, fontName: 'Arial-Italic', x: 190, y: 700, width: 70, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('**bold text**');
    expect(result).toContain('*italic text*');
  });

  it('should detect bullet lists', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: '• First item', fontSize: 12, fontName: 'Arial', x: 70, y: 700, width: 100, height: 12 },
        { str: '• Second item', fontSize: 12, fontName: 'Arial', x: 70, y: 680, width: 110, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('- First item');
    expect(result).toContain('- Second item');
  });

  it('should merge consecutive lines into paragraphs', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'This is the start of a', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 200, height: 12 },
        { str: 'paragraph that continues.', fontSize: 12, fontName: 'Arial', x: 50, y: 686, width: 200, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('This is the start of a paragraph that continues.');
  });

  it('should insert image references', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Text before image.', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 150, height: 12 },
      ],
      imageRefs: ['blob:http://localhost/img-abc-1-0'],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('![](blob:http://localhost/img-abc-1-0)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: FAIL — MarkdownReconstructorService not found.

- [ ] **Step 3: Implement MarkdownReconstructorService**

```typescript
// src/app/services/markdown-reconstructor.service.ts
import { Injectable } from '@angular/core';

export interface PdfTextItem {
  str: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageData {
  pageNum: number;
  textItems: PdfTextItem[];
  imageRefs: string[];
}

interface TextLine {
  items: PdfTextItem[];
  y: number;
  fontSize: number;
  fontName: string;
}

@Injectable({ providedIn: 'root' })
export class MarkdownReconstructorService {

  reconstruct(pages: PdfPageData[]): string {
    const allItems = pages.flatMap(p => p.textItems);
    const fontSizeMap = this.buildFontSizeMap(allItems);
    const markdownParts: string[] = [];

    for (const page of pages) {
      const lines = this.groupIntoLines(page.textItems);
      const pageMarkdown = this.processLines(lines, fontSizeMap);
      markdownParts.push(pageMarkdown);

      if (page.imageRefs.length > 0) {
        for (const imgUrl of page.imageRefs) {
          markdownParts.push(`\n![](${imgUrl})\n`);
        }
      }
    }

    return markdownParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private buildFontSizeMap(items: PdfTextItem[]): Map<number, 'h1' | 'h2' | 'h3' | 'body'> {
    const sizes = [...new Set(items.map(i => i.fontSize))].sort((a, b) => b - a);
    const map = new Map<number, 'h1' | 'h2' | 'h3' | 'body'>();

    if (sizes.length === 0) return map;

    const bodySize = this.findBodySize(items);

    for (const size of sizes) {
      if (size > bodySize * 1.8) {
        map.set(size, 'h1');
      } else if (size > bodySize * 1.4) {
        map.set(size, 'h2');
      } else if (size > bodySize * 1.15) {
        map.set(size, 'h3');
      } else {
        map.set(size, 'body');
      }
    }

    return map;
  }

  private findBodySize(items: PdfTextItem[]): number {
    const sizeCount = new Map<number, number>();
    for (const item of items) {
      sizeCount.set(item.fontSize, (sizeCount.get(item.fontSize) || 0) + item.str.length);
    }
    let maxCount = 0;
    let bodySize = 12;
    for (const [size, count] of sizeCount) {
      if (count > maxCount) {
        maxCount = count;
        bodySize = size;
      }
    }
    return bodySize;
  }

  private groupIntoLines(items: PdfTextItem[]): TextLine[] {
    if (items.length === 0) return [];

    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextLine[] = [];
    let currentLine: TextLine = {
      items: [sorted[0]],
      y: sorted[0].y,
      fontSize: sorted[0].fontSize,
      fontName: sorted[0].fontName,
    };

    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      if (Math.abs(item.y - currentLine.y) < item.height * 0.5) {
        currentLine.items.push(item);
      } else {
        lines.push(currentLine);
        currentLine = { items: [item], y: item.y, fontSize: item.fontSize, fontName: item.fontName };
      }
    }
    lines.push(currentLine);

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }

    return lines;
  }

  private processLines(lines: TextLine[], fontSizeMap: Map<number, string>): string {
    const output: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineText = this.buildLineText(line.items);
      const strippedText = lineText.replace(/\*+/g, '').trim();
      const headingLevel = fontSizeMap.get(line.fontSize);

      if (this.isBulletLine(strippedText)) {
        const bulletText = this.extractBulletText(strippedText);
        output.push(`- ${bulletText}`);
        i++;
      } else if (this.isNumberedLine(strippedText)) {
        output.push(strippedText);
        i++;
      } else if (headingLevel === 'h1' || headingLevel === 'h2' || headingLevel === 'h3') {
        const prefix = headingLevel === 'h1' ? '# ' : headingLevel === 'h2' ? '## ' : '### ';
        output.push(`\n${prefix}${strippedText}\n`);
        i++;
      } else {
        let paragraph = lineText;
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextText = this.buildLineText(nextLine.items).replace(/\*+/g, '').trim();
          const nextHeading = fontSizeMap.get(nextLine.fontSize);
          const gap = line.y - nextLine.y;

          if (nextHeading && nextHeading !== 'body') break;
          if (this.isBulletLine(nextText)) break;
          if (this.isNumberedLine(nextText)) break;
          if (gap > line.fontSize * 2.5) break;

          paragraph += ' ' + this.buildLineText(nextLine.items);
          i++;
        }
        output.push(paragraph.trim());
      }
    }

    return output.join('\n');
  }

  private buildLineText(items: PdfTextItem[]): string {
    let result = '';
    for (const item of items) {
      const text = item.str;
      if (!text.trim()) {
        result += ' ';
        continue;
      }
      const isBold = /bold/i.test(item.fontName);
      const isItalic = /italic|oblique/i.test(item.fontName);

      if (isBold && isItalic) {
        result += `***${text}***`;
      } else if (isBold) {
        result += `**${text}**`;
      } else if (isItalic) {
        result += `*${text}*`;
      } else {
        result += text;
      }
    }
    return result;
  }

  private isBulletLine(text: string): boolean {
    return /^[•\-\*]\s+/.test(text);
  }

  private isNumberedLine(text: string): boolean {
    return /^\d+[\.\)]\s+/.test(text);
  }

  private extractBulletText(text: string): string {
    return text.replace(/^[•\-\*]\s+/, '');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/markdown-reconstructor.service.ts src/app/services/markdown-reconstructor.service.spec.ts
git commit -m "feat: add MarkdownReconstructorService for intelligent PDF text assembly"
```

---

### Task 4: PdfImportService (Orchestrator)

**Files:**
- Create: `src/app/services/pdf-import.service.ts`
- Test: `src/app/services/pdf-import.service.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/services/pdf-import.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { PdfImportService } from './pdf-import.service';

describe('PdfImportService', () => {
  let service: PdfImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial progress at 0', () => {
    expect(service.progress()).toBe(0);
  });

  it('should have empty status initially', () => {
    expect(service.statusMessage()).toBe('');
  });

  it('should report error for invalid file', async () => {
    const fakeFile = new File(['not a pdf'], 'test.txt', { type: 'text/plain' });
    const result = await service.importPdf(fakeFile);
    expect(result).toBeNull();
    expect(service.error()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: FAIL — PdfImportService not found.

- [ ] **Step 3: Implement PdfImportService**

```typescript
// src/app/services/pdf-import.service.ts
import { Injectable, inject, signal } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { ImageStorageService } from './image-storage.service';
import { MarkdownReconstructorService, PdfPageData, PdfTextItem } from './markdown-reconstructor.service';
import { MarkdownFile } from '../models/markdown-file.model';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';

export interface PdfImportResult {
  file: MarkdownFile;
  pageCount: number;
  ocrPages: number[];
}

@Injectable({ providedIn: 'root' })
export class PdfImportService {
  private imageStorage = inject(ImageStorageService);
  private reconstructor = inject(MarkdownReconstructorService);

  readonly progress = signal<number>(0);
  readonly statusMessage = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly isProcessing = signal<boolean>(false);

  async importPdf(file: File): Promise<PdfImportResult | null> {
    this.reset();

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.error.set('Le fichier sélectionné n\'est pas un PDF valide.');
      return null;
    }

    this.isProcessing.set(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const fileHash = this.hashString(file.name + file.size);
      const pages: PdfPageData[] = [];
      const ocrPages: number[] = [];

      await this.imageStorage.init();

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        this.statusMessage.set(`Extraction page ${pageNum}/${totalPages}…`);
        this.progress.set(Math.round((pageNum / totalPages) * 80));

        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        const textItems: PdfTextItem[] = textContent.items
          .filter((item: any) => item.str && item.str.trim())
          .map((item: any) => ({
            str: item.str,
            fontSize: Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12,
            fontName: item.fontName || '',
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height || Math.abs(item.transform[0]) || 12,
          }));

        const imageRefs: string[] = [];

        // Extract embedded images
        const ops = await page.getOperatorList();
        let imgIndex = 0;
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[i] === pdfjsLib.OPS.paintJpegXObject) {
            try {
              const imgName = ops.argsArray[i][0];
              const img = await page.objs.get(imgName);
              if (img && img.data) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                const imgData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
                ctx.putImageData(imgData, 0, 0);
                const blob = await new Promise<Blob>((resolve) => {
                  canvas.toBlob(b => resolve(b!), 'image/png');
                });
                const url = await this.imageStorage.storeImage(fileHash, pageNum, imgIndex, blob);
                imageRefs.push(url);
                imgIndex++;
              }
            } catch {
              imageRefs.push('[Image extraction failed]');
            }
          }
        }

        // Check if page needs OCR (< 10 chars of text)
        const totalText = textItems.map(i => i.str).join('').trim();
        if (totalText.length < 10) {
          ocrPages.push(pageNum);
          this.statusMessage.set(`OCR page ${pageNum}/${totalPages}…`);
          const ocrText = await this.performOcr(page, viewport);
          if (ocrText) {
            textItems.push({
              str: ocrText,
              fontSize: 12,
              fontName: 'OCR',
              x: 0,
              y: viewport.height,
              width: viewport.width,
              height: 12,
            });
          }
        }

        pages.push({ pageNum, textItems, imageRefs });
        page.cleanup();
      }

      this.statusMessage.set('Reconstruction du markdown…');
      this.progress.set(90);

      const markdown = this.reconstructor.reconstruct(pages);

      this.progress.set(100);
      this.statusMessage.set('Terminé');
      this.isProcessing.set(false);

      const fileName = file.name.replace(/\.pdf$/i, '.md');
      const result: PdfImportResult = {
        file: { name: fileName, path: fileName, content: markdown },
        pageCount: totalPages,
        ocrPages,
      };

      return result;
    } catch (err: any) {
      const message = err?.message || 'Erreur lors de l\'import du PDF';
      if (message.includes('password')) {
        this.error.set('Ce PDF est protégé par un mot de passe.');
      } else {
        this.error.set(message);
      }
      this.isProcessing.set(false);
      return null;
    }
  }

  private async performOcr(page: any, viewport: any): Promise<string | null> {
    try {
      const scale = 300 / 72; // 300 DPI
      const scaledViewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('fra+eng');
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      return text.trim() || null;
    } catch {
      return null;
    }
  }

  reset(): void {
    this.progress.set(0);
    this.statusMessage.set('');
    this.error.set(null);
    this.isProcessing.set(false);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/pdf-import.service.ts src/app/services/pdf-import.service.spec.ts
git commit -m "feat: add PdfImportService orchestrating PDF.js extraction and OCR"
```

---

### Task 5: PdfImportDialogComponent

**Files:**
- Create: `src/app/components/pdf-import-dialog/pdf-import-dialog.component.ts`
- Create: `src/app/components/pdf-import-dialog/pdf-import-dialog.component.html`
- Create: `src/app/components/pdf-import-dialog/pdf-import-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript file**

```typescript
// src/app/components/pdf-import-dialog/pdf-import-dialog.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { PdfImportService } from '../../services/pdf-import.service';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-pdf-import-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, ProgressBarModule],
  templateUrl: './pdf-import-dialog.component.html',
  styleUrl: './pdf-import-dialog.component.scss',
})
export class PdfImportDialogComponent {
  private pdfImportService = inject(PdfImportService);
  private markdownService = inject(MarkdownService);

  visible = signal(false);
  previewContent = signal<string | null>(null);
  importReady = signal(false);
  private pendingFile: { name: string; path: string; content: string } | null = null;

  readonly progress = this.pdfImportService.progress;
  readonly statusMessage = this.pdfImportService.statusMessage;
  readonly error = this.pdfImportService.error;
  readonly isProcessing = this.pdfImportService.isProcessing;

  open(): void {
    this.pdfImportService.reset();
    this.previewContent.set(null);
    this.importReady.set(false);
    this.pendingFile = null;
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
    this.pdfImportService.reset();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const result = await this.pdfImportService.importPdf(file);

    if (result) {
      this.pendingFile = result.file;
      this.previewContent.set(result.file.content);
      this.importReady.set(true);
    }

    input.value = '';
  }

  confirmImport(): void {
    if (this.pendingFile) {
      this.markdownService.addFiles([this.pendingFile]);
      this.markdownService.setActive(this.pendingFile);
      this.close();
    }
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/pdf-import-dialog/pdf-import-dialog.component.html -->
<p-dialog
  header="Importer un PDF"
  [visible]="visible()"
  (visibleChange)="visible.set($event)"
  [modal]="true"
  [style]="{ width: '600px' }"
  [closable]="true"
  [draggable]="false">

  <!-- File Selection -->
  @if (!isProcessing() && !importReady()) {
    <div class="import-section">
      <label class="section-label">Sélectionnez un fichier PDF</label>
      <div class="file-select-area">
        <input
          type="file"
          accept=".pdf,application/pdf"
          (change)="onFileSelected($event)"
          #fileInput
          class="hidden-input">
        <p-button
          label="Choisir un fichier"
          icon="pi pi-file-pdf"
          (onClick)="fileInput.click()">
        </p-button>
      </div>
    </div>
  }

  <!-- Error Message -->
  @if (error()) {
    <div class="error-message">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ error() }}</span>
    </div>
  }

  <!-- Progress -->
  @if (isProcessing()) {
    <div class="progress-section">
      <p-progressBar [value]="progress()" [showValue]="true"></p-progressBar>
      <p class="status-text">{{ statusMessage() }}</p>
    </div>
  }

  <!-- Preview -->
  @if (importReady() && previewContent()) {
    <div class="preview-section">
      <label class="section-label">Aperçu du markdown généré</label>
      <div class="preview-content">
        <pre>{{ previewContent() }}</pre>
      </div>
    </div>
  }

  <!-- Footer -->
  <ng-template pTemplate="footer">
    <p-button label="Annuler" [text]="true" (onClick)="close()"></p-button>
    @if (importReady()) {
      <p-button
        label="Importer"
        icon="pi pi-check"
        (onClick)="confirmImport()">
      </p-button>
    }
  </ng-template>
</p-dialog>
```

- [ ] **Step 3: Create the styles**

```scss
// src/app/components/pdf-import-dialog/pdf-import-dialog.component.scss
.import-section {
  margin-bottom: 1.5rem;
}

.section-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.file-select-area {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hidden-input {
  display: none;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: 6px;
  color: var(--red-700);
  margin-bottom: 1rem;
}

:host-context(.dark-theme) .error-message {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--red-300);
}

.progress-section {
  margin: 1.5rem 0;
}

.status-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.preview-section {
  margin-top: 1rem;
}

.preview-content {
  max-height: 300px;
  overflow-y: auto;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 1rem;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.8rem;
    font-family: 'Fira Code', 'Consolas', monospace;
    line-height: 1.5;
  }
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pdf-import-dialog/
git commit -m "feat: add PdfImportDialogComponent with progress and preview"
```

---

### Task 6: Integrate into App

**Files:**
- Modify: `src/app/app.component.ts`
- Modify: `src/app/app.component.html`

- [ ] **Step 1: Update app.component.ts — add import and ViewChild**

In `src/app/app.component.ts`:

Add to imports array:
```typescript
import { PdfImportDialogComponent } from './components/pdf-import-dialog/pdf-import-dialog.component';
```

Add to `@Component.imports`:
```typescript
PdfImportDialogComponent,
```

Add ViewChild and method to class:
```typescript
@ViewChild(PdfImportDialogComponent) pdfImportDialog!: PdfImportDialogComponent;

openPdfImport(): void {
  this.pdfImportDialog.open();
}
```

- [ ] **Step 2: Update app.component.html — add button and dialog**

In `src/app/app.component.html`, add the "Import PDF" button in the toolbar `end` section, before the existing PDF export button:

```html
<p-button
  icon="pi pi-file-import"
  [rounded]="true"
  [text]="true"
  severity="secondary"
  (onClick)="openPdfImport()"
  pTooltip="Importer un PDF">
</p-button>
```

Add the dialog component tag before the closing `</div>`:

```html
<app-pdf-import-dialog></app-pdf-import-dialog>
```

- [ ] **Step 3: Verify the build compiles**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/app.component.ts src/app/app.component.html
git commit -m "feat: integrate PDF import button and dialog into app toolbar"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Start dev server and manually test**

```bash
npx ng serve --open
```

Test the following:
1. Click "Importer un PDF" button in toolbar
2. Dialog opens with file selection
3. Select a text-based PDF → progress bar shows, preview appears
4. Click "Importer" → file added to sidebar, content displayed
5. Select a scanned PDF → OCR triggered, progress shows "OCR page X/Y"
6. Verify images appear in the markdown content

- [ ] **Step 2: Run full test suite**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end PDF import testing"
```
