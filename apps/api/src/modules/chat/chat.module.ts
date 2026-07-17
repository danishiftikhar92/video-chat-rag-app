import { Module } from '@nestjs/common';
import { InMemoryRateLimitService } from '../../common/rate-limit.service';
import { AgentModule } from '../agent/agent.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AgentModule],
  controllers: [ChatController],
  providers: [ChatService, InMemoryRateLimitService],
  exports: [ChatService]
})
export class ChatModule {}
