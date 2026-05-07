import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import { NgxTiptapModule } from 'ngx-tiptap';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { MarkdownService } from '../../services/markdown.service';
import { EditorService } from '../../services/editor.service';
import { MermaidBlock } from './extensions/mermaid.extension';
import { KatexBlock } from './extensions/katex.extension';
import { EmbedBlock } from './extensions/embed.extension';
import { SlashCommands } from './extensions/slash-commands.extension';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxTiptapModule],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {
  private markdownService = inject(MarkdownService);
  private editorService = inject(EditorService);

  editor!: Editor;

  readonly saveStatus = this.editorService.saveStatus;
  readonly cursorPosition = this.editorService.cursorPosition;

  ngOnInit(): void {
    const lowlight = createLowlight(common);

    this.editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        Link.configure({ openOnClick: false }),
        Image,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        CodeBlockLowlight.configure({ lowlight }),
        Placeholder.configure({ placeholder: 'Tapez "/" pour insérer un bloc...' }),
        Markdown,
        MermaidBlock,
        KatexBlock,
        EmbedBlock,
        SlashCommands,
      ],
      content: '',
      onUpdate: ({ editor }) => {
        const markdown = editor.storage['markdown'].getMarkdown();
        this.markdownService.setDraftContent(markdown);
      },
      onSelectionUpdate: ({ editor }) => {
        const { from } = editor.state.selection;
        const resolved = editor.state.doc.resolve(from);
        this.editorService.setCursorPosition(resolved.depth, from);
      },
    });

    const file = this.markdownService.activeFile();
    if (file) {
      this.loadContent(file.content);
    }

    this.editorService.init();
  }

  loadContent(markdown: string): void {
    this.editor.commands.setContent(markdown);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // Toolbar actions
  toggleBold(): void { this.editor.chain().focus().toggleBold().run(); }
  toggleItalic(): void { this.editor.chain().focus().toggleItalic().run(); }
  toggleUnderline(): void { this.editor.chain().focus().toggleUnderline().run(); }
  toggleStrike(): void { this.editor.chain().focus().toggleStrike().run(); }
  toggleBulletList(): void { this.editor.chain().focus().toggleBulletList().run(); }
  toggleOrderedList(): void { this.editor.chain().focus().toggleOrderedList().run(); }
  toggleTaskList(): void { this.editor.chain().focus().toggleTaskList().run(); }
  toggleBlockquote(): void { this.editor.chain().focus().toggleBlockquote().run(); }
  toggleCodeBlock(): void { this.editor.chain().focus().toggleCodeBlock().run(); }
  setHorizontalRule(): void { this.editor.chain().focus().setHorizontalRule().run(); }
  undo(): void { this.editor.chain().focus().undo().run(); }
  redo(): void { this.editor.chain().focus().redo().run(); }

  setHeading(level: 1 | 2 | 3 | 4 | 5 | 6): void {
    this.editor.chain().focus().toggleHeading({ level }).run();
  }

  insertTable(): void {
    this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  insertImage(): void {
    const url = prompt("URL de l'image:");
    if (url) {
      this.editor.chain().focus().setImage({ src: url }).run();
    }
  }

  insertLink(): void {
    const url = prompt('URL du lien:');
    if (url) {
      this.editor.chain().focus().setLink({ href: url }).run();
    }
  }

  insertMermaid(): void {
    const content = prompt('Code Mermaid:', 'graph TD\n  A-->B');
    if (content) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['mermaidBlock'].create({ content });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  insertKatex(): void {
    const content = prompt('Formule LaTeX:', 'E = mc^2');
    if (content) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['katexBlock'].create({ content });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  insertEmbed(): void {
    const src = prompt('URL vidéo/embed:');
    if (src) {
      this.editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = this.editor.schema.nodes['embedBlock'].create({ src });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    }
  }

  setColor(color: string): void {
    this.editor.chain().focus().setColor(color).run();
  }

  toggleHighlight(color: string): void {
    this.editor.chain().focus().toggleHighlight({ color }).run();
  }

  downloadFile(): void {
    this.editorService.downloadMarkdown();
  }
}
