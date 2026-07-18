import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Worker } from 'bullmq';
import { JobStatus, Video, VideoJob, VideoStatus } from '../../database';
import type { DataSource } from 'typeorm';
import { ingestionQueueName } from '../../common/queue.constants';
import { getEnv } from '../../config/env';
import { IngestionProcessor } from './ingestion.processor';

@Injectable()
export class IngestionWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionWorkerService.name);
  private worker: Worker | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processor: IngestionProcessor
  ) {}

  onModuleInit() {
    const env = getEnv();
    this.worker = new Worker(
      ingestionQueueName,
      async (job) => {
        const payload = job.data as { videoId: string; jobId: string };
        await this.processor.process(payload.videoId, payload.jobId);
      },
      {
        connection: { url: env.REDIS_URL } as never,
        concurrency: Number(env.WORKER_CONCURRENCY)
      }
    );

    this.worker.on('failed', async (job, error) => {
      if (!job) return;
      const payload = job.data as { videoId: string; jobId: string };
      await this.dataSource.getRepository(VideoJob).update(payload.jobId, {
        status: JobStatus.failed,
        errorMessage: error.message,
        completedAt: new Date()
      });
      await this.dataSource.getRepository(Video).update(payload.videoId, {
        status: VideoStatus.failed,
        errorMessage: error.message
      });
    });

    this.logger.log(
      `Ingestion worker started (queue=${ingestionQueueName}, concurrency=${env.WORKER_CONCURRENCY})`
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.logger.log('Ingestion worker stopped');
    }
  }
}
