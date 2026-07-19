import type { GuardRailConfig } from '../../../database';

export type GuardrailCheckDirection = 'input' | 'output';

export type GuardrailCheckResult =
  | { action: 'allow' }
  | { action: 'block'; reason: string; refusalMessage?: string }
  | { action: 'transform'; text: string; reason: string };

export interface GuardrailChecker {
  check(
    text: string,
    config: GuardRailConfig,
    direction: GuardrailCheckDirection
  ): GuardrailCheckResult;
}

export function matchAnyKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (needle && lower.includes(needle)) return keyword.trim();
  }
  return null;
}

export function matchAnyPattern(text: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    const raw = pattern.trim();
    if (!raw) continue;
    try {
      const regex = new RegExp(raw, 'i');
      if (regex.test(text)) return raw;
    } catch {
      if (text.toLowerCase().includes(raw.toLowerCase())) return raw;
    }
  }
  return null;
}
