import { Component, signal, ViewChild } from '@angular/core';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { SharedModule } from 'primeng/api';
import { FileLoaderComponent } from './components/file-loader/file-loader.component';
import { FileSidebarComponent } from './components/file-sidebar/file-sidebar.component';
import { TocSidebarComponent } from './components/toc-sidebar/toc-sidebar.component';
import { MarkdownViewerComponent } from './components/markdown-viewer/markdown-viewer.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarModule,
    ButtonModule,
    SharedModule,
    FileLoaderComponent,
    FileSidebarComponent,
    TocSidebarComponent,
    MarkdownViewerComponent,
    SearchBarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild(FileLoaderComponent) fileLoader!: FileLoaderComponent;

  darkTheme = signal(false);
  dragOver = signal(false);

  toggleTheme(): void {
    this.darkTheme.update(v => !v);
    const themeLink = document.getElementById('theme-link') as HTMLLinkElement;

    if (this.darkTheme()) {
      document.body.classList.add('dark-theme');
      themeLink.href = themeLink.href.replace('lara-light-blue', 'lara-dark-blue');
    } else {
      document.body.classList.remove('dark-theme');
      themeLink.href = themeLink.href.replace('lara-dark-blue', 'lara-light-blue');
    }
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
