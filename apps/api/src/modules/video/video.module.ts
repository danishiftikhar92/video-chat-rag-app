import { Module } from '@nestjs/common';
import { InMemoryRateLimitService } from '../../common/rate-limit.service';
import { getEnv } from '../../config/env';
import { SourceValidatorService } from '../../providers/source-validator.service';
import { StorageModule } from '../storage/storage.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [StorageModule],
  controllers: [VideoController],
  providers: [
    VideoService,
    InMemoryRateLimitService,
    {
      provide: SourceValidatorService,
      useFactory: () => new SourceValidatorService(getEnv().ALLOWED_SOURCE_HOSTS.split(','))
    }
  ],
  exports: [VideoService]
})
export class VideoModule {}
