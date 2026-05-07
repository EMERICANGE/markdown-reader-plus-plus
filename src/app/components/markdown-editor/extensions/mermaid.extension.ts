import { Node, mergeAttributes } from '@tiptap/core';

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: 'graph TD\n  A-->B' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid', class: 'mermaid-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('mermaid-block-wrapper');

      const renderArea = document.createElement('div');
      renderArea.classList.add('mermaid-render');
      container.appendChild(renderArea);

      const editButton = document.createElement('button');
      editButton.textContent = 'Éditer';
      editButton.classList.add('mermaid-edit-btn');
      container.appendChild(editButton);

      const renderMermaid = async (code: string) => {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
          renderArea.innerHTML = svg;
        } catch {
          renderArea.innerHTML = `<pre class="mermaid-error">${code}</pre>`;
        }
      };

      renderMermaid(node.attrs['content']);

      editButton.addEventListener('click', () => {
        const currentContent = node.attrs['content'];
        const newContent = prompt('Mermaid diagram code:', currentContent);
        if (newContent !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { content: newContent });
            return true;
          }).run();
          renderMermaid(newContent);
        }
      });

      return { dom: container };
    };
  },
});
