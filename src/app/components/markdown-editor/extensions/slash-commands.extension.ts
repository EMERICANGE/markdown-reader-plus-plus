import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps } from '@tiptap/suggestion';

export interface SlashCommandItem {
  title: string;
  icon: string;
  command: (props: { editor: any; range: any }) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Ordered List',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Code Block',
    icon: '</>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    icon: '❝',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Table',
    icon: '▦',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Horizontal Rule',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Mermaid Diagram',
    icon: '◈',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = editor.schema.nodes['mermaidBlock'].create({ content: 'graph TD\n  A-->B' });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    },
  },
  {
    title: 'LaTeX Formula',
    icon: '∑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
        if (dispatch) {
          const node = editor.schema.nodes['katexBlock'].create({ content: 'E = mc^2' });
          tr.replaceSelectionWith(node);
        }
        return true;
      }).run();
    },
  },
  {
    title: 'Video Embed',
    icon: '▶',
    command: ({ editor, range }) => {
      const url = prompt('URL de la vidéo:');
      if (url) {
        editor.chain().focus().deleteRange(range).command(({ tr, dispatch }) => {
          if (dispatch) {
            const node = editor.schema.nodes['embedBlock'].create({ src: url });
            tr.replaceSelectionWith(node);
          }
          return true;
        }).run();
      }
    },
  },
  {
    title: 'Image',
    icon: '🖼',
    command: ({ editor, range }) => {
      const url = prompt("URL de l'image:");
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
];

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return slashCommandItems.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let popup: HTMLElement | null = null;
          let selectedIndex = 0;
          let items: SlashCommandItem[] = [];

          return {
            onStart: (props: SuggestionProps) => {
              popup = document.createElement('div');
              popup.classList.add('slash-command-menu');
              items = props.items as unknown as SlashCommandItem[];
              updatePopup(popup, items, selectedIndex, props);
              document.body.appendChild(popup);
              positionPopup(popup, props);
            },
            onUpdate: (props: SuggestionProps) => {
              items = props.items as unknown as SlashCommandItem[];
              selectedIndex = 0;
              if (popup) {
                updatePopup(popup, items, selectedIndex, props);
                positionPopup(popup, props);
              }
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length;
                if (popup) updatePopup(popup, items, selectedIndex, null);
                return true;
              }
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                if (popup) updatePopup(popup, items, selectedIndex, null);
                return true;
              }
              if (event.key === 'Enter') {
                if (items[selectedIndex]) {
                  items[selectedIndex].command({ editor: null, range: null });
                }
                return true;
              }
              return false;
            },
            onExit: () => {
              if (popup) {
                popup.remove();
                popup = null;
              }
            },
          };
        },
      }),
    ];
  },
});

function updatePopup(popup: HTMLElement, items: SlashCommandItem[], selectedIndex: number, props: SuggestionProps | null): void {
  popup.innerHTML = items.map((item, index) =>
    `<div class="slash-command-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
      <span class="slash-command-icon">${item.icon}</span>
      <span class="slash-command-title">${item.title}</span>
    </div>`
  ).join('');

  popup.querySelectorAll('.slash-command-item').forEach((el, index) => {
    el.addEventListener('click', () => {
      if (props && items[index]) {
        props.command(items[index] as any);
      }
    });
  });
}

function positionPopup(popup: HTMLElement, props: SuggestionProps): void {
  const rect = props.clientRect?.();
  if (rect) {
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 8}px`;
  }
}
