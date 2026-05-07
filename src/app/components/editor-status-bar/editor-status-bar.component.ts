import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorService } from '../../services/editor.service';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-editor-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-bar">
      <span class="status-save" [class.saved]="saveStatus() === 'saved'" [class.saving]="saveStatus() === 'saving'">
        @if (saveStatus() === 'saved') {
          ✓ Sauvegardé
        } @else if (saveStatus() === 'saving') {
          ⟳ Sauvegarde...
        } @else {
          ● Non sauvegardé
        }
      </span>
      <span class="status-separator">|</span>
      <span class="status-cursor">Ligne {{ cursorPosition().line }}, Col {{ cursorPosition().col }}</span>
      <span class="status-separator">|</span>
      <span class="status-size">{{ fileSize() }}</span>
    </div>
  `,
  styles: [`
    .status-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.3rem 1rem;
      background: var(--hi-bg-neutral);
      border-top: 1px solid var(--hi-border);
      font-size: 0.75rem;
      color: var(--hi-text-tertiary);
      flex-shrink: 0;
    }
    .status-save {
      &.saved { color: var(--hi-primary); }
      &.saving { color: var(--hi-secondary); }
    }
    .status-separator {
      color: var(--hi-border);
    }
  `],
})
export class EditorStatusBarComponent {
  private editorService = inject(EditorService);
  private markdownService = inject(MarkdownService);

  readonly saveStatus = this.editorService.saveStatus;
  readonly cursorPosition = this.editorService.cursorPosition;

  readonly fileSize = computed(() => {
    const content = this.markdownService.draftContent();
    if (!content) return '0 B';
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  });
}
