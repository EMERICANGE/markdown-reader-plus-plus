import { Component, inject, signal } from '@angular/core';
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
