import { Injectable } from '@nestjs/common';
import { createLlmGatewayFromEnv, type LlmGateway, type LlmModelsResponse } from '../../shared';
import { getEnv } from '../../config/env';

@Injectable()
export class LlmService {
  private readonly gateway: LlmGateway = createLlmGatewayFromEnv(getEnv());

  listModels(): LlmModelsResponse {
    return {
      defaultModel: this.gateway.getDefaultModel(),
      models: this.gateway.listModels()
    };
  }
}
