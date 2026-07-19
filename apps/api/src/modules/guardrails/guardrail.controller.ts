import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createGuardRailSchema,
  updateGuardRailSchema,
  type CreateGuardRailInput,
  type UpdateGuardRailInput
} from '../../shared';
import { GuardrailService } from './guardrail.service';

@Controller('guardrails')
export class GuardrailController {
  constructor(private readonly guardrailService: GuardrailService) {}

  @Get()
  list() {
    return this.guardrailService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.guardrailService.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    const payload = createGuardRailSchema.parse(body) as CreateGuardRailInput;
    return this.guardrailService.create(payload);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const payload = updateGuardRailSchema.parse(body) as UpdateGuardRailInput;
    return this.guardrailService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.guardrailService.remove(id);
  }
}
