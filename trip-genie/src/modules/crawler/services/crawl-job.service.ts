import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { IIngestionService } from '../interfaces/ingestion.interface';
import { TriggerRegionCrawlDto } from '../dto/trigger-region-crawl.dto';
import { CrawlJobStatusDto, TriggerCrawlResponseDto } from '../dto/crawl-job-response.dto';
import { CrawlJobStatus, CrawlJobType, CrawlProviderName } from '../../../common/enums/crawler.enum';

@Injectable()
export class CrawlJobService {
  private readonly logger = new Logger(CrawlJobService.name);

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    /**
     * Injected via OSM_INGESTION_SERVICE token.
     * CrawlJobService depends on IIngestionService abstraction (DIP).
     * Swapping to PasGoIngestionService requires zero changes here (OCP).
     */
    @Inject(INJECT_TOKENS.OSM_INGESTION_SERVICE)
    private readonly ingestionService: IIngestionService,
  ) {}

  async triggerRegionCrawl(
    dto: TriggerRegionCrawlDto,
    userId: string,
  ): Promise<TriggerCrawlResponseDto> {
    const area = await this.crawlerRepo.getAreaById(dto.areaId);
    if (!area) {
      throw new NotFoundException(`Area with id ${dto.areaId} not found`);
    }

    const job = await this.crawlerRepo.createCrawlJob({
      areaId: dto.areaId,
      jobType: CrawlJobType.REGION_CRAWL,
      provider: CrawlProviderName.OSM,
      status: CrawlJobStatus.PENDING,
      createdBy: userId,
    });

    this.logger.log(`Created crawl job ${job.id} for area "${area.name}"`);

    // Fire-and-forget: hand off to ingestion pipeline.
    // In production this will be replaced by a BullMQ enqueue call.
    this.ingestionService.processArea(job.id as string, area.id as number).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Background job ${job.id} threw: ${message}`);
    });

    return {
      message: 'Crawl job started successfully',
      jobId: job.id as string,
      area: area.name as string,
    };
  }

  async getJobStatus(jobId: string): Promise<CrawlJobStatusDto> {
    const job = await this.crawlerRepo.getCrawlJobById(jobId);
    if (!job) {
      throw new NotFoundException(`Crawl job "${jobId}" not found`);
    }
    return job as CrawlJobStatusDto;
  }
}
