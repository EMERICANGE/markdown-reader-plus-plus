import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { MarkdownService } from '../../services/markdown.service';
import { TocHeading } from '../../models/markdown-file.model';

@Component({
  selector: 'app-toc-sidebar',
  standalone: true,
  imports: [CommonModule, TreeModule],
  template: `
    <h4>Table des matières</h4>
    @if (treeNodes().length === 0) {
      <p class="text-500 text-sm">Aucun fichier sélectionné</p>
    } @else {
      <p-tree
        [value]="treeNodes()"
        selectionMode="single"
        [(selection)]="selectedNode"
        [style]="{'border': 'none', 'padding': '0'}"
        (onNodeSelect)="onNodeClick($event)">
      </p-tree>
    }
  `,
  styles: [`
    :host { display: block; }
    h4 { margin: 0 0 0.5rem 0; }
  `],
})
export class TocSidebarComponent {
  private markdownService = inject(MarkdownService);
  selectedNode: TreeNode | null = null;

  treeNodes = computed<TreeNode[]>(() => {
    const headings = this.markdownService.headings();
    return this.buildTree(headings);
  });

  onNodeClick(event: { node: TreeNode }): void {
    const id = event.node.data;
    const element = document.getElementById(id);
    if (!element) return;

    const container = document.querySelector('.main-content');
    if (container) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elementRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: offset - 16, behavior: 'smooth' });
    }
  }

  private buildTree(headings: TocHeading[]): TreeNode[] {
    const root: TreeNode[] = [];
    const stack: { level: number; node: TreeNode }[] = [];

    for (const heading of headings) {
      const node: TreeNode = {
        label: heading.text,
        data: heading.id,
        children: [],
        expanded: true,
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].node.children!.push(node);
      }

      stack.push({ level: heading.level, node });
    }

    return root;
  }
}
