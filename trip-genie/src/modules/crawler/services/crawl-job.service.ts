import { Inject, Injectable, Logger } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { OsmIngestionService } from './osm-ingestion.service';
import { TriggerRegionCrawlDto } from '../dto/trigger-region-crawl.dto';

@Injectable()
export class CrawlJobService {
  private readonly logger = new Logger(CrawlJobService.name);

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    private readonly osmIngestionService: OsmIngestionService,
  ) {}

  async triggerRegionCrawl(dto: TriggerRegionCrawlDto, userId: string): Promise<any> {
    const area = await this.crawlerRepo.getAreaById(dto.areaId);
    if (!area) {
      throw new Error(`Area ${dto.areaId} not found`);
    }

    // Create Job Record
    const job = await this.crawlerRepo.createCrawlJob({
      areaId: dto.areaId,
      jobType: 'REGION_CRAWL',
      provider: 'osm',
      status: 'PENDING',
      createdBy: userId,
    });

    this.logger.log(`Created Job ${job.id} for Area ${area.name}`);

    // Fire and forget (in a real app, this goes to BullMQ)
    this.osmIngestionService.processArea(job.id, area.id).catch((err) => {
      this.logger.error(`Background job error: ${err.message}`);
    });

    return {
      message: 'Crawl job started',
      jobId: job.id,
      area: area.name,
    };
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.crawlerRepo.getCrawlJobById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  }
}
