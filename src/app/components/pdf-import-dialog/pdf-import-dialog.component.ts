import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { PdfImportService } from '../../services/pdf-import.service';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-pdf-import-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, ProgressBarModule, InputNumberModule],
  templateUrl: './pdf-import-dialog.component.html',
  styleUrl: './pdf-import-dialog.component.scss',
})
export class PdfImportDialogComponent {
  private pdfImportService = inject(PdfImportService);
  private markdownService = inject(MarkdownService);

  visible = signal(false);
  previewContent = signal<string | null>(null);
  importReady = signal(false);
  showPageSelection = signal(false);
  pageCount = signal(0);
  pageStart = 1;
  pageEnd = 50;
  private selectedFile: File | null = null;
  private pendingFile: { name: string; path: string; content: string } | null = null;

  readonly progress = this.pdfImportService.progress;
  readonly statusMessage = this.pdfImportService.statusMessage;
  readonly error = this.pdfImportService.error;
  readonly isProcessing = this.pdfImportService.isProcessing;

  open(): void {
    this.pdfImportService.reset();
    this.previewContent.set(null);
    this.importReady.set(false);
    this.showPageSelection.set(false);
    this.selectedFile = null;
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
    this.selectedFile = file;
    input.value = '';

    try {
      const count = await this.pdfImportService.getPageCount(file);
      this.pageCount.set(count);

      if (count > 50) {
        this.pageStart = 1;
        this.pageEnd = Math.min(50, count);
        this.showPageSelection.set(true);
      } else {
        await this.startImport(file);
      }
    } catch {
      this.pdfImportService.error.set('Impossible de lire le fichier PDF.');
    }
  }

  async confirmPageSelection(): Promise<void> {
    if (this.selectedFile) {
      this.showPageSelection.set(false);
      await this.startImport(this.selectedFile, this.pageStart, this.pageEnd);
    }
  }

  private async startImport(file: File, pageStart?: number, pageEnd?: number): Promise<void> {
    const options = pageStart && pageEnd ? { pageStart, pageEnd } : undefined;
    const result = await this.pdfImportService.importPdf(file, options);

    if (result) {
      this.pendingFile = result.file;
      this.previewContent.set(result.file.content);
      this.importReady.set(true);
    }
  }

  confirmImport(): void {
    if (this.pendingFile) {
      this.markdownService.addFiles([this.pendingFile]);
      this.markdownService.setActive(this.pendingFile);
      this.close();
    }
  }
}
