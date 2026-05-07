import { Injectable, computed, signal } from '@angular/core';
import { MarkdownFile, TocHeading } from '../models/markdown-file.model';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private _files = signal<MarkdownFile[]>([]);
  private _activeFile = signal<MarkdownFile | null>(null);
  private _searchTerm = signal<string>('');
  private _editMode = signal<boolean>(false);
  private _draftContent = signal<string>('');

  readonly files = this._files.asReadonly();
  readonly activeFile = this._activeFile.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();
  readonly editMode = this._editMode.asReadonly();
  readonly draftContent = this._draftContent.asReadonly();

  readonly headings = computed<TocHeading[]>(() => {
    const file = this._activeFile();
    if (!file) return [];
    return this.extractHeadings(file.content);
  });

  readonly filteredFiles = computed<MarkdownFile[]>(() => {
    const term = this._searchTerm().toLowerCase();
    if (!term) return this._files();
    return this._files().filter(f => f.name.toLowerCase().includes(term));
  });

  addFiles(files: MarkdownFile[]): void {
    this._files.update(current => [...current, ...files]);
  }

  replaceFiles(files: MarkdownFile[]): void {
    this._files.set(files);
    this._activeFile.set(null);
  }

  setActive(file: MarkdownFile): void {
    this._activeFile.set(file);
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  toggleEditMode(): void {
    this._editMode.update(v => !v);
    if (this._editMode()) {
      const file = this._activeFile();
      if (file) {
        this._draftContent.set(file.content);
      }
    }
  }

  setEditMode(value: boolean): void {
    this._editMode.set(value);
  }

  setDraftContent(content: string): void {
    this._draftContent.set(content);
  }

  private extractHeadings(content: string): TocHeading[] {
    const regex = /^(#{1,6})\s+(.+)$/gm;
    const headings: TocHeading[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        id: this.slugify(match[2].trim()),
      });
    }
    return headings;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
