import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { MarkdownService } from './markdown.service';

interface DraftEntry {
  id: string;
  fileName: string;
  markdownContent: string;
  lastModified: number;
  isDirty: boolean;
}

@Injectable({ providedIn: 'root' })
export class EditorService implements OnDestroy {
  private markdownService = inject(MarkdownService);
  private db: IDBPDatabase | null = null;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private lastSavedContent = '';

  readonly saveStatus = signal<'saved' | 'unsaved' | 'saving'>('saved');
  readonly cursorPosition = signal<{ line: number; col: number }>({ line: 1, col: 1 });

  async init(): Promise<void> {
    this.db = await openDB('markdown-editor-drafts', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
      },
    });
    this.startAutoSave();
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveDraft();
    }, 5000);
  }

  async saveDraft(): Promise<void> {
    const file = this.markdownService.activeFile();
    const content = this.markdownService.draftContent();
    if (!file || !content || content === this.lastSavedContent) return;

    this.saveStatus.set('saving');
    const id = this.hashFileName(file.name);
    const entry: DraftEntry = {
      id,
      fileName: file.name,
      markdownContent: content,
      lastModified: Date.now(),
      isDirty: true,
    };

    if (this.db) {
      await this.db.put('drafts', entry);
    }
    this.lastSavedContent = content;
    this.saveStatus.set('saved');
  }

  async loadDraft(fileName: string): Promise<DraftEntry | undefined> {
    if (!this.db) return undefined;
    const id = this.hashFileName(fileName);
    return this.db.get('drafts', id);
  }

  async deleteDraft(fileName: string): Promise<void> {
    if (!this.db) return;
    const id = this.hashFileName(fileName);
    await this.db.delete('drafts', id);
  }

  setCursorPosition(line: number, col: number): void {
    this.cursorPosition.set({ line, col });
  }

  downloadMarkdown(): void {
    const file = this.markdownService.activeFile();
    const content = this.markdownService.draftContent();
    if (!file || !content) return;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  private hashFileName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `draft-${Math.abs(hash)}`;
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}
