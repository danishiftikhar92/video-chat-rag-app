import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  JobStatus,
  SourceType,
  Summary,
  Transcript,
  TranscriptChunk,
  Video,
  VideoJob,
  VideoStatus
} from '../../database';
import type { DataSource, Repository } from 'typeorm';
import { ChunkingService } from './chunking.service';
import { MediaService, deriveTitleFromUrl } from './media.service';
import { CHAT_PROVIDER, type ChatProvider } from './providers/chat.provider';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './providers/embedding.provider';
import {
  INGESTION_STORAGE_PROVIDER,
  type WorkerStorageProvider
} from './providers/storage.provider';
import {
  TRANSCRIPTION_PROVIDER,
  type TranscriptionProvider
} from './providers/transcription.provider';
import { SummaryExtractionService } from './summary.service';

type Repos = {
  videoRepo: Repository<Video>;
  jobRepo: Repository<VideoJob>;
  transcriptRepo: Repository<Transcript>;
  chunkRepo: Repository<TranscriptChunk>;
  summaryRepo: Repository<Summary>;
};

@Injectable()
export class IngestionProcessor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly chunkingService: ChunkingService,
    private readonly summaryService: SummaryExtractionService,
    @Inject(INGESTION_STORAGE_PROVIDER) private readonly storage: WorkerStorageProvider,
    @Inject(TRANSCRIPTION_PROVIDER) private readonly transcriptionProvider: TranscriptionProvider,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(CHAT_PROVIDER) private readonly chatProvider: ChatProvider
  ) {}

  private getRepos(): Repos {
    return {
      videoRepo: this.dataSource.getRepository(Video),
      jobRepo: this.dataSource.getRepository(VideoJob),
      transcriptRepo: this.dataSource.getRepository(Transcript),
      chunkRepo: this.dataSource.getRepository(TranscriptChunk),
      summaryRepo: this.dataSource.getRepository(Summary)
    };
  }

  private async updateProgress(
    repos: Repos,
    jobId: string,
    videoId: string,
    progressPercent: number,
    status: JobStatus,
    errorMessage?: string | null
  ) {
    const job = await repos.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    job.status = status;
    job.progressPercent = progressPercent;
    job.errorMessage = errorMessage ?? null;
    if (status === JobStatus.running) {
      job.startedAt = new Date();
      job.attemptCount += 1;
    }
    if (status === JobStatus.completed || status === JobStatus.failed) {
      job.completedAt = new Date();
    }
    await repos.jobRepo.save(job);

    const videoStatus =
      status === JobStatus.running
        ? VideoStatus.processing
        : status === JobStatus.completed
          ? VideoStatus.completed
          : status === JobStatus.failed
            ? VideoStatus.failed
            : VideoStatus.queued;
    await repos.videoRepo.update(videoId, {
      status: videoStatus,
      progressPercent,
      errorMessage: errorMessage ?? null
    });
  }

  async process(videoId: string, jobId: string) {
    const repos = this.getRepos();
    const video = await repos.videoRepo.findOne({ where: { id: videoId } });
    if (!video) throw new Error(`Video ${videoId} not found`);

    await this.updateProgress(repos, jobId, videoId, 5, JobStatus.running);

    const metadata = await this.mediaService.extractMetadata(video.sourceUrl, video.sourceType);
    if (metadata.title || metadata.thumbnailUrl) {
      await repos.videoRepo.update(videoId, {
        ...(metadata.title && video.title === 'Pending metadata' ? { title: metadata.title } : {}),
        ...(metadata.thumbnailUrl ? { thumbnailUrl: metadata.thumbnailUrl } : {})
      });
    }

    const { workDir, mediaPath } = await this.mediaService.ensureVideoDownloaded(
      videoId,
      video.sourceUrl,
      video.sourceType,
      video.sourcePath
    );

    await repos.videoRepo.update(videoId, { sourcePath: mediaPath });

    if (video.sourceType !== SourceType.youtube && !metadata.title) {
      const embeddedTitle = await this.mediaService.extractMediaTitle(mediaPath);
      metadata.title = embeddedTitle ?? deriveTitleFromUrl(video.sourceUrl);
      if (metadata.title && video.title === 'Pending metadata') {
        await repos.videoRepo.update(videoId, { title: metadata.title });
      }
    }

    await this.updateProgress(repos, jobId, videoId, 20, JobStatus.running);
    const audioPath = await this.mediaService.extractAudio(workDir, mediaPath);
    await repos.videoRepo.update(videoId, { audioPath });

    await this.updateProgress(repos, jobId, videoId, 40, JobStatus.running);
    const transcript = await this.transcriptionProvider.transcribe(audioPath);
    const transcriptRelativePath = `videos/${videoId}/transcript.json`;
    const transcriptPath = await this.storage.save(
      transcriptRelativePath,
      JSON.stringify(transcript, null, 2)
    );

    let transcriptRow = await repos.transcriptRepo.findOne({ where: { videoId } });
    if (transcriptRow) {
      transcriptRow.rawText = transcript.rawText;
      transcriptRow.segmentsJson = transcript.segments;
      transcriptRow.language = transcript.language;
    } else {
      transcriptRow = repos.transcriptRepo.create({
        videoId,
        rawText: transcript.rawText,
        segmentsJson: transcript.segments,
        language: transcript.language
      });
    }
    await repos.transcriptRepo.save(transcriptRow);
    await repos.videoRepo.update(videoId, { transcriptPath });

    await this.updateProgress(repos, jobId, videoId, 60, JobStatus.running);
    await repos.chunkRepo.delete({ videoId });
    const chunks = await this.chunkingService.createChunks(
      videoId,
      transcriptRow.id,
      transcript.segments
    );
    const embeddings = await this.embeddingProvider.embed(
      chunks.map((chunk: { content: string }) => chunk.content)
    );

    for (const [index, chunk] of chunks.entries()) {
      await repos.chunkRepo.save(
        repos.chunkRepo.create({
          ...chunk,
          embeddingId: `${videoId}-${index}`,
          embedding: embeddings[index] ?? null,
          metadataJson: {
            ...chunk.metadataJson,
            embeddingPreview: embeddings[index]?.slice(0, 8) ?? []
          }
        })
      );
    }

    await this.updateProgress(repos, jobId, videoId, 80, JobStatus.running);
    const summaryText = await this.chatProvider.summarize(transcript.rawText);
    const highlights = this.summaryService.extractHighlights(summaryText);
    await repos.summaryRepo.save(
      repos.summaryRepo.create({
        videoId,
        summaryText,
        highlightsJson: highlights
      })
    );
    const summaryPath = await this.storage.save(`videos/${videoId}/summary.txt`, summaryText);

    const resolvedTitle =
      metadata.title ?? (video.title === 'Pending metadata' ? `Video ${videoId}` : video.title);
    await repos.videoRepo.update(videoId, {
      title: resolvedTitle,
      language: transcript.language,
      summaryPath
    });

    await this.updateProgress(repos, jobId, videoId, 100, JobStatus.completed);
  }
}
