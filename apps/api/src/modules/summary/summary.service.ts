import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Summary } from '../../database';
import { Repository } from 'typeorm';

@Injectable()
export class SummaryService {
  constructor(@InjectRepository(Summary) private readonly summaryRepo: Repository<Summary>) {}

  async getSummary(videoId: string) {
    const summaries = await this.summaryRepo.find({
      where: { videoId },
      order: { createdAt: 'DESC' },
      take: 1
    });
    const summary = summaries[0];
    if (!summary) throw new NotFoundException('Summary not found');
    return {
      videoId,
      summaryText: summary.summaryText,
      highlights: summary.highlightsJson,
      createdAt: summary.createdAt.toISOString()
    };
  }
}
