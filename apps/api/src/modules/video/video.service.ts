import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type CreateVideoInput } from '@video-rag/shared';
import {
  ChatMessage,
  ChatSession,
  JobStatus,
  SourceType,
  Summary,
  Transcript,
  TranscriptChunk,
  Video,
  VideoJob,
  VideoStatus
} from '@video-rag/database';
import { DataSource, In, Repository } from 'typeorm';
import { QueueService } from '../../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video) private readonly videoRepo: Repository<Video>,
    @InjectRepository(VideoJob) private readonly jobRepo: Repository<VideoJob>,
    private readonly queueService: QueueService,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService
  ) {}

  async createVideo(
    input: CreateVideoInput,
    sourceType: SourceType,
    options?: { sourcePath?: string | null; enqueue?: boolean }
  ) {
    const video = this.videoRepo.create({
      sourceUrl: input.sourceUrl,
      sourceType,
      sourcePath: options?.sourcePath ?? null,
      title: 'Pending metadata',
      durationSeconds: 0,
      language: 'unknown',
      status: VideoStatus.queued,
      progressPercent: 0
    });
    await this.videoRepo.save(video);

    const job = this.jobRepo.create({
      videoId: video.id,
      jobType: 'ingest',
      status: JobStatus.queued,
      progressPercent: 0
    });
    await this.jobRepo.save(job);

    if (options?.enqueue !== false) {
      await this.queueService.enqueueVideoIngestion(video.id, job.id);
    }

    return { video, latestJob: job };
  }

  async listVideos(page = 1, pageSize = 12) {
    const [items, total] = await this.videoRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return { items, total, page, pageSize };
  }

  async getVideo(id: string) {
    const video = await this.videoRepo.findOne({
      where: { id },
      relations: { jobs: true }
    });
    if (!video) throw new NotFoundException('Video not found');
    const latestJob = [...(video.jobs ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0] ?? null;
    return { video, latestJob };
  }

  async getVideoStatus(id: string) {
    const detail = await this.getVideo(id);
    return {
      videoId: detail.video.id,
      status: detail.video.status,
      progressPercent: detail.video.progressPercent,
      latestJob: detail.latestJob
    };
  }

  async retryVideo(id: string) {
    const detail = await this.getVideo(id);
    const job = this.jobRepo.create({
      videoId: id,
      jobType: 'retry',
      status: JobStatus.queued,
      progressPercent: 0
    });
    await this.jobRepo.save(job);
    await this.videoRepo.update(id, {
      status: VideoStatus.queued,
      progressPercent: 0,
      errorMessage: null
    });
    await this.queueService.enqueueVideoIngestion(id, job.id);
    return { video: detail.video, latestJob: job };
  }

  async deleteVideo(id: string) {
    await this.getVideo(id);

    await this.dataSource.transaction(async (manager) => {
      const sessions = await manager.find(ChatSession, {
        where: { videoId: id },
        select: { id: true }
      });
      const sessionIds = sessions.map((session) => session.id);

      if (sessionIds.length > 0) {
        await manager.delete(ChatMessage, { sessionId: In(sessionIds) });
      }
      await manager.delete(ChatSession, { videoId: id });
      await manager.delete(TranscriptChunk, { videoId: id });
      await manager.delete(Transcript, { videoId: id });
      await manager.delete(Summary, { videoId: id });
      await manager.delete(VideoJob, { videoId: id });
      await manager.delete(Video, { id });
    });

    await this.storageService.provider.delete(`videos/${id}`);

    return { id, deleted: true };
  }

  async updateSourcePath(videoId: string, sourcePath: string) {
    await this.videoRepo.update(videoId, { sourcePath });
  }

  async enqueueLatestJob(videoId: string, jobId: string) {
    await this.queueService.enqueueVideoIngestion(videoId, jobId);
  }
}
