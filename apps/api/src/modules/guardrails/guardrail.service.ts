import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GuardRail,
  GuardRailDirection,
  GuardRailType,
  type GuardRailConfig
} from '../../database';
import type {
  CreateGuardRailInput,
  GuardrailApplied,
  UpdateGuardRailInput
} from '../../shared';
import {
  HarmfulContentChecker,
  PiiMaskChecker,
  PromptInjectionChecker,
  ScopeChecker,
  type GuardrailChecker,
  type GuardrailCheckDirection
} from './checkers';
import { DEFAULT_GUARD_RAILS } from './guardrail.defaults';

export type GuardrailEvaluation = {
  action: 'allow' | 'block' | 'transform';
  text: string;
  reasons: string[];
  appliedRailIds: string[];
  refusalMessage?: string;
};

const DEFAULT_BLOCK_MESSAGE =
  'I cannot process that request because it violates a safety or policy guardrail.';

@Injectable()
export class GuardrailService implements OnModuleInit {
  private readonly logger = new Logger(GuardrailService.name);
  private readonly checkers: Record<GuardRailType, GuardrailChecker> = {
    [GuardRailType.prompt_injection]: new PromptInjectionChecker(),
    [GuardRailType.pii_mask]: new PiiMaskChecker(),
    [GuardRailType.scope]: new ScopeChecker(),
    [GuardRailType.harmful_content]: new HarmfulContentChecker()
  };

  constructor(
    @InjectRepository(GuardRail) private readonly guardRailRepo: Repository<GuardRail>
  ) {}

  async onModuleInit() {
    await this.seedDefaultsIfEmpty();
  }

  async seedDefaultsIfEmpty() {
    const count = await this.guardRailRepo.count();
    if (count > 0) return;

    await this.guardRailRepo.save(
      DEFAULT_GUARD_RAILS.map((seed) => this.guardRailRepo.create(seed))
    );
    this.logger.log(`Seeded ${DEFAULT_GUARD_RAILS.length} default guard rails`);
  }

  async list() {
    return this.guardRailRepo.find({ order: { priority: 'ASC', createdAt: 'ASC' } });
  }

  async get(id: string) {
    const rail = await this.guardRailRepo.findOne({ where: { id } });
    if (!rail) throw new NotFoundException('Guard rail not found');
    return rail;
  }

  async create(input: CreateGuardRailInput) {
    const rail = this.guardRailRepo.create({
      name: input.name,
      description: input.description ?? null,
      type: input.type as GuardRailType,
      direction: input.direction as GuardRailDirection,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 100,
      config: (input.config ?? {}) as GuardRailConfig
    });
    return this.guardRailRepo.save(rail);
  }

  async update(id: string, input: UpdateGuardRailInput) {
    const rail = await this.get(id);
    if (input.name !== undefined) rail.name = input.name;
    if (input.description !== undefined) rail.description = input.description;
    if (input.type !== undefined) rail.type = input.type as GuardRailType;
    if (input.direction !== undefined) rail.direction = input.direction as GuardRailDirection;
    if (input.enabled !== undefined) rail.enabled = input.enabled;
    if (input.priority !== undefined) rail.priority = input.priority;
    if (input.config !== undefined) rail.config = input.config as GuardRailConfig;
    return this.guardRailRepo.save(rail);
  }

  async remove(id: string) {
    const rail = await this.get(id);
    await this.guardRailRepo.delete({ id: rail.id });
    return { id: rail.id, deleted: true };
  }

  async evaluateInput(text: string): Promise<GuardrailEvaluation> {
    return this.evaluate(text, 'input');
  }

  async evaluateOutput(text: string): Promise<GuardrailEvaluation> {
    return this.evaluate(text, 'output');
  }

  toApplied(result: GuardrailEvaluation): GuardrailApplied {
    return {
      blocked: result.action === 'block',
      reasons: result.reasons,
      appliedRailIds: result.appliedRailIds
    };
  }

  private async evaluate(
    text: string,
    direction: GuardrailCheckDirection
  ): Promise<GuardrailEvaluation> {
    const rails = await this.guardRailRepo.find({
      where: { enabled: true },
      order: { priority: 'ASC', createdAt: 'ASC' }
    });

    let current = text;
    const reasons: string[] = [];
    const appliedRailIds: string[] = [];
    let transformed = false;

    for (const rail of rails) {
      if (!this.appliesToDirection(rail.direction, direction)) continue;

      const checker = this.checkers[rail.type];
      if (!checker) continue;

      const result = checker.check(current, rail.config ?? {}, direction);
      if (result.action === 'allow') continue;

      appliedRailIds.push(rail.id);
      reasons.push(result.reason);

      if (result.action === 'block') {
        return {
          action: 'block',
          text: result.refusalMessage || rail.config?.refusalMessage || DEFAULT_BLOCK_MESSAGE,
          reasons,
          appliedRailIds,
          refusalMessage: result.refusalMessage || rail.config?.refusalMessage
        };
      }

      current = result.text;
      transformed = true;
    }

    return {
      action: transformed ? 'transform' : 'allow',
      text: current,
      reasons,
      appliedRailIds
    };
  }

  private appliesToDirection(
    railDirection: GuardRailDirection,
    direction: GuardrailCheckDirection
  ): boolean {
    return railDirection === GuardRailDirection.both || railDirection === direction;
  }
}
