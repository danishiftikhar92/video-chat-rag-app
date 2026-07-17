import 'reflect-metadata';
import { Worker } from 'bullmq';
import { closeDataSource, getDataSource, JobStatus, Video, VideoJob, VideoStatus } from '@video-rag/database';
import { ingestionQueueName } from '@video-rag/shared';
import { getEnv } from './config/env';
import { processIngestionJob } from './processors/ingestion.processor';

const env = getEnv();
const dataSourcePromise = getDataSource(env.DATABASE_URL, env.TYPEORM_SYNC === 'true');

const worker = new Worker(
  ingestionQueueName,
  async (job) => {
    const payload = job.data as { videoId: string; jobId: string };
    const dataSource = await dataSourcePromise;
    await processIngestionJob(dataSource, payload.videoId, payload.jobId);
  },
  {
    connection: { url: env.REDIS_URL } as never,
    concurrency: Number(env.WORKER_CONCURRENCY)
  }
);

worker.on('failed', async (job, error) => {
  if (!job) return;
  const payload = job.data as { videoId: string; jobId: string };
  const dataSource = await dataSourcePromise;
  await dataSource.getRepository(VideoJob).update(payload.jobId, {
    status: JobStatus.failed,
    errorMessage: error.message,
    completedAt: new Date()
  });
  await dataSource.getRepository(Video).update(payload.videoId, {
    status: VideoStatus.failed,
    errorMessage: error.message
  });
});

process.on('SIGINT', async () => {
  await worker.close();
  await closeDataSource();
  process.exit(0);
});
