import { z } from 'zod';

export const highlightSchema = z.object({
  title: z.string(),
  detail: z.string(),
  startTime: z.number().nonnegative().optional(),
  endTime: z.number().nonnegative().optional()
});

export const summarySchema = z.object({
  videoId: z.string(),
  summaryText: z.string(),
  highlights: z.array(highlightSchema),
  createdAt: z.string()
});

export type SummaryDto = z.infer<typeof summarySchema>;
