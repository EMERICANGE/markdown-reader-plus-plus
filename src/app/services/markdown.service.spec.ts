import { TestBed } from '@angular/core/testing';
import { MarkdownService } from './markdown.service';
import { MarkdownFile } from '../models/markdown-file.model';

describe('MarkdownService', () => {
  let service: MarkdownService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkdownService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add files and emit them', () => {
    const files: MarkdownFile[] = [
      { name: 'test.md', path: 'test.md', content: '# Hello' }
    ];
    service.addFiles(files);
    expect(service.files()).toEqual(files);
  });

  it('should replace files when replaceAll is called', () => {
    const files1: MarkdownFile[] = [
      { name: 'a.md', path: 'a.md', content: '# A' }
    ];
    const files2: MarkdownFile[] = [
      { name: 'b.md', path: 'b.md', content: '# B' }
    ];
    service.addFiles(files1);
    service.replaceFiles(files2);
    expect(service.files()).toEqual(files2);
  });

  it('should set active file and extract headings', () => {
    const file: MarkdownFile = {
      name: 'test.md',
      path: 'test.md',
      content: '# Title\n## Section 1\n### Sub\n## Section 2'
    };
    service.addFiles([file]);
    service.setActive(file);
    expect(service.activeFile()).toEqual(file);
    expect(service.headings()).toEqual([
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'Section 1', id: 'section-1' },
      { level: 3, text: 'Sub', id: 'sub' },
      { level: 2, text: 'Section 2', id: 'section-2' },
    ]);
  });

  it('should set search term', () => {
    service.setSearchTerm('hello');
    expect(service.searchTerm()).toBe('hello');
  });

  it('should filter files by name based on search term', () => {
    const files: MarkdownFile[] = [
      { name: 'readme.md', path: 'readme.md', content: '# Readme' },
      { name: 'guide.md', path: 'guide.md', content: '# Guide' },
      { name: 'api-reference.md', path: 'api-reference.md', content: '# API' },
    ];
    service.addFiles(files);
    service.setSearchTerm('guide');
    expect(service.filteredFiles()).toEqual([
      { name: 'guide.md', path: 'guide.md', content: '# Guide' }
    ]);
  });

  it('should return all files when search term is empty', () => {
    const files: MarkdownFile[] = [
      { name: 'a.md', path: 'a.md', content: '# A' },
      { name: 'b.md', path: 'b.md', content: '# B' },
    ];
    service.addFiles(files);
    service.setSearchTerm('');
    expect(service.filteredFiles()).toEqual(files);
  });
});
