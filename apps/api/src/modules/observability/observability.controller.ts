import { Body, Controller, Post } from '@nestjs/common';
import {
  feedbackRequestSchema,
  type FeedbackRequest,
  type FeedbackResponse
} from '../../shared';
import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Post('feedback')
  async feedback(@Body() body: unknown): Promise<FeedbackResponse> {
    const payload = feedbackRequestSchema.parse(body) as FeedbackRequest;
    await this.observability.recordFeedback(payload);
    return { ok: true, traceId: payload.traceId };
  }
}
