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
    const printContent = contentElement.cloneNode(true) as HTMLElement;

    if (options.style === 'document') {
      this.applyDocumentStyle(printContent);
    }

    let tocHtml = '';
    if (options.includeToc) {
      tocHtml = this.generateTocHtml(printContent);
    }

    const pageSize = options.pageFormat === 'a4' ? '210mm 297mm' : '8.5in 11in';
    const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options.fileName}</title>
  <style>
    @page {
      size: ${options.orientation === 'landscape' ? (options.pageFormat === 'a4' ? '297mm 210mm' : '11in 8.5in') : pageSize};
      margin: ${options.style === 'document' ? '25mm' : '15mm'};
    }
    body {
      font-family: ${options.style === 'document' ? 'Georgia, "Times New Roman", serif' : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
      font-size: ${options.style === 'document' ? '12pt' : '10pt'};
      line-height: ${options.style === 'document' ? '1.8' : '1.6'};
      color: #111;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${options.style === 'document' ? '#111' : '#299a8d'};
      page-break-after: avoid;
    }
    h1, h2 { margin-top: 1.5em; }
    pre, code { font-family: "JetBrains Mono", "Fira Code", Consolas, monospace; }
    pre {
      background: ${options.style === 'document' ? '#f5f5f5' : '#1a1a2e'};
      color: ${options.style === 'document' ? '#333' : '#e0e0e0'};
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 9pt;
      page-break-inside: avoid;
      ${options.style === 'document' ? 'border: 1px solid #ddd;' : ''}
    }
    .terminal-block {
      background: ${options.style === 'document' ? '#f5f5f5' : '#1a1a2e'};
      border-radius: 6px;
      padding: 12px;
      margin: 1em 0;
      page-break-inside: avoid;
      ${options.style === 'document' ? 'border: 1px solid #ddd;' : ''}
    }
    .terminal-header { ${options.style === 'document' ? 'display: none;' : ''} }
    .terminal-pre { margin: 0; background: transparent; border: none; padding: 0; }
    a { color: ${options.style === 'document' ? '#111' : '#299a8d'}; text-decoration: ${options.style === 'document' ? 'underline' : 'none'}; }
    table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
    td, th { border: 1px solid #ddd; padding: 8px; }
    th { background: #f5f5f5; }
    img { max-width: 100%; page-break-inside: avoid; }
    blockquote { border-left: 3px solid ${options.style === 'document' ? '#999' : '#299a8d'}; padding-left: 1em; margin-left: 0; color: #555; }
    ${options.pageNumbers ? `
    @page { @bottom-center { content: counter(page); font-size: 9pt; color: #999; } }
    ` : ''}
    ${options.headerFileName ? `
    @page { @top-center { content: "${options.fileName}"; font-size: 9pt; color: #999; } }
    ` : ''}
    .toc-page { page-break-after: always; }
    .toc-page h1 { text-align: center; }
    .toc-page ul { list-style: none; padding: 0; line-height: 2.2; }
  </style>
</head>
<body>
  ${tocHtml}
  ${printContent.innerHTML}
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    await new Promise(resolve => setTimeout(resolve, 500));

    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }

  private applyDocumentStyle(container: HTMLElement): void {
    container.querySelectorAll('.terminal-header').forEach(header => {
      (header as HTMLElement).style.display = 'none';
    });
  }

  private generateTocHtml(container: HTMLElement): string {
    const headings = container.querySelectorAll('h1, h2, h3');
    let tocHtml = '<div class="toc-page">';
    tocHtml += '<h1>Table des matières</h1>';
    tocHtml += '<ul>';

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
