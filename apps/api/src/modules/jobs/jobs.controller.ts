import { Controller, Get, Param, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  listJobs() {
    return this.jobsService.listJobs();
  }

  @Get(':id')
  getJob(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }

  @Post(':id/retry')
  retryJob(@Param('id') id: string) {
    return this.jobsService.retryJob(id);
  }
}
