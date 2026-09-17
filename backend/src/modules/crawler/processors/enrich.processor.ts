import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CrawlerQueueName } from '../../../common/enums/crawler.enum';
import { PlaceEnrichmentService } from '../services/place-enrichment.service';

export interface AreaEnrichJobData {
  areaId: number;
  limit?: number;
}

@Processor(CrawlerQueueName.ENRICH)
export class EnrichProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichProcessor.name);

  constructor(private readonly placeEnrichmentService: PlaceEnrichmentService) {
    super();
  }

  async process(job: Job<AreaEnrichJobData>): Promise<any> {
    const { areaId, limit } = job.data;
    this.logger.log(`[BullMQ] Processing enrichment for Area ${areaId} (limit: ${limit || 50}), Attempt ${job.attemptsMade + 1}`);

    await job.updateProgress(10);
    const result = await this.placeEnrichmentService.enrichPlacesByArea(areaId, limit || 50);
    await job.updateProgress(100);

    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AreaEnrichJobData>) {
    this.logger.log(`[BullMQ] Enrichment job for Area ${job.data.areaId} completed successfully!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AreaEnrichJobData>, error: Error) {
    this.logger.error(
      `[BullMQ] Enrichment job for Area ${job.data.areaId} failed (Attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
    );
  }
}
