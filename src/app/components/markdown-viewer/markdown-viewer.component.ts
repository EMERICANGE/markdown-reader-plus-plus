import { Component, inject, computed, ElementRef, AfterViewInit, OnDestroy, effect, input } from '@angular/core';
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
      <div class="empty-state flex align-items-center justify-content-center h-full">
        <div class="text-center">
          <i class="pi pi-file-edit"></i>
          <p>Chargez un fichier Markdown pour commencer</p>
          <span class="hint">Glissez-déposez un fichier .md ou utilisez le bouton Charger</span>
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
    .empty-state {
      .text-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      i {
        font-size: 4rem;
      }
      .hint {
        color: var(--hi-text-tertiary);
        font-size: 0.85rem;
      }
    }
  `],
})
export class MarkdownViewerComponent implements AfterViewInit, OnDestroy {
  private markdownService = inject(MarkdownService);
  private sanitizer = inject(DomSanitizer);
  private el = inject(ElementRef);
  private markedInstance = new Marked();
  private clickListener: ((e: Event) => void) | null = null;

  activeFile = this.markdownService.activeFile;
  previewContent = input<string | undefined>(undefined);

  renderedHtml = computed<SafeHtml>(() => {
    const preview = this.previewContent();
    const file = this.activeFile();
    const content = preview ?? file?.content;
    if (!content) return '';
    const html = this.renderMarkdown(content);
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
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
          return `<h${depth} id="${id}">${text}</h${depth}>\n`;
        },
        code({ text, lang }: { text: string; lang?: string }): string {
          const language = lang || 'plaintext';
          let highlighted: string;
          if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(text, { language: lang }).value;
          } else {
            highlighted = hljs.highlightAuto(text).value;
          }
          return `<div class="terminal-block">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <span class="terminal-title">${language}</span>
              <div class="terminal-spacer"></div>
            </div>
            <pre class="terminal-pre"><code class="hljs language-${language}">${highlighted}</code></pre>
          </div>\n`;
        },
      },
    });
  }

  ngAfterViewInit(): void {
    this.clickListener = (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        const id = decodeURIComponent(href.substring(1));
        this.scrollToId(id);
      }
    };
    this.el.nativeElement.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      this.el.nativeElement.removeEventListener('click', this.clickListener);
    }
  }

  scrollToId(id: string): void {
    const element = document.getElementById(id);
    if (!element) return;

    const container = document.querySelector('.main-content');
    if (container) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollOffset = elementRect.top - containerRect.top + container.scrollTop - 16;
      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    }
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
