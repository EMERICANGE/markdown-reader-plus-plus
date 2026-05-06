import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule, InputTextModule],
  template: `
    <span class="p-input-icon-left search-container">
      <i class="pi pi-search"></i>
      <input
        type="text"
        pInputText
        placeholder="Rechercher dans le document..."
        [ngModel]="searchValue"
        (ngModelChange)="onSearch($event)"
        class="search-input"
      />
    </span>
  `,
  styles: [`
    .search-container {
      min-width: 280px;
    }
    .search-input {
      width: 100%;
      background: var(--hi-bg-neutral) !important;
      border-color: transparent !important;
      transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    .search-input:focus {
      background: var(--hi-bg) !important;
      border-color: var(--hi-primary) !important;
      box-shadow: 0 0 0 3px var(--hi-primary-subtle) !important;
    }
  `],
})
export class SearchBarComponent {
  private markdownService = inject(MarkdownService);
  searchValue = '';

  onSearch(value: string): void {
    this.searchValue = value;
    this.markdownService.setSearchTerm(value);
  }
}
