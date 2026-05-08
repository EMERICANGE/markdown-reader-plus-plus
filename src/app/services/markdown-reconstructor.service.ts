// src/app/services/markdown-reconstructor.service.ts
import { Injectable } from '@angular/core';

export interface PdfTextItem {
  str: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageData {
  pageNum: number;
  textItems: PdfTextItem[];
  imageRefs: string[];
}

interface TextLine {
  items: PdfTextItem[];
  y: number;
  fontSize: number;
  fontName: string;
}

@Injectable({ providedIn: 'root' })
export class MarkdownReconstructorService {

  reconstruct(pages: PdfPageData[]): string {
    const allItems = pages.flatMap(p => p.textItems);
    const fontSizeMap = this.buildFontSizeMap(allItems);
    const markdownParts: string[] = [];

    for (const page of pages) {
      const lines = this.groupIntoLines(page.textItems);
      const pageMarkdown = this.processLines(lines, fontSizeMap);
      markdownParts.push(pageMarkdown);

      if (page.imageRefs.length > 0) {
        for (const imgUrl of page.imageRefs) {
          markdownParts.push(`\n![](${imgUrl})\n`);
        }
      }
    }

    return markdownParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private buildFontSizeMap(items: PdfTextItem[]): Map<number, 'h1' | 'h2' | 'h3' | 'body'> {
    const sizes = [...new Set(items.map(i => i.fontSize))].sort((a, b) => b - a);
    const map = new Map<number, 'h1' | 'h2' | 'h3' | 'body'>();

    if (sizes.length === 0) return map;

    const bodySize = this.findBodySize(items);

    for (const size of sizes) {
      if (size > bodySize * 1.8) {
        map.set(size, 'h1');
      } else if (size > bodySize * 1.4) {
        map.set(size, 'h2');
      } else if (size > bodySize * 1.15) {
        map.set(size, 'h3');
      } else {
        map.set(size, 'body');
      }
    }

    return map;
  }

  private findBodySize(items: PdfTextItem[]): number {
    const sizeCount = new Map<number, number>();
    for (const item of items) {
      sizeCount.set(item.fontSize, (sizeCount.get(item.fontSize) || 0) + item.str.length);
    }
    let maxCount = 0;
    let bodySize = 12;
    for (const [size, count] of sizeCount) {
      if (count > maxCount) {
        maxCount = count;
        bodySize = size;
      }
    }
    return bodySize;
  }

  private groupIntoLines(items: PdfTextItem[]): TextLine[] {
    if (items.length === 0) return [];

    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextLine[] = [];
    let currentLine: TextLine = {
      items: [sorted[0]],
      y: sorted[0].y,
      fontSize: sorted[0].fontSize,
      fontName: sorted[0].fontName,
    };

    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      if (Math.abs(item.y - currentLine.y) < item.height * 0.5) {
        currentLine.items.push(item);
      } else {
        lines.push(currentLine);
        currentLine = { items: [item], y: item.y, fontSize: item.fontSize, fontName: item.fontName };
      }
    }
    lines.push(currentLine);

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }

    return lines;
  }

  private processLines(lines: TextLine[], fontSizeMap: Map<number, string>): string {
    const output: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineText = this.buildLineText(line.items);
      const strippedText = lineText.replace(/\*+/g, '').trim();
      const headingLevel = fontSizeMap.get(line.fontSize);

      if (this.isBulletLine(strippedText)) {
        const bulletText = this.extractBulletText(strippedText);
        output.push(`- ${bulletText}`);
        i++;
      } else if (this.isNumberedLine(strippedText)) {
        output.push(strippedText);
        i++;
      } else if (headingLevel === 'h1' || headingLevel === 'h2' || headingLevel === 'h3') {
        const prefix = headingLevel === 'h1' ? '# ' : headingLevel === 'h2' ? '## ' : '### ';
        output.push(`\n${prefix}${strippedText}\n`);
        i++;
      } else {
        let paragraph = lineText;
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextText = this.buildLineText(nextLine.items).replace(/\*+/g, '').trim();
          const nextHeading = fontSizeMap.get(nextLine.fontSize);
          const gap = line.y - nextLine.y;

          if (nextHeading && nextHeading !== 'body') break;
          if (this.isBulletLine(nextText)) break;
          if (this.isNumberedLine(nextText)) break;
          if (gap > line.fontSize * 2.5) break;

          paragraph += ' ' + this.buildLineText(nextLine.items);
          i++;
        }
        output.push(paragraph.trim());
      }
    }

    return output.join('\n');
  }

  private buildLineText(items: PdfTextItem[]): string {
    let result = '';
    for (const item of items) {
      const text = item.str;
      if (!text.trim()) {
        result += ' ';
        continue;
      }
      const isBold = /bold/i.test(item.fontName);
      const isItalic = /italic|oblique/i.test(item.fontName);

      if (isBold && isItalic) {
        result += `***${text}***`;
      } else if (isBold) {
        result += `**${text}**`;
      } else if (isItalic) {
        result += `*${text}*`;
      } else {
        result += text;
      }
    }
    return result;
  }

  private isBulletLine(text: string): boolean {
    return /^[•\-\*]\s+/.test(text);
  }

  private isNumberedLine(text: string): boolean {
    return /^\d+[\.\)]\s+/.test(text);
  }

  private extractBulletText(text: string): string {
    return text.replace(/^[•\-\*]\s+/, '');
  }
}
