import { Injectable } from '@nestjs/common';

@Injectable()
export class SummaryExtractionService {
  extractHighlights(summaryText: string) {
    return summaryText
      .split(/\n+/)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((detail, index) => ({
        title: `Highlight ${index + 1}`,
        detail
      }));
  }
}
