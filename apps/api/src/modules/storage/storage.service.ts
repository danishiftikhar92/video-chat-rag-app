import { Injectable } from '@nestjs/common';
import { getEnv } from '../../config/env';
import { LocalStorageProvider } from '../../providers/local-storage.provider';
import type { StorageProvider } from '../../providers/storage.provider';

@Injectable()
export class StorageService {
  readonly provider: StorageProvider;

  constructor() {
    const env = getEnv();

    switch (env.STORAGE_PROVIDER) {
      case 'local':
        this.provider = new LocalStorageProvider(env.LOCAL_STORAGE_ROOT);
        break;
      case 's3':
        throw new Error('S3 storage provider is not implemented yet');
      default:
        throw new Error(`Unsupported storage provider: ${env.STORAGE_PROVIDER}`);
    }
  }
}
