import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from '../config/env';

export interface WorkerStorageProvider {
  save(relativePath: string, content: string | Buffer): Promise<string>;
  read(relativePath: string): Promise<string>;
  exists(relativePath: string): Promise<boolean>;
  resolvePath(relativePath: string): string;
  delete(relativePath: string): Promise<void>;
}

class LocalWorkerStorageProvider implements WorkerStorageProvider {
  constructor(private readonly root: string) {}

  resolvePath(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  async save(relativePath: string, content: string | Buffer): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
    return fullPath;
  }

  async read(relativePath: string): Promise<string> {
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
    await rm(this.resolvePath(relativePath), { force: true });
  }
}

export const createStorageProvider = (): WorkerStorageProvider => {
  const env = getEnv();
  switch (env.STORAGE_PROVIDER) {
    case 'local':
      return new LocalWorkerStorageProvider(env.LOCAL_STORAGE_ROOT);
    case 's3':
      throw new Error('S3 storage provider is not implemented yet');
    default:
      throw new Error(`Unsupported storage provider: ${env.STORAGE_PROVIDER}`);
  }
};
