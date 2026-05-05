import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  template: `<h1>Markdown Viewer</h1>`,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'markdown-viewer';
}
