import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { TriggerRegionCrawlDto } from '../dto/trigger-region-crawl.dto';
import { CrawlJobStatusDto, TriggerCrawlResponseDto } from '../dto/crawl-job-response.dto';
import { CrawlJobStatus, CrawlJobType, CrawlProviderName, CrawlerQueueName } from '../../../common/enums/crawler.enum';

@Injectable()
export class CrawlJobService {
  private readonly logger = new Logger(CrawlJobService.name);

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    @InjectQueue(CrawlerQueueName.CRAWL)
    private readonly crawlQueue: Queue,
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

    this.logger.log(`Created crawl job ${job.id} for area "${area.name}". Pushing to BullMQ queue...`);

    // Hand off to BullMQ Queue Worker with auto-retry options (5 attempts, exponential backoff)
    await this.crawlQueue.add(
      'region-crawl',
      { jobId: job.id, areaId: dto.areaId },
      {
        jobId: job.id, // Use same UUID as database record
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    return {
      message: 'Crawl job started successfully via BullMQ Queue',
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
