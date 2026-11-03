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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CrawlJobService } from './services/crawl-job.service';
import { TriggerRegionCrawlDto } from './dto/trigger-region-crawl.dto';
import { TriggerEnrichmentDto } from './dto/trigger-enrichment.dto';
import { TriggerCrawlResponseDto, CrawlJobStatusDto } from './dto/crawl-job-response.dto';
import { CrawlerQueueName } from '../../common/enums/crawler.enum';

/** Minimal typed request interface — avoids `any` on req */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

@Controller('crawler')
export class CrawlerController {
  constructor(
    private readonly crawlJobService: CrawlJobService,
    @InjectQueue(CrawlerQueueName.ENRICH)
    private readonly enrichQueue: Queue,
  ) {}

  /**
   * Trigger a new region crawl job.
   * Restricted to ADMIN role via JWT payload check.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — job queued
  async triggerCrawl(
    @Body() dto: TriggerRegionCrawlDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TriggerCrawlResponseDto> {
    return this.crawlJobService.triggerRegionCrawl(dto, req.user.id);
  }

  /**
   * Trigger enrichment pipeline for places in a given area via BullMQ queue.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('enrich')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — job queued
  async triggerEnrichment(
    @Body() dto: TriggerEnrichmentDto,
  ): Promise<{ message: string; jobId: string }> {
    const job = await this.enrichQueue.add(
      'area-enrich',
      { areaId: dto.areaId, limit: dto.limit || 50 },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: { count: 100 },
      },
    );

    return {
      message: `Enrichment job queued for area ${dto.areaId}`,
      jobId: String(job.id),
    };
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
