import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MarkdownService } from '../../services/markdown.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule, InputTextModule],
  template: `
    <span class="p-input-icon-left">
      <i class="pi pi-search"></i>
      <input
        type="text"
        pInputText
        placeholder="Rechercher..."
        [ngModel]="searchValue"
        (ngModelChange)="onSearch($event)"
      />
    </span>
  `,
})
export class SearchBarComponent {
  private markdownService = inject(MarkdownService);
  searchValue = '';

  onSearch(value: string): void {
    this.searchValue = value;
    this.markdownService.setSearchTerm(value);
  }
}
