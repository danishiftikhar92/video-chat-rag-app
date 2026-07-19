import { Module } from '@nestjs/common';
import { GuardrailController } from './guardrail.controller';
import { GuardrailService } from './guardrail.service';

@Module({
  controllers: [GuardrailController],
  providers: [GuardrailService],
  exports: [GuardrailService]
})
export class GuardrailsModule {}
