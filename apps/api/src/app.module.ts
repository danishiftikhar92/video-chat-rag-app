import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { AgentModule } from './modules/agent/agent.module';
import { ChatModule } from './modules/chat/chat.module';
import { GuardrailsModule } from './modules/guardrails/guardrails.module';
import { HealthModule } from './modules/health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LlmModule } from './modules/llm/llm.module';
import { MediaModule } from './modules/media/media.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { RagModule } from './modules/rag/rag.module';
import { StorageModule } from './modules/storage/storage.module';
import { SummaryModule } from './modules/summary/summary.module';
import { TranscriptModule } from './modules/transcript/transcript.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { VideoModule } from './modules/video/video.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    StorageModule,
    ObservabilityModule,
    VideoModule,
    JobsModule,
    TranscriptModule,
    SummaryModule,
    RagModule,
    AgentModule,
    GuardrailsModule,
    ChatModule,
    LlmModule,
    MediaModule,
    TranscriptionModule,
    IngestionModule,
    HealthModule
  ]
})
export class AppModule {}
