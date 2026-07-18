import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  ChatMessage,
  ChatSession,
  Summary,
  Transcript,
  TranscriptChunk,
  Video,
  VideoJob
} from './entities/index';
import { ensurePgVector, ensureVectorExtension } from './pgvector';

export const entities = [Video, VideoJob, Transcript, TranscriptChunk, ChatSession, ChatMessage, Summary];

export const createDataSource = (databaseUrl: string, synchronize = false) =>
  new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations: [__dirname + '/migrations/*.{js,ts}'],
    synchronize,
    logging: process.env.NODE_ENV === 'development'
  });

let dataSource: DataSource | null = null;

export const getDataSource = async (databaseUrl: string, synchronize = false): Promise<DataSource> => {
  if (!dataSource) {
    await ensureVectorExtension(databaseUrl);
    dataSource = createDataSource(databaseUrl, synchronize);
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    await ensurePgVector(dataSource);
  }
  return dataSource;
};

export const closeDataSource = async (): Promise<void> => {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
};
