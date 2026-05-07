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

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = options.orientation === 'landscape' ? '297mm' : '210mm';
    wrapper.style.zIndex = '-9999';
    wrapper.style.opacity = '0';
    wrapper.style.overflow = 'visible';
    wrapper.style.pointerEvents = 'none';
    document.body.appendChild(wrapper);

    const container = document.createElement('div');
    container.innerHTML = contentElement.innerHTML;
    container.style.background = '#ffffff';
    container.style.color = '#111111';
    container.style.padding = '20px';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.fontSize = '14px';
    container.style.lineHeight = '1.6';
    container.style.width = '100%';

    // Force all text to be dark for PDF
    container.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement;
      const computed = window.getComputedStyle(htmlEl);
      if (computed.color) {
        htmlEl.style.color = htmlEl.style.color || '#111111';
      }
    });

    wrapper.appendChild(container);

    this.applyStyle(container, options);

    if (options.includeToc) {
      const tocHtml = this.generateTocHtml(container);
      container.insertAdjacentHTML('afterbegin', tocHtml);
    }

    // Force wrapper visible for html2canvas capture
    wrapper.style.opacity = '1';

    // Small delay to ensure paint
    await new Promise(resolve => setTimeout(resolve, 100));

    const pdfOptions = {
      margin: options.style === 'document' ? [20, 20, 20, 20] as [number, number, number, number] : [10, 10, 10, 10] as [number, number, number, number],
      filename: options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: options.pageFormat,
        orientation: options.orientation,
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    try {
      await html2pdf().set(pdfOptions).from(container).save();
    } finally {
      document.body.removeChild(wrapper);
    }
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
