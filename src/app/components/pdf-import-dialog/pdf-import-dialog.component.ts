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
