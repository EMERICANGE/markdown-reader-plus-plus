import { Injectable, inject, signal } from '@angular/core';
import { ImageStorageService } from './image-storage.service';
import { MarkdownReconstructorService, PdfPageData, PdfTextItem } from './markdown-reconstructor.service';
import { MarkdownFile } from '../models/markdown-file.model';

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
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';

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
        const OPS = pdfjsLib.OPS;
        let imgIndex = 0;
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === OPS.paintImageXObject || ops.fnArray[i] === OPS.paintInlineImageXObject) {
            try {
              const imgName = ops.argsArray[i][0];
              const img = await (page.objs as any).get(imgName);
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
