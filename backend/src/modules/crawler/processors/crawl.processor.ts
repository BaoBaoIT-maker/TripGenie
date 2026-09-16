import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CrawlerQueueName } from '../../../common/enums/crawler.enum';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { IIngestionService } from '../interfaces/ingestion.interface';

export interface RegionCrawlJobData {
  jobId: string;
  areaId: number;
}

@Processor(CrawlerQueueName.CRAWL)
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    @Inject(INJECT_TOKENS.OSM_INGESTION_SERVICE)
    private readonly ingestionService: IIngestionService,
  ) {
    super();
  }

  async process(job: Job<RegionCrawlJobData>): Promise<any> {
    const { jobId, areaId } = job.data;
    this.logger.log(`[BullMQ] Starting process for job ${jobId} (Area: ${areaId}), Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);

    await job.updateProgress(10);
    const result = await this.ingestionService.processArea(jobId, areaId);
    await job.updateProgress(100);

    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RegionCrawlJobData>) {
    this.logger.log(`[BullMQ] Crawl job ${job.data.jobId} completed successfully!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RegionCrawlJobData>, error: Error) {
    this.logger.error(
      `[BullMQ] Crawl job ${job.data.jobId} failed (Attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
    );
  }
}
