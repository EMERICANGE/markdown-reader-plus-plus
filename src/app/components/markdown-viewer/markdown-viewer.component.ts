import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Marked } from 'marked';
import hljs from 'highlight.js';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-markdown-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!activeFile()) {
      <div class="flex align-items-center justify-content-center h-full">
        <div class="text-center text-500">
          <i class="pi pi-file text-6xl mb-3"></i>
          <p>Chargez un fichier Markdown pour commencer</p>
        </div>
      </div>
    } @else {
      <div class="markdown-body" [innerHTML]="renderedHtml()"></div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .markdown-body {
      line-height: 1.6;
    }
    :host ::ng-deep .markdown-body pre {
      background: var(--surface-ground);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
    }
    :host ::ng-deep .markdown-body code {
      font-family: 'Fira Code', monospace;
      font-size: 0.9em;
    }
    :host ::ng-deep .markdown-body table {
      border-collapse: collapse;
      width: 100%;
    }
    :host ::ng-deep .markdown-body th,
    :host ::ng-deep .markdown-body td {
      border: 1px solid var(--surface-border);
      padding: 0.5rem;
    }
    :host ::ng-deep .markdown-body img {
      max-width: 100%;
    }
  `],
})
export class MarkdownViewerComponent {
  private markdownService = inject(MarkdownService);
  private sanitizer = inject(DomSanitizer);
  private markedInstance = new Marked();

  activeFile = this.markdownService.activeFile;

  renderedHtml = computed<SafeHtml>(() => {
    const file = this.activeFile();
    if (!file) return '';
    const html = this.renderMarkdown(file.content);
    const highlighted = this.highlightSearchTerm(html);
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  });

  constructor() {
    this.markedInstance.use({
      gfm: true,
      breaks: true,
      renderer: {
        heading({ text, depth }: { text: string; depth: number }): string {
          const id = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
          return `<h${depth} id="${id}">${text}</h${depth}>`;
        },
        code({ text, lang }: { text: string; lang?: string }): string {
          if (lang && hljs.getLanguage(lang)) {
            const highlighted = hljs.highlight(text, { language: lang }).value;
            return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
          }
          const highlighted = hljs.highlightAuto(text).value;
          return `<pre><code class="hljs">${highlighted}</code></pre>`;
        },
      },
    });
  }

  private renderMarkdown(content: string): string {
    return this.markedInstance.parse(content, { async: false }) as string;
  }

  private highlightSearchTerm(html: string): string {
    const term = this.markdownService.searchTerm();
    if (!term) return html;

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?![^<]*>)(${escapedTerm})`, 'gi');
    return html.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
}
