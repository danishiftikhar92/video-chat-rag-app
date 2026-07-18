import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createVideoSchema, videoListQuerySchema } from '../../shared';
import { SourceType } from '../../database';
import path from 'node:path';
import { getEnv } from '../../config/env';
import { InMemoryRateLimitService } from '../../common/rate-limit.service';
import { SourceValidatorService } from '../../providers/source-validator.service';
import { StorageService } from '../storage/storage.service';
import { VideoService } from './video.service';

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mkv',
  '.mov',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg'
]);

@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly storageService: StorageService,
    private readonly validator: SourceValidatorService,
    private readonly rateLimitService: InMemoryRateLimitService
  ) {}

  @Post()
  async createVideo(@Body() body: unknown) {
    this.rateLimitService.consume('ingestion', Number(getEnv().INGESTION_RATE_LIMIT));
    const input = createVideoSchema.parse(body);
    const parsed = this.validator.validate(input.sourceUrl);
    const sourceType = parsed.hostname.includes('youtu') ? SourceType.youtube : SourceType.direct;
    return this.videoService.createVideo(input, sourceType);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    this.rateLimitService.consume('ingestion', Number(getEnv().INGESTION_RATE_LIMIT));
    const env = getEnv();
    const maxBytes = Number(env.MAX_UPLOAD_SIZE_MB) * 1024 * 1024;

    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds max upload size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`Unsupported file type: ${extension}`);
    }

    const created = await this.videoService.createVideo(
      { sourceUrl: `upload://${file.originalname}` },
      SourceType.upload,
      { enqueue: false }
    );

    const relativePath = `videos/${created.video.id}/source${extension}`;
    const stored = await this.storageService.provider.saveFile(relativePath, file.buffer);
    await this.videoService.updateSourcePath(created.video.id, stored.path);
    await this.videoService.enqueueLatestJob(created.video.id, created.latestJob.id);

    return this.videoService.getVideo(created.video.id);
  }

  @Get()
  listVideos(@Query() query: unknown) {
    const { page, pageSize } = videoListQuerySchema.parse(query ?? {});
    return this.videoService.listVideos(page, pageSize);
  }

  @Get(':id')
  getVideo(@Param('id') id: string) {
    return this.videoService.getVideo(id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.videoService.getVideoStatus(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.videoService.retryVideo(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videoService.deleteVideo(id);
  }
}
