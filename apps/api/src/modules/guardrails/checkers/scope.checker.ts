import type { GuardRailConfig } from '../../../database';
import {
  matchAnyKeyword,
  matchAnyPattern,
  type GuardrailCheckDirection,
  type GuardrailChecker,
  type GuardrailCheckResult
} from './types';

const DEFAULT_DENY_KEYWORDS = [
  'write me a poem',
  'write a poem',
  'write code for',
  'help me code',
  'solve this leetcode',
  'generate a resume',
  'stock tips',
  'crypto trading advice',
  'medical diagnosis',
  'legal advice',
  'how to hack',
  'how to make a bomb'
];

const DEFAULT_ALLOW_KEYWORDS = [
  'video',
  'transcript',
  'summary',
  'summarize',
  'highlight',
  'key point',
  'what did',
  'who said',
  'when did',
  'mention',
  'explain',
  'about this',
  'in the video',
  'timestamp',
  'chapter',
  'speaker'
];

export class ScopeChecker implements GuardrailChecker {
  check(
    text: string,
    config: GuardRailConfig,
    _direction: GuardrailCheckDirection
  ): GuardrailCheckResult {
    const denyKeywords = config.denyKeywords?.length
      ? config.denyKeywords
      : config.keywords?.length
        ? config.keywords
        : DEFAULT_DENY_KEYWORDS;
    const allowKeywords = config.allowKeywords?.length
      ? config.allowKeywords
      : DEFAULT_ALLOW_KEYWORDS;
    const patterns = config.patterns ?? [];

    const denyHit = matchAnyKeyword(text, denyKeywords);
    if (denyHit) {
      return {
        action: 'block',
        reason: `Out-of-scope request matched: ${denyHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    const patternHit = matchAnyPattern(text, patterns);
    if (patternHit) {
      return {
        action: 'block',
        reason: `Out-of-scope pattern matched: ${patternHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    const allowHit = matchAnyKeyword(text, allowKeywords);
    if (!allowHit && text.trim().length > 12) {
      // Soft scope: if clearly unrelated phrasing with no video cues, block long off-topic asks
      const looksLikeGeneralAssist =
        /^(can you|could you|please|help me|write|generate|create|make|tell me a)\b/i.test(
          text.trim()
        );
      if (looksLikeGeneralAssist) {
        return {
          action: 'block',
          reason: 'Request appears outside video Q&A scope',
          refusalMessage: config.refusalMessage
        };
      }
    }

    return { action: 'allow' };
  }
}
