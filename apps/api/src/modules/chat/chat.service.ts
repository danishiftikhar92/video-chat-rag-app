import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type ChatRequest } from '@video-rag/shared';
import { ChatMessage, ChatRole, ChatSession } from '@video-rag/database';
import { Repository } from 'typeorm';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession) private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    private readonly agentService: AgentService
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

    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: ChatRole.user,
        content: payload.query,
        citationsJson: []
      })
    );

    const result = await this.agentService.answerQuestion(payload.videoIds, payload.query);

    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: ChatRole.assistant,
        content: result.answer as string,
        citationsJson: result.citations
      })
    );

    const messages = await this.getMessages(session.id);

    return {
      sessionId: session.id,
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      messages: messages.map((message) => ({
        ...message,
        citations: message.citationsJson
      }))
    };
  }
}
