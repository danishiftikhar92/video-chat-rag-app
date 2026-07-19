import { z } from 'zod';

export const feedbackRequestSchema = z.object({
  traceId: z.string().min(1),
  score: z.union([z.literal(0), z.literal(1)]),
  comment: z.string().max(2000).optional(),
  sessionId: z.string().optional()
});

export const feedbackResponseSchema = z.object({
  ok: z.literal(true),
  traceId: z.string()
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
