import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { chatRequestSchema, createSessionSchema, type ChatRequest } from '../../shared';
import { getEnv } from '../../config/env';
import { InMemoryRateLimitService } from '../../common/rate-limit.service';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly rateLimitService: InMemoryRateLimitService
  ) {}

  @Post('videos/:id/chat')
  chat(@Param('id') id: string, @Body() body: unknown) {
    this.rateLimitService.consume(`chat:${id}`, Number(getEnv().CHAT_RATE_LIMIT));
    const payload = chatRequestSchema.parse({ ...(body as Record<string, unknown>), videoIds: [id] }) as ChatRequest;
    return this.chatService.chat(id, payload);
  }

  @Post('sessions')
  createSession(@Body() body: unknown) {
    const payload = createSessionSchema.parse(body);
    return this.chatService.createSession(payload.videoId, payload.anonymousId);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @Get('sessions/:id/messages')
  getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  @Delete('sessions/:id/messages')
  clearMessages(@Param('id') id: string) {
    return this.chatService.clearMessages(id);
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(id);
  }
}
