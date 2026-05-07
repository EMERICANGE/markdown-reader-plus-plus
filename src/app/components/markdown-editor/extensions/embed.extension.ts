import { Node, mergeAttributes } from '@tiptap/core';

export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      width: { default: '100%' },
      height: { default: '315' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'embed', class: 'embed-block' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('embed-block-wrapper');

      const iframe = document.createElement('iframe');
      iframe.src = node.attrs['src'];
      iframe.width = node.attrs['width'];
      iframe.height = node.attrs['height'];
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.setAttribute('allowfullscreen', '');
      container.appendChild(iframe);

      const editButton = document.createElement('button');
      editButton.textContent = 'Modifier URL';
      editButton.classList.add('embed-edit-btn');
      container.appendChild(editButton);

      editButton.addEventListener('click', () => {
        const newSrc = prompt('URL de la vidéo/embed:', node.attrs['src']);
        if (newSrc !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, src: newSrc });
            return true;
          }).run();
          iframe.src = newSrc;
        }
      });

      return { dom: container };
    };
  },
});
