import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type ChatRequest } from '../../shared';
import { ChatMessage, ChatRole, ChatSession } from '../../database';
import { Repository } from 'typeorm';
import { AgentService } from '../agent/agent.service';
import { GuardrailService } from '../guardrails/guardrail.service';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession) private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    private readonly agentService: AgentService,
    private readonly guardrailService: GuardrailService,
    private readonly observability: ObservabilityService
  ) {}

  async createSession(videoId?: string, anonymousId?: string) {
    const session = this.sessionRepo.create({ videoId, anonymousId });
    return this.sessionRepo.save(session);
  }

  async getSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getMessages(sessionId: string) {
    return this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' }
    });
  }

  async clearMessages(sessionId: string) {
    await this.getSession(sessionId);
    await this.messageRepo.delete({ sessionId });
    return { sessionId, cleared: true };
  }

  async deleteSession(sessionId: string) {
    await this.getSession(sessionId);
    await this.messageRepo.delete({ sessionId });
    await this.sessionRepo.delete({ id: sessionId });
    return { sessionId, deleted: true };
  }

  async chat(videoId: string, payload: ChatRequest) {
    const session = payload.sessionId
      ? await this.getSession(payload.sessionId)
      : await this.createSession(videoId);

    const obs = this.observability.startTrace({
      name: 'rag_request',
      input: {
        query: payload.query,
        videoId,
        videoIds: payload.videoIds,
        model: payload.model
      },
      sessionId: session.id,
      userId: session.anonymousId ?? undefined,
      metadata: {
        videoId,
        videoIds: payload.videoIds,
        environment: this.observability.environment
      },
      tags: ['rag']
    });

    try {
      const inputEval = await this.guardrailService.evaluateInput(payload.query);
      const userContent = inputEval.action === 'transform' ? inputEval.text : payload.query;

      if (inputEval.action === 'transform' || inputEval.action === 'block') {
        obs.event('guardrail_input', {
          action: inputEval.action,
          reasons: inputEval.reasons,
          appliedRailIds: inputEval.appliedRailIds
        });
      }

      await this.messageRepo.save(
        this.messageRepo.create({
          sessionId: session.id,
          role: ChatRole.user,
          content: userContent,
          citationsJson: []
        })
      );

      if (inputEval.action === 'block') {
        await this.messageRepo.save(
          this.messageRepo.create({
            sessionId: session.id,
            role: ChatRole.assistant,
            content: inputEval.text,
            citationsJson: []
          })
        );

        const messages = await this.getMessages(session.id);
        obs.event('guardrail_blocked', {
          stage: 'input',
          reasons: inputEval.reasons,
          appliedRailIds: inputEval.appliedRailIds
        });
        obs.update({ tags: ['guardrail_blocked'] });
        obs.end({
          output: { answer: inputEval.text, blocked: true },
          metadata: { stage: 'input_guardrail' }
        });
        await this.observability.flush();

        return {
          sessionId: session.id,
          answer: inputEval.text,
          citations: [],
          confidence: 0,
          modelUsed: 'guardrail',
          messages: messages.map((message) => ({
            ...message,
            citations: message.citationsJson
          })),
          guardrailApplied: this.guardrailService.toApplied(inputEval),
          traceId: obs.traceId
        };
      }

      const result = await this.agentService.answerQuestion(
        payload.videoIds,
        userContent,
        payload.model,
        obs
      );

      const outputEval = await this.guardrailService.evaluateOutput(result.answer as string);
      const answer =
        outputEval.action === 'block' || outputEval.action === 'transform'
          ? outputEval.text
          : (result.answer as string);

      const appliedReasons = [...inputEval.reasons, ...outputEval.reasons];
      const appliedRailIds = [...inputEval.appliedRailIds, ...outputEval.appliedRailIds];
      const blocked = outputEval.action === 'block';

      if (outputEval.action === 'transform' || outputEval.action === 'block') {
        obs.event(blocked ? 'guardrail_blocked' : 'guardrail_output', {
          stage: 'output',
          action: outputEval.action,
          reasons: outputEval.reasons,
          appliedRailIds: outputEval.appliedRailIds
        });
        if (blocked) obs.update({ tags: ['guardrail_blocked'] });
      }

      await this.messageRepo.save(
        this.messageRepo.create({
          sessionId: session.id,
          role: ChatRole.assistant,
          content: answer,
          citationsJson: blocked ? [] : result.citations
        })
      );

      const messages = await this.getMessages(session.id);

      obs.end({
        output: {
          answer,
          confidence: blocked ? 0 : result.confidence,
          modelUsed: result.modelUsed,
          mode: result.mode,
          fallback: Boolean(result.fallback),
          citationCount: blocked ? 0 : result.citations.length
        },
        metadata: {
          needsClarification: result.needsClarification,
          blocked
        }
      });
      await this.observability.flush();

      return {
        sessionId: session.id,
        answer,
        citations: blocked ? [] : result.citations,
        confidence: blocked ? 0 : result.confidence,
        modelUsed: result.modelUsed,
        messages: messages.map((message) => ({
          ...message,
          citations: message.citationsJson
        })),
        ...(appliedReasons.length > 0 || appliedRailIds.length > 0
          ? {
              guardrailApplied: {
                blocked,
                reasons: appliedReasons,
                appliedRailIds
              }
            }
          : {}),
        traceId: obs.traceId
      };
    } catch (error) {
      obs.end({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
        output: { error: error instanceof Error ? error.message : String(error) }
      });
      await this.observability.flush();
      throw error;
    }
  }
}
