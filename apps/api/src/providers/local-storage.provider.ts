import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import type { StorageProvider, StoredArtifact } from './storage.provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}

  resolvePath(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  async saveJson(relativePath: string, value: unknown): Promise<StoredArtifact> {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(value, null, 2), 'utf8');
    return { path: fullPath, relativePath };
  }

  async saveText(relativePath: string, value: string): Promise<StoredArtifact> {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, value, 'utf8');
    return { path: fullPath, relativePath };
  }

  async saveFile(relativePath: string, content: Buffer): Promise<StoredArtifact> {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
    return { path: fullPath, relativePath };
  }

  async readText(relativePath: string): Promise<string> {
    return readFile(this.resolvePath(relativePath), 'utf8');
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await readFile(this.resolvePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.resolvePath(relativePath), { recursive: true, force: true });
  }
}
