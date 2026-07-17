import { z } from 'zod';
import { chatRoles, jobStatuses, sourceTypes, summaryModes, videoStatuses } from './enums';

export const timestampRangeSchema = z.object({
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative()
});

export const citationSchema = z.object({
  chunkId: z.string(),
  videoId: z.string(),
  videoTitle: z.string().optional(),
  contentSnippet: z.string(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative()
});

export const transcriptSegmentSchema = z.object({
  text: z.string(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  speaker: z.string().optional()
});

export const videoStatusSchema = z.enum(videoStatuses);
export const jobStatusSchema = z.enum(jobStatuses);
export const sourceTypeSchema = z.enum(sourceTypes);
export const chatRoleSchema = z.enum(chatRoles);
export const summaryModeSchema = z.enum(summaryModes);
