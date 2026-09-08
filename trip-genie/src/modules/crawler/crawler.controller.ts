import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrawlJobService } from './services/crawl-job.service';
import { TriggerRegionCrawlDto } from './dto/trigger-region-crawl.dto';
import { TriggerCrawlResponseDto, CrawlJobStatusDto } from './dto/crawl-job-response.dto';

/** Minimal typed request interface — avoids `any` on req */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlJobService: CrawlJobService) {}

  /**
   * Trigger a new region crawl job.
   * Restricted to ADMIN role via JWT payload check.
   * TODO: Replace with @Roles('ADMIN') + RolesGuard when roles module is ready.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — job started but not yet done
  async triggerCrawl(
    @Body() dto: TriggerRegionCrawlDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TriggerCrawlResponseDto> {
    return this.crawlJobService.triggerRegionCrawl(dto, req.user.id);
  }

  /**
   * Poll the status of a running or completed crawl job.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('jobs/:id')
  async getJobStatus(@Param('id') id: string): Promise<CrawlJobStatusDto> {
    return this.crawlJobService.getJobStatus(id);
  }
}
