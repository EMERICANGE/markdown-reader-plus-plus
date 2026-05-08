import { Component, signal, ViewChild, inject } from '@angular/core';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { SharedModule } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { FileLoaderComponent } from './components/file-loader/file-loader.component';
import { FileSidebarComponent } from './components/file-sidebar/file-sidebar.component';
import { TocSidebarComponent } from './components/toc-sidebar/toc-sidebar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { MarkdownEditorComponent } from './components/markdown-editor/markdown-editor.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { PdfExportDialogComponent } from './components/pdf-export-dialog/pdf-export-dialog.component';
import { PdfImportDialogComponent } from './components/pdf-import-dialog/pdf-import-dialog.component';
import { EditorStatusBarComponent } from './components/editor-status-bar/editor-status-bar.component';
import { MarkdownService } from './services/markdown.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarModule,
    ButtonModule,
    SharedModule,
    TooltipModule,
    FileLoaderComponent,
    FileSidebarComponent,
    TocSidebarComponent,
    MarkdownViewerComponent,
    MarkdownEditorComponent,
    SearchBarComponent,
    PdfExportDialogComponent,
    PdfImportDialogComponent,
    EditorStatusBarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild(FileLoaderComponent) fileLoader!: FileLoaderComponent;
  @ViewChild(PdfExportDialogComponent) pdfDialog!: PdfExportDialogComponent;
  @ViewChild(PdfImportDialogComponent) pdfImportDialog!: PdfImportDialogComponent;

  private markdownService = inject(MarkdownService);

  darkTheme = signal(false);
  dragOver = signal(false);

  readonly editMode = this.markdownService.editMode;
  readonly draftContent = this.markdownService.draftContent;
  readonly activeFile = this.markdownService.activeFile;

  toggleTheme(): void {
    this.darkTheme.update(v => !v);
    const themeLink = document.getElementById('theme-link') as HTMLLinkElement;

    if (this.darkTheme()) {
      document.body.classList.add('dark-theme');
      themeLink.href = 'themes/lara-dark-blue/theme.css';
    } else {
      document.body.classList.remove('dark-theme');
      themeLink.href = 'themes/lara-light-blue/theme.css';
    }
  }

  toggleEditMode(): void {
    this.markdownService.toggleEditMode();
  }

  openPdfExport(): void {
    this.pdfDialog.open();
  }

  openPdfImport(): void {
    this.pdfImportDialog.open();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.fileLoader.onDrop(event);
  }
}
