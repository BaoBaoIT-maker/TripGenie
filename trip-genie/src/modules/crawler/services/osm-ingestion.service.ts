import { Inject, Injectable, Logger } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { ICrawlerProvider } from '../interfaces/provider.interface';
import { DeduplicationService } from './deduplication.service';

@Injectable()
export class OsmIngestionService {
  private readonly logger = new Logger(OsmIngestionService.name);

  constructor(
    @Inject(INJECT_TOKENS.OSM_PROVIDER)
    private readonly provider: ICrawlerProvider,
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    private readonly deduplicationService: DeduplicationService,
  ) {}

  async processArea(jobId: string, areaId: number): Promise<void> {
    const job = await this.crawlerRepo.getCrawlJobById(jobId);
    if (!job) {
      this.logger.error(`Job ${jobId} not found`);
      return;
    }

    const area = await this.crawlerRepo.getAreaById(areaId);
    if (!area || !area.bboxMinLat) {
      this.logger.error(`Area ${areaId} invalid or missing bbox`);
      await this.crawlerRepo.updateCrawlJob(jobId, { status: 'FAILED' });
      return;
    }

    await this.crawlerRepo.updateCrawlJob(jobId, { status: 'RUNNING' });

    try {
      const places = await this.provider.fetchByBbox(
        area.bboxMinLat,
        area.bboxMaxLat,
        area.bboxMinLng,
        area.bboxMaxLng,
      );

      const categoryMap = await this.crawlerRepo.getCategoryMap();

      let insertedCount = 0;
      let duplicateCount = 0;
      let processedItems = 0;

      await this.crawlerRepo.updateCrawlJob(jobId, { totalItems: places.length });

      for (const place of places) {
        processedItems++;

        try {
          const catId = categoryMap.get(place.categorySlug);
          if (!catId) continue;

          const existingPlaceId = await this.deduplicationService.findDuplicate(place);

          let finalPlaceId: string | null = existingPlaceId;

          if (!existingPlaceId) {
            const newPlace = await this.crawlerRepo.createPlace({
              name: place.name,
              nameNormalized: place.nameNormalized,
              description: place.description,
              latitude: place.latitude,
              longitude: place.longitude,
              address: place.address,
              categoryId: catId,
              areaId: area.id,
              tags: place.tags,
              status: 'ACTIVE',
            });
            finalPlaceId = newPlace.id;
            insertedCount++;
          } else {
            duplicateCount++;
          }

          if (!finalPlaceId) continue;

          const existingSource = await this.crawlerRepo.findPlaceSourceByExternal(
            place.provider,
            place.externalId,
          );

          if (!existingSource) {
            await this.crawlerRepo.createPlaceSource({
              placeId: finalPlaceId,
              provider: place.provider,
              externalId: place.externalId,
              rawData: place.sourceData,
              lastSyncedAt: new Date(),
            });
          } else {
            await this.crawlerRepo.updatePlaceSource(existingSource.id, {
              rawData: place.sourceData,
              lastSyncedAt: new Date(),
            });
          }

          if (processedItems % 50 === 0) {
            await this.crawlerRepo.updateCrawlJob(jobId, {
              processedItems,
              insertedCount,
              duplicateCount,
            });
          }
        } catch (err) {
          this.logger.error(`Error processing item ${place.externalId}: ${err.message}`);
        }
      }

      await this.crawlerRepo.updateCrawlJob(jobId, {
        status: 'COMPLETED',
        processedItems,
        insertedCount,
        duplicateCount,
        completedAt: new Date(),
      });

      const activeCount = await this.crawlerRepo.countActivePlacesByArea(area.id);
      await this.crawlerRepo.upsertDataCoverage(area.id, {
        placeCount: activeCount,
        status: 'PARTIAL',
        lastCrawledAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.crawlerRepo.updateCrawlJob(jobId, {
        status: 'FAILED',
        lastError: error.message,
        completedAt: new Date(),
      });
    }
  }
}
