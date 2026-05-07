import { Node, mergeAttributes } from '@tiptap/core';

export const KatexBlock = Node.create({
  name: 'katexBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: 'E = mc^2' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="katex"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'katex', class: 'katex-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('katex-block-wrapper');

      const renderArea = document.createElement('div');
      renderArea.classList.add('katex-render');
      container.appendChild(renderArea);

      const editButton = document.createElement('button');
      editButton.textContent = 'Éditer';
      editButton.classList.add('katex-edit-btn');
      container.appendChild(editButton);

      const renderKatex = async (formula: string) => {
        try {
          const katex = (await import('katex')).default;
          renderArea.innerHTML = katex.renderToString(formula, {
            throwOnError: false,
            displayMode: true,
          });
        } catch {
          renderArea.innerHTML = `<pre class="katex-error">${formula}</pre>`;
        }
      };

      renderKatex(node.attrs['content']);

      editButton.addEventListener('click', () => {
        const currentContent = node.attrs['content'];
        const newContent = prompt('LaTeX formula:', currentContent);
        if (newContent !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { content: newContent });
            return true;
          }).run();
          renderKatex(newContent);
        }
      });

      return { dom: container };
    };
  },
});
