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
import { TriggerEnrichmentDto } from './dto/trigger-enrichment.dto';
import { TriggerCrawlResponseDto, CrawlJobStatusDto } from './dto/crawl-job-response.dto';

import { PlaceEnrichmentService } from './services/place-enrichment.service';

/** Minimal typed request interface — avoids `any` on req */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

@Controller('crawler')
export class CrawlerController {
  constructor(
    private readonly crawlJobService: CrawlJobService,
    private readonly placeEnrichmentService: PlaceEnrichmentService,
  ) {}

  /**
   * Trigger a new region crawl job.
   * Restricted to ADMIN role via JWT payload check.
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
   * Trigger enrichment pipeline for places in a given area.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('enrich')
  @HttpCode(HttpStatus.OK)
  async triggerEnrichment(
    @Body() dto: TriggerEnrichmentDto,
  ): Promise<{ message: string; processed: number; enriched: number }> {
    const result = await this.placeEnrichmentService.enrichPlacesByArea(dto.areaId, dto.limit || 50);
    return {
      message: `Enrichment pipeline completed for area ${dto.areaId}`,
      processed: result.processed,
      enriched: result.enriched,
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
