import { z } from 'zod';
import { jobStatusSchema, sourceTypeSchema, transcriptSegmentSchema, videoStatusSchema } from '../common/schemas';

export const createVideoSchema = z.object({
  sourceUrl: z.string().url(),
  requestedBy: z.string().optional()
});

export const videoSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  sourceType: sourceTypeSchema,
  title: z.string(),
  thumbnailUrl: z.string().nullable().optional(),
  durationSeconds: z.number().int().nonnegative(),
  language: z.string().default('unknown'),
  status: videoStatusSchema,
  progressPercent: z.number().min(0).max(100),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const jobSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  jobType: z.string(),
  status: jobStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  progressPercent: z.number().min(0).max(100)
});

export const videoListResponseSchema = z.object({
  items: z.array(videoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
});

export const videoListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(12)
});

export const videoDetailResponseSchema = z.object({
  video: videoSchema,
  latestJob: jobSchema.nullable()
});

export const videoStatusResponseSchema = z.object({
  videoId: z.string(),
  status: videoStatusSchema,
  progressPercent: z.number().min(0).max(100),
  latestJob: jobSchema.nullable()
});

export const transcriptResponseSchema = z.object({
  videoId: z.string(),
  language: z.string(),
  rawText: z.string(),
  segments: z.array(transcriptSegmentSchema)
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type VideoDto = z.infer<typeof videoSchema>;
export type VideoListResponse = z.infer<typeof videoListResponseSchema>;
export type VideoListQuery = z.infer<typeof videoListQuerySchema>;
export type JobDto = z.infer<typeof jobSchema>;
export type TranscriptDto = z.infer<typeof transcriptResponseSchema>;
