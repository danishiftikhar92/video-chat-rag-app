import { Controller, Get, Param } from '@nestjs/common';
import { SummaryService } from './summary.service';

@Controller('videos/:id/summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  getSummary(@Param('id') id: string) {
    return this.summaryService.getSummary(id);
  }
}
