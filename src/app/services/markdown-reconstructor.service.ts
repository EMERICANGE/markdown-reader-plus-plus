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
}

@Injectable({ providedIn: 'root' })
export class MarkdownReconstructorService {

  reconstruct(pages: PdfPageData[]): string {
    const allItems = pages.flatMap(p => p.textItems);
    const fontSizeMap = this.buildFontSizeMap(allItems);
    const bodySize = this.findBodySize(allItems);
    const markdownParts: string[] = [];

    for (const page of pages) {
      const lines = this.groupIntoLines(page.textItems, bodySize);
      const pageMarkdown = this.processLines(lines, fontSizeMap, bodySize);
      if (pageMarkdown) {
        markdownParts.push(pageMarkdown);
      }

      for (const imgUrl of page.imageRefs) {
        markdownParts.push(`![](${imgUrl})`);
      }
    }

    return markdownParts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private buildFontSizeMap(items: PdfTextItem[]): Map<number, 'h1' | 'h2' | 'h3' | 'body'> {
    const map = new Map<number, 'h1' | 'h2' | 'h3' | 'body'>();
    if (items.length === 0) return map;

    const bodySize = this.findBodySize(items);

    const sizes = [...new Set(items.map(i => i.fontSize))];
    for (const size of sizes) {
      if (size > bodySize * 1.6) {
        map.set(size, 'h1');
      } else if (size > bodySize * 1.3) {
        map.set(size, 'h2');
      } else if (size > bodySize * 1.1) {
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

  private groupIntoLines(items: PdfTextItem[], bodySize: number): TextLine[] {
    if (items.length === 0) return [];

    const lineHeight = bodySize || 12;
    const tolerance = lineHeight * 0.6;

    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextLine[] = [];
    let currentLine: TextLine = {
      items: [sorted[0]],
      y: sorted[0].y,
      fontSize: sorted[0].fontSize,
    };

    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      if (Math.abs(item.y - currentLine.y) <= tolerance) {
        currentLine.items.push(item);
        currentLine.fontSize = Math.max(currentLine.fontSize, item.fontSize);
      } else {
        currentLine.items.sort((a, b) => a.x - b.x);
        lines.push(currentLine);
        currentLine = { items: [item], y: item.y, fontSize: item.fontSize };
      }
    }
    currentLine.items.sort((a, b) => a.x - b.x);
    lines.push(currentLine);

    return lines;
  }

  private processLines(lines: TextLine[], fontSizeMap: Map<number, string>, bodySize: number): string {
    const blocks: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineText = this.buildLineText(line.items, bodySize);
      const plainText = this.stripFormatting(lineText);
      const headingLevel = fontSizeMap.get(line.fontSize);

      if (this.isBulletLine(plainText)) {
        let listBlock = `- ${this.extractBulletText(plainText)}`;
        i++;
        while (i < lines.length) {
          const nextPlain = this.stripFormatting(this.buildLineText(lines[i].items, bodySize));
          if (!this.isBulletLine(nextPlain)) break;
          listBlock += `\n- ${this.extractBulletText(nextPlain)}`;
          i++;
        }
        blocks.push(listBlock);
      } else if (this.isNumberedLine(plainText)) {
        let listBlock = plainText;
        i++;
        while (i < lines.length) {
          const nextPlain = this.stripFormatting(this.buildLineText(lines[i].items, bodySize));
          if (!this.isNumberedLine(nextPlain)) break;
          listBlock += `\n${nextPlain}`;
          i++;
        }
        blocks.push(listBlock);
      } else if (headingLevel === 'h1' || headingLevel === 'h2' || headingLevel === 'h3') {
        const prefix = headingLevel === 'h1' ? '# ' : headingLevel === 'h2' ? '## ' : '### ';
        blocks.push(`${prefix}${plainText}`);
        i++;
      } else {
        let paragraph = lineText;
        let prevLine = line;
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextLineText = this.buildLineText(nextLine.items, bodySize);
          const nextPlain = this.stripFormatting(nextLineText);
          const nextHeading = fontSizeMap.get(nextLine.fontSize);

          if (nextHeading && nextHeading !== 'body') break;
          if (this.isBulletLine(nextPlain)) break;
          if (this.isNumberedLine(nextPlain)) break;

          const gap = prevLine.y - nextLine.y;
          const expectedLineGap = bodySize * 1.4;
          if (gap > expectedLineGap * 1.8) break;

          paragraph += ' ' + nextLineText;
          prevLine = nextLine;
          i++;
        }
        blocks.push(paragraph.trim());
      }
    }

    return blocks.join('\n\n');
  }

  private buildLineText(items: PdfTextItem[], bodySize: number): string {
    if (items.length === 0) return '';

    let result = '';
    const spaceWidth = bodySize * 0.3;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = item.str;
      if (!text.trim()) continue;

      if (i > 0) {
        const prev = items[i - 1];
        const prevEnd = prev.x + prev.width;
        const gap = item.x - prevEnd;
        if (gap > spaceWidth) {
          result += ' ';
        }
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

  private stripFormatting(text: string): string {
    return text.replace(/\*{1,3}/g, '').trim();
  }

  private isBulletLine(text: string): boolean {
    return /^[•\-\*‣▪]\s+/.test(text) || /^[•\-\*‣▪](?=[A-Za-zÀ-ÿ])/.test(text);
  }

  private isNumberedLine(text: string): boolean {
    return /^\d+[\.\)]\s+/.test(text);
  }

  private extractBulletText(text: string): string {
    return text.replace(/^[•\-\*‣▪]\s*/, '').trim();
  }
}
