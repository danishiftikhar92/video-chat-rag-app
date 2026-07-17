import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ingestionQueueName } from '../common/queue.constants';

@Injectable()
export class QueueService {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(ingestionQueueName, { connection: { url: redisUrl } as never });
  }

  async enqueueVideoIngestion(videoId: string, jobId: string): Promise<void> {
    await this.queue.add(
      'ingest-video',
      { videoId, jobId },
      {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 200,
        jobId
      }
    );
  }
}
