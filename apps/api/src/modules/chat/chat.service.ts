import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type ChatRequest } from '../../shared';
import { ChatMessage, ChatRole, ChatSession } from '../../database';
import { Repository } from 'typeorm';
import { AgentService } from '../agent/agent.service';
import { GuardrailService } from '../guardrails/guardrail.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession) private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    private readonly agentService: AgentService,
    private readonly guardrailService: GuardrailService
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

    const inputEval = await this.guardrailService.evaluateInput(payload.query);
    const userContent = inputEval.action === 'transform' ? inputEval.text : payload.query;

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
        guardrailApplied: this.guardrailService.toApplied(inputEval)
      };
    }

    const result = await this.agentService.answerQuestion(
      payload.videoIds,
      userContent,
      payload.model
    );

    const outputEval = await this.guardrailService.evaluateOutput(result.answer as string);
    const answer =
      outputEval.action === 'block' || outputEval.action === 'transform'
        ? outputEval.text
        : (result.answer as string);

    const appliedReasons = [...inputEval.reasons, ...outputEval.reasons];
    const appliedRailIds = [...inputEval.appliedRailIds, ...outputEval.appliedRailIds];
    const blocked = outputEval.action === 'block';

    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: ChatRole.assistant,
        content: answer,
        citationsJson: blocked ? [] : result.citations
      })
    );

    const messages = await this.getMessages(session.id);

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
        : {})
    };
  }
}
