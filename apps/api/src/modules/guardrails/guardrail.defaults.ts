import {
  GuardRailDirection,
  GuardRailType,
  type GuardRailConfig
} from '../../database';

export type DefaultGuardRailSeed = {
  name: string;
  description: string;
  type: GuardRailType;
  direction: GuardRailDirection;
  enabled: boolean;
  priority: number;
  config: GuardRailConfig;
};

export const DEFAULT_GUARD_RAILS: DefaultGuardRailSeed[] = [
  {
    name: 'Prompt injection shield',
    description: 'Blocks jailbreak and instruction-override attempts on user input.',
    type: GuardRailType.prompt_injection,
    direction: GuardRailDirection.input,
    enabled: true,
    priority: 10,
    config: {
      refusalMessage:
        'I cannot process that request because it looks like an attempt to override system instructions.'
    }
  },
  {
    name: 'PII mask',
    description: 'Masks emails, phone numbers, and card numbers in input and output.',
    type: GuardRailType.pii_mask,
    direction: GuardRailDirection.both,
    enabled: true,
    priority: 20,
    config: {}
  },
  {
    name: 'Video Q&A scope',
    description: 'Keeps chat focused on questions about the video transcript.',
    type: GuardRailType.scope,
    direction: GuardRailDirection.input,
    enabled: true,
    priority: 30,
    config: {
      refusalMessage:
        'I can only help with questions about this video and its transcript. Please ask something related to the video content.'
    }
  },
  {
    name: 'Harmful content filter',
    description: 'Blocks harmful or abusive content in input and output.',
    type: GuardRailType.harmful_content,
    direction: GuardRailDirection.both,
    enabled: true,
    priority: 40,
    config: {
      refusalMessage:
        'I cannot help with that request because it appears to involve harmful or abusive content.'
    }
  }
];
