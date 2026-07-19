import type { GuardRailConfig } from '../../../database';
import {
  matchAnyKeyword,
  matchAnyPattern,
  type GuardrailCheckDirection,
  type GuardrailChecker,
  type GuardrailCheckResult
} from './types';

const DEFAULT_PATTERNS = [
  'ignore (all |any )?(previous|prior|above) (instructions|prompts|rules)',
  'disregard (all |any )?(previous|prior|above) (instructions|prompts|rules)',
  'forget (all |any )?(previous|prior|above) (instructions|prompts|rules)',
  'jailbreak',
  'do anything now',
  '\\bDAN\\b',
  'you are now (unrestricted|uncensored|jailbroken)',
  'override (your |the )?(system|safety|content) (prompt|policy|filter)',
  'reveal (your |the )?(system|hidden) prompt',
  'pretend (you have )?no (restrictions|limits|guidelines)'
];

const DEFAULT_KEYWORDS = [
  'ignore previous instructions',
  'ignore all instructions',
  'jailbreak',
  'developer mode',
  'bypass safety',
  'bypass filter'
];

export class PromptInjectionChecker implements GuardrailChecker {
  check(
    text: string,
    config: GuardRailConfig,
    _direction: GuardrailCheckDirection
  ): GuardrailCheckResult {
    const patterns = config.patterns?.length ? config.patterns : DEFAULT_PATTERNS;
    const keywords = config.keywords?.length ? config.keywords : DEFAULT_KEYWORDS;

    const patternHit = matchAnyPattern(text, patterns);
    if (patternHit) {
      return {
        action: 'block',
        reason: `Prompt injection pattern matched: ${patternHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    const keywordHit = matchAnyKeyword(text, keywords);
    if (keywordHit) {
      return {
        action: 'block',
        reason: `Prompt injection keyword matched: ${keywordHit}`,
        refusalMessage: config.refusalMessage
      };
    }

    return { action: 'allow' };
  }
}
