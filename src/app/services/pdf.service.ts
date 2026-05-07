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
    pre, code { font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace; font-size: 9pt; }
    code { background: rgba(41, 154, 141, 0.08); color: #227d70; padding: 2px 5px; border-radius: 3px; font-size: 0.85em; }
    pre code { background: transparent; padding: 0; border-radius: 0; color: inherit; }

    /* Terminal-style code blocks */
    .terminal-block {
      background: #1e1e2e;
      border-radius: 12px;
      margin: 1.5em 0;
      page-break-inside: avoid;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .terminal-header {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      background: #181825;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .terminal-dots {
      display: flex;
      gap: 7px;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background: #ff5f56; }
    .dot-yellow { background: #ffbd2e; }
    .dot-green { background: #27c93f; }
    .terminal-title {
      color: rgba(255, 255, 255, 0.4);
      font-size: 8pt;
      margin-left: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    .terminal-spacer { flex: 1; }
    .terminal-pre {
      margin: 0;
      padding: 1.2em 1.5em;
      background: #1e1e2e;
      border: none;
      overflow-x: auto;
      white-space: pre;
      line-height: 1.6;
      border-radius: 0;
    }
    .terminal-pre code {
      color: #cdd6f4;
      background: transparent;
      padding: 0;
      font-size: 9pt;
      line-height: 1.6;
    }

    /* highlight.js syntax colors (One Dark / Catppuccin style) */
    .hljs-keyword { color: #cba6f7; }
    .hljs-string { color: #a6e3a1; }
    .hljs-number { color: #fab387; }
    .hljs-literal { color: #fab387; }
    .hljs-comment { color: #6c7086; font-style: italic; }
    .hljs-function { color: #89b4fa; }
    .hljs-title { color: #89b4fa; }
    .hljs-title.function_ { color: #89b4fa; }
    .hljs-built_in { color: #94e2d5; }
    .hljs-type { color: #f9e2af; }
    .hljs-class { color: #f9e2af; }
    .hljs-attr { color: #fab387; }
    .hljs-variable { color: #f38ba8; }
    .hljs-property { color: #89dceb; }
    .hljs-selector-class { color: #a6e3a1; }
    .hljs-selector-tag { color: #cba6f7; }
    .hljs-meta { color: #f5c2e7; }
    .hljs-tag { color: #89b4fa; }
    .hljs-name { color: #cba6f7; }
    .hljs-attribute { color: #fab387; }
    .hljs-params { color: #cdd6f4; }
    .hljs-punctuation { color: #bac2de; }
    .hljs-operator { color: #89dceb; }
    .hljs-regexp { color: #f38ba8; }
    a { color: ${options.style === 'document' ? '#111' : '#299a8d'}; text-decoration: ${options.style === 'document' ? 'underline' : 'none'}; cursor: pointer; }
    a[href^="#"] { color: ${options.style === 'document' ? '#333' : '#299a8d'}; text-decoration: none; border-bottom: 1px dotted currentColor; }
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
    const headings = container.querySelectorAll('h1[id], h2[id], h3[id]');
    let tocHtml = '<div class="toc-page">';
    tocHtml += '<h1>Table des matières</h1>';
    tocHtml += '<ul>';

    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      const indent = (level - 1) * 20;
      const text = heading.textContent || '';
      const id = heading.getAttribute('id') || '';
      tocHtml += `<li style="padding-left: ${indent}px; font-size: ${level === 1 ? '14pt' : '11pt'}; font-weight: ${level <= 2 ? 'bold' : 'normal'};"><a href="#${id}" style="text-decoration: none; color: inherit;">${text}</a></li>`;
    });

    tocHtml += '</ul></div>';
    return tocHtml;
  }
}
