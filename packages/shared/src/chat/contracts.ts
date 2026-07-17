import { z } from 'zod';
import { chatRoleSchema, citationSchema } from '../common/schemas';

export const createSessionSchema = z.object({
  videoId: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  anonymousId: z.string().optional()
});

export const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1),
  videoIds: z.array(z.string()).min(1)
});

export const chatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  citations: z.array(citationSchema),
  createdAt: z.string()
});

export const chatResponseSchema = z.object({
  sessionId: z.string(),
  answer: z.string(),
  citations: z.array(citationSchema),
  confidence: z.number().min(0).max(1),
  messages: z.array(chatMessageSchema)
});

export const sessionSchema = z.object({
  id: z.string(),
  videoId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
