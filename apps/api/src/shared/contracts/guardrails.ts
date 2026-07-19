import { z } from 'zod';
import { guardRailDirections, guardRailTypes } from '../common/enums';

export const guardRailConfigSchema = z.object({
  patterns: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  allowKeywords: z.array(z.string()).optional(),
  denyKeywords: z.array(z.string()).optional(),
  refusalMessage: z.string().optional()
});

export const createGuardRailSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(guardRailTypes),
  direction: z.enum(guardRailDirections),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(10_000).optional().default(100),
  config: guardRailConfigSchema.optional().default({})
});

export const updateGuardRailSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(guardRailTypes).optional(),
  direction: z.enum(guardRailDirections).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  config: guardRailConfigSchema.optional()
});

export const guardRailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(guardRailTypes),
  direction: z.enum(guardRailDirections),
  enabled: z.boolean(),
  priority: z.number().int(),
  config: guardRailConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const guardrailAppliedSchema = z.object({
  blocked: z.boolean(),
  reasons: z.array(z.string()),
  appliedRailIds: z.array(z.string())
});

export type GuardRailConfigDto = z.infer<typeof guardRailConfigSchema>;
export type CreateGuardRailInput = z.infer<typeof createGuardRailSchema>;
export type UpdateGuardRailInput = z.infer<typeof updateGuardRailSchema>;
export type GuardRailDto = z.infer<typeof guardRailSchema>;
export type GuardrailApplied = z.infer<typeof guardrailAppliedSchema>;
