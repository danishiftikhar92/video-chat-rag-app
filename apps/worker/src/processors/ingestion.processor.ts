import {
  JobStatus,
  SourceType,
  Summary,
  Transcript,
  TranscriptChunk,
  Video,
  VideoJob,
  VideoStatus
} from '@video-rag/database';
import { createEmbeddingProvider } from '../providers/embedding.provider';
import { createChatProvider } from '../providers/chat.provider';
import { createStorageProvider } from '../providers/storage.provider';
import { createTranscriptionProvider } from '../providers/transcription.provider';
import { getEnv } from '../config/env';
import { MediaService, deriveTitleFromUrl } from '../services/media.service';
import { ChunkingService } from '../services/chunking.service';
import { SummaryExtractionService } from '../services/summary.service';
import type { DataSource, Repository } from 'typeorm';

const storage = createStorageProvider();
const transcriptionProvider = createTranscriptionProvider();
const embeddingProvider = createEmbeddingProvider();
const chatProvider = createChatProvider();
const mediaService = new MediaService(getEnv().LOCAL_STORAGE_ROOT);
const chunkingService = new ChunkingService();
const summaryService = new SummaryExtractionService();

type Repos = {
  videoRepo: Repository<Video>;
  jobRepo: Repository<VideoJob>;
  transcriptRepo: Repository<Transcript>;
  chunkRepo: Repository<TranscriptChunk>;
  summaryRepo: Repository<Summary>;
};

const getRepos = (dataSource: DataSource): Repos => ({
  videoRepo: dataSource.getRepository(Video),
  jobRepo: dataSource.getRepository(VideoJob),
  transcriptRepo: dataSource.getRepository(Transcript),
  chunkRepo: dataSource.getRepository(TranscriptChunk),
  summaryRepo: dataSource.getRepository(Summary)
});

const updateProgress = async (
  repos: Repos,
  jobId: string,
  videoId: string,
  progressPercent: number,
  status: JobStatus,
  errorMessage?: string | null
) => {
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
};

export const processIngestionJob = async (
  dataSource: DataSource,
  videoId: string,
  jobId: string
) => {
  const repos = getRepos(dataSource);
  const video = await repos.videoRepo.findOne({ where: { id: videoId } });
  if (!video) throw new Error(`Video ${videoId} not found`);

  await updateProgress(repos, jobId, videoId, 5, JobStatus.running);

  const metadata = await mediaService.extractMetadata(video.sourceUrl, video.sourceType);
  if (metadata.title || metadata.thumbnailUrl) {
    await repos.videoRepo.update(videoId, {
      ...(metadata.title && video.title === 'Pending metadata' ? { title: metadata.title } : {}),
      ...(metadata.thumbnailUrl ? { thumbnailUrl: metadata.thumbnailUrl } : {})
    });
  }

  const { workDir, mediaPath } = await mediaService.ensureVideoDownloaded(
    videoId,
    video.sourceUrl,
    video.sourceType,
    video.sourcePath
  );

  await repos.videoRepo.update(videoId, { sourcePath: mediaPath });

  if (video.sourceType !== SourceType.youtube && !metadata.title) {
    const embeddedTitle = await mediaService.extractMediaTitle(mediaPath);
    metadata.title = embeddedTitle ?? deriveTitleFromUrl(video.sourceUrl);
    if (metadata.title && video.title === 'Pending metadata') {
      await repos.videoRepo.update(videoId, { title: metadata.title });
    }
  }

  await updateProgress(repos, jobId, videoId, 20, JobStatus.running);
  const audioPath = await mediaService.extractAudio(workDir, mediaPath);
  await repos.videoRepo.update(videoId, { audioPath });

  await updateProgress(repos, jobId, videoId, 40, JobStatus.running);
  const transcript = await transcriptionProvider.transcribe(audioPath);
  const transcriptRelativePath = `videos/${videoId}/transcript.json`;
  const transcriptPath = await storage.save(
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

  await updateProgress(repos, jobId, videoId, 60, JobStatus.running);
  await repos.chunkRepo.delete({ videoId });
  const chunks = await chunkingService.createChunks(videoId, transcriptRow.id, transcript.segments);
  const embeddings = await embeddingProvider.embed(
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

  await updateProgress(repos, jobId, videoId, 80, JobStatus.running);
  const summaryText = await chatProvider.summarize(transcript.rawText);
  const highlights = summaryService.extractHighlights(summaryText);
  await repos.summaryRepo.save(
    repos.summaryRepo.create({
      videoId,
      summaryText,
      highlightsJson: highlights
    })
  );
  const summaryPath = await storage.save(`videos/${videoId}/summary.txt`, summaryText);

  const resolvedTitle = metadata.title ?? (video.title === 'Pending metadata' ? `Video ${videoId}` : video.title);
  await repos.videoRepo.update(videoId, {
    title: resolvedTitle,
    language: transcript.language,
    summaryPath
  });

  await updateProgress(repos, jobId, videoId, 100, JobStatus.completed);
};
