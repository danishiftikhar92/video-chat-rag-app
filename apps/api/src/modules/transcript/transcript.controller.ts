import { Controller, Get, Param } from '@nestjs/common';
import { TranscriptService } from './transcript.service';

@Controller('videos/:id/transcript')
export class TranscriptController {
  constructor(private readonly transcriptService: TranscriptService) {}

  @Get()
  getTranscript(@Param('id') id: string) {
    return this.transcriptService.getTranscript(id);
  }
}
