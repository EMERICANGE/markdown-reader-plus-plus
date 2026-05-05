import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { MarkdownService } from '../../services/markdown.service';
import { MarkdownFile } from '../../models/markdown-file.model';

@Component({
  selector: 'app-file-sidebar',
  standalone: true,
  imports: [CommonModule, ListboxModule, FormsModule],
  template: `
    <h4>Fichiers</h4>
    @if (files().length === 0) {
      <p class="text-500 text-sm">Aucun fichier chargé</p>
    } @else {
      <p-listbox
        [options]="files()"
        [ngModel]="selectedFile()"
        (ngModelChange)="onSelect($event)"
        optionLabel="name"
        [filter]="true"
        filterPlaceHolder="Filtrer par nom..."
        [listStyle]="{'max-height': 'calc(100vh - 200px)'}">
      </p-listbox>
    }
  `,
  styles: [`
    :host { display: block; }
    h4 { margin: 0 0 0.5rem 0; }
  `],
})
export class FileSidebarComponent {
  private markdownService = inject(MarkdownService);

  files = this.markdownService.filteredFiles;
  selectedFile = this.markdownService.activeFile;

  onSelect(file: MarkdownFile): void {
    this.markdownService.setActive(file);
  }
}
