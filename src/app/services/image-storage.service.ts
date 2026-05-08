// src/app/services/image-storage.service.ts
import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

interface StoredImage {
  id: string;
  fileHash: string;
  pageNum: number;
  imgIndex: number;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class ImageStorageService {
  private db: IDBPDatabase | null = null;
  private blobUrls = new Map<string, string>();

  async init(): Promise<void> {
    this.db = await openDB('markdown-viewer-images', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'id' });
          store.createIndex('byFileHash', 'fileHash', { unique: false });
        }
      },
    });
  }

  async storeImage(fileHash: string, pageNum: number, imgIndex: number, blob: Blob): Promise<string> {
    if (!this.db) await this.init();
    const id = `img-${fileHash}-${pageNum}-${imgIndex}`;
    const entry: StoredImage = { id, fileHash, pageNum, imgIndex, blob };
    await this.db!.put('images', entry);
    const url = URL.createObjectURL(blob);
    this.blobUrls.set(id, url);
    return url;
  }

  async getImageUrlsForFile(fileHash: string): Promise<string[]> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    return entries.map(entry => {
      const existing = this.blobUrls.get(entry.id);
      if (existing) return existing;
      const url = URL.createObjectURL(entry.blob);
      this.blobUrls.set(entry.id, url);
      return url;
    });
  }

  async deleteImagesForFile(fileHash: string): Promise<void> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    for (const entry of entries) {
      const url = this.blobUrls.get(entry.id);
      if (url) {
        URL.revokeObjectURL(url);
        this.blobUrls.delete(entry.id);
      }
      await this.db!.delete('images', entry.id);
    }
  }

  async restoreUrlsForFile(fileHash: string): Promise<Map<string, string>> {
    if (!this.db) await this.init();
    const entries: StoredImage[] = await this.db!.getAllFromIndex('images', 'byFileHash', fileHash);
    const urlMap = new Map<string, string>();
    for (const entry of entries) {
      const url = URL.createObjectURL(entry.blob);
      this.blobUrls.set(entry.id, url);
      urlMap.set(entry.id, url);
    }
    return urlMap;
  }
}
