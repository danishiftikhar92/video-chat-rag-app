import type { GuardRailConfig } from '../../../database';
import {
  matchAnyKeyword,
  matchAnyPattern,
  type GuardrailCheckDirection,
  type GuardrailChecker,
  type GuardrailCheckResult
} from './types';

const DEFAULT_KEYWORDS = [
  'kill yourself',
  'kys',
  'commit suicide',
  'self-harm',
  'self harm',
  'how to murder',
  'how to kill',
  'build a bomb',
  'make a bomb',
  'child porn',
  'child sexual',
  'rape',
  'terrorist attack',
  'ethnic cleansing'
];

const DEFAULT_PATTERNS = [
  '\\b(kill|murder|assassinate)\\b.{0,40}\\b(someone|people|them)\\b',
  '\\b(how to)\\b.{0,30}\\b(suicide|self[- ]?harm)\\b'
];

export class HarmfulContentChecker implements GuardrailChecker {
  check(
    text: string,
    config: GuardRailConfig,
    _direction: GuardrailCheckDirection
  ): GuardrailCheckResult {
    const keywords = config.keywords?.length ? config.keywords : DEFAULT_KEYWORDS;
    const patterns = config.patterns?.length ? config.patterns : DEFAULT_PATTERNS;

    const keywordHit = matchAnyKeyword(text, keywords);
    if (keywordHit) {
      return {
        action: 'block',
        reason: `Harmful content keyword matched: ${keywordHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    const patternHit = matchAnyPattern(text, patterns);
    if (patternHit) {
      return {
        action: 'block',
        reason: `Harmful content pattern matched: ${patternHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    return { action: 'allow' };
  }
}
