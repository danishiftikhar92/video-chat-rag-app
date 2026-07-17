import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transcript } from '@video-rag/database';
import { Repository } from 'typeorm';

@Injectable()
export class TranscriptService {
  constructor(
    @InjectRepository(Transcript) private readonly transcriptRepo: Repository<Transcript>
  ) {}

  async getTranscript(videoId: string) {
    const transcript = await this.transcriptRepo.findOne({ where: { videoId } });
    if (!transcript) throw new NotFoundException('Transcript not found');
    return {
      videoId,
      language: transcript.language,
      rawText: transcript.rawText,
      segments: transcript.segmentsJson
    };
  }
}
