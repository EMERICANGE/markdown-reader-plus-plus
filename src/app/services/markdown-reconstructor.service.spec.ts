// src/app/services/markdown-reconstructor.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { MarkdownReconstructorService, PdfTextItem, PdfPageData } from './markdown-reconstructor.service';

describe('MarkdownReconstructorService', () => {
  let service: MarkdownReconstructorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkdownReconstructorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect headings by font size', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Main Title', fontSize: 24, fontName: 'Arial-Bold', x: 50, y: 700, width: 200, height: 24 },
        { str: 'Some body text here.', fontSize: 12, fontName: 'Arial', x: 50, y: 650, width: 300, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('# Main Title');
    expect(result).toContain('Some body text here.');
  });

  it('should detect bold and italic from font names', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Normal', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 45, height: 12 },
        { str: 'bold text', fontSize: 12, fontName: 'Arial-Bold', x: 100, y: 700, width: 55, height: 12 },
        { str: 'and', fontSize: 12, fontName: 'Arial', x: 162, y: 700, width: 22, height: 12 },
        { str: 'italic text', fontSize: 12, fontName: 'Arial-Italic', x: 190, y: 700, width: 70, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('**bold text**');
    expect(result).toContain('*italic text*');
  });

  it('should detect bullet lists', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: '• First item', fontSize: 12, fontName: 'Arial', x: 70, y: 700, width: 100, height: 12 },
        { str: '• Second item', fontSize: 12, fontName: 'Arial', x: 70, y: 680, width: 110, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('- First item');
    expect(result).toContain('- Second item');
  });

  it('should merge consecutive lines into paragraphs', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'This is the start of a', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 200, height: 12 },
        { str: 'paragraph that continues.', fontSize: 12, fontName: 'Arial', x: 50, y: 686, width: 200, height: 12 },
      ],
      imageRefs: [],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('This is the start of a paragraph that continues.');
  });

  it('should insert image references', () => {
    const pages: PdfPageData[] = [{
      pageNum: 1,
      textItems: [
        { str: 'Text before image.', fontSize: 12, fontName: 'Arial', x: 50, y: 700, width: 150, height: 12 },
      ],
      imageRefs: ['blob:http://localhost/img-abc-1-0'],
    }];

    const result = service.reconstruct(pages);
    expect(result).toContain('![](blob:http://localhost/img-abc-1-0)');
  });
});
