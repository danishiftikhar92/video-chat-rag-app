import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { getEnv } from '../config/env';

@Global()
@Module({
  providers: [
    {
      provide: QueueService,
      useFactory: () => new QueueService(getEnv().REDIS_URL)
    }
  ],
  exports: [QueueService]
})
export class QueueModule {}
