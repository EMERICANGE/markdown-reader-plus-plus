// src/app/services/pdf-import.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { PdfImportService } from './pdf-import.service';

describe('PdfImportService', () => {
  let service: PdfImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial progress at 0', () => {
    expect(service.progress()).toBe(0);
  });

  it('should have empty status initially', () => {
    expect(service.statusMessage()).toBe('');
  });

  it('should report error for invalid file', async () => {
    const fakeFile = new File(['not a pdf'], 'test.txt', { type: 'text/plain' });
    const result = await service.importPdf(fakeFile);
    expect(result).toBeNull();
    expect(service.error()).toBeTruthy();
  });
});
