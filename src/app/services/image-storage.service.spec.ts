// src/app/services/image-storage.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ImageStorageService } from './image-storage.service';

describe('ImageStorageService', () => {
  let service: ImageStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve an image', async () => {
    await service.init();
    const blob = new Blob(['fake-image'], { type: 'image/png' });
    const url = await service.storeImage('file-hash-1', 1, 0, blob);
    expect(url).toMatch(/^blob:/);
  });

  it('should delete images for a file', async () => {
    await service.init();
    const blob = new Blob(['fake-image'], { type: 'image/png' });
    await service.storeImage('file-hash-2', 1, 0, blob);
    await service.storeImage('file-hash-2', 1, 1, blob);
    await service.deleteImagesForFile('file-hash-2');
    const urls = await service.getImageUrlsForFile('file-hash-2');
    expect(urls.length).toBe(0);
  });
});
