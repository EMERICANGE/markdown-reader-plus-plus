import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { MarkdownService } from '../../services/markdown.service';
import { MarkdownFile } from '../../models/markdown-file.model';

@Component({
  selector: 'app-file-loader',
  standalone: true,
  imports: [ButtonModule, ConfirmDialogModule],
  template: `
    <p-button
      icon="pi pi-upload"
      label="Charger"
      [outlined]="true"
      (onClick)="fileInput.click()">
    </p-button>
    <p-button
      icon="pi pi-folder-open"
      label="Dossier"
      [outlined]="true"
      (onClick)="folderInput.click()"
      class="ml-2">
    </p-button>

    <input
      #fileInput
      type="file"
      accept=".md"
      multiple
      hidden
      (change)="onFilesSelected($event)"
    />
    <input
      #folderInput
      type="file"
      webkitdirectory
      hidden
      (change)="onFilesSelected($event)"
    />

    <p-confirmDialog></p-confirmDialog>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `],
})
export class FileLoaderComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;

  private markdownService = inject(MarkdownService);
  private confirmationService = inject(ConfirmationService);

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const mdFiles = Array.from(input.files).filter(f => f.name.endsWith('.md'));
    if (mdFiles.length === 0) return;

    this.readFiles(mdFiles).then(files => {
      if (this.markdownService.files().length === 0) {
        this.markdownService.addFiles(files);
        this.autoSelectFirst(files);
      } else {
        this.confirmationService.confirm({
          message: 'Que souhaitez-vous faire avec les fichiers existants ?',
          header: 'Chargement de fichiers',
          acceptLabel: 'Remplacer',
          rejectLabel: 'Ajouter',
          accept: () => {
            this.markdownService.replaceFiles(files);
            this.autoSelectFirst(files);
          },
          reject: () => {
            this.markdownService.addFiles(files);
          },
        });
      }
    });

    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files) return;
    const mdFiles = Array.from(event.dataTransfer.files).filter(f => f.name.endsWith('.md'));
    if (mdFiles.length === 0) return;

    this.readFiles(mdFiles).then(files => {
      if (this.markdownService.files().length === 0) {
        this.markdownService.addFiles(files);
        this.autoSelectFirst(files);
      } else {
        this.confirmationService.confirm({
          message: 'Que souhaitez-vous faire avec les fichiers existants ?',
          header: 'Chargement de fichiers',
          acceptLabel: 'Remplacer',
          rejectLabel: 'Ajouter',
          accept: () => {
            this.markdownService.replaceFiles(files);
            this.autoSelectFirst(files);
          },
          reject: () => {
            this.markdownService.addFiles(files);
          },
        });
      }
    });
  }

  private autoSelectFirst(files: MarkdownFile[]): void {
    if (files.length > 0) {
      this.markdownService.setActive(files[0]);
    }
  }

  private async readFiles(fileList: File[]): Promise<MarkdownFile[]> {
    const results: MarkdownFile[] = [];
    for (const file of fileList) {
      const content = await file.text();
      results.push({
        name: file.name,
        path: (file as any).webkitRelativePath || file.name,
        content,
      });
    }
    return results;
  }
}
