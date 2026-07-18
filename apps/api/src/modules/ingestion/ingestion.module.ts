import { Module } from '@nestjs/common';
import { getEnv } from '../../config/env';
import { ChunkingService } from './chunking.service';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionWorkerService } from './ingestion.worker';
import { MediaService } from './media.service';
import { CHAT_PROVIDER, createChatProvider } from './providers/chat.provider';
import { createEmbeddingProvider, EMBEDDING_PROVIDER } from './providers/embedding.provider';
import {
  createStorageProvider,
  INGESTION_STORAGE_PROVIDER
} from './providers/storage.provider';
import {
  createTranscriptionProvider,
  TRANSCRIPTION_PROVIDER
} from './providers/transcription.provider';
import { SummaryExtractionService } from './summary.service';

@Module({
  providers: [
    {
      provide: MediaService,
      useFactory: () => new MediaService(getEnv().LOCAL_STORAGE_ROOT)
    },
    ChunkingService,
    SummaryExtractionService,
    {
      provide: INGESTION_STORAGE_PROVIDER,
      useFactory: createStorageProvider
    },
    {
      provide: TRANSCRIPTION_PROVIDER,
      useFactory: createTranscriptionProvider
    },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: createEmbeddingProvider
    },
    {
      provide: CHAT_PROVIDER,
      useFactory: createChatProvider
    },
    IngestionProcessor,
    IngestionWorkerService
  ]
})
export class IngestionModule {}
