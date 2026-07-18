import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JobStatus, Video, VideoJob, VideoStatus } from '../../database';
import { Repository } from 'typeorm';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(VideoJob) private readonly jobRepo: Repository<VideoJob>,
    @InjectRepository(Video) private readonly videoRepo: Repository<Video>,
    private readonly queueService: QueueService
  ) {}

  async listJobs() {
    return this.jobRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getJob(id: string) {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async retryJob(id: string) {
    const job = await this.getJob(id);
    await this.jobRepo.update(id, {
      status: JobStatus.queued,
      errorMessage: null,
      progressPercent: 0
    });
    await this.videoRepo.update(job.videoId, {
      status: VideoStatus.queued,
      errorMessage: null,
      progressPercent: 0
    });
    await this.queueService.enqueueVideoIngestion(job.videoId, id);
    return this.getJob(id);
  }
}
