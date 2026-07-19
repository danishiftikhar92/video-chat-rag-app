import type { GuardRailConfig } from '../../../database';
import type { GuardrailCheckDirection, GuardrailChecker, GuardrailCheckResult } from './types';

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX =
  /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}(?!\w)/g;
const CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (Number.isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export class PiiMaskChecker implements GuardrailChecker {
  check(
    text: string,
    _config: GuardRailConfig,
    _direction: GuardrailCheckDirection
  ): GuardrailCheckResult {
    let masked = text;
    const reasons: string[] = [];

    const emailMasked = masked.replace(EMAIL_REGEX, '[EMAIL]');
    if (emailMasked !== masked) {
      reasons.push('Masked email address(es)');
      masked = emailMasked;
    }

    const cardMasked = masked.replace(CARD_REGEX, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return match;
      if (!luhnValid(digits)) return match;
      return '[CARD]';
    });
    if (cardMasked !== masked) {
      reasons.push('Masked card number(s)');
      masked = cardMasked;
    }

    const phoneMasked = masked.replace(PHONE_REGEX, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) return match;
      // Avoid masking short numbers already handled as cards
      if (match.includes('[CARD]')) return match;
      return '[PHONE]';
    });
    if (phoneMasked !== masked) {
      reasons.push('Masked phone number(s)');
      masked = phoneMasked;
    }

    if (reasons.length === 0) return { action: 'allow' };

    return {
      action: 'transform',
      text: masked,
      reason: reasons.join('; ')
    };
  }
}
