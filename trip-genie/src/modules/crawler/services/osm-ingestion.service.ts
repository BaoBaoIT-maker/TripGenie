import { Inject, Injectable, Logger } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { ICrawlerProvider } from '../interfaces/provider.interface';
import { IIngestionService } from '../interfaces/ingestion.interface';
import { DeduplicationService } from './deduplication.service';
import { CrawlJobStatus, DataCoverageStatus, PlaceStatus } from '../../../common/enums/crawler.enum';

@Injectable()
export class OsmIngestionService implements IIngestionService {
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
      await this.crawlerRepo.updateCrawlJob(jobId, { status: CrawlJobStatus.FAILED });
      return;
    }

    await this.crawlerRepo.updateCrawlJob(jobId, { status: CrawlJobStatus.RUNNING });

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
      let errorCount = 0;
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
              address: place.address ?? '',
              categoryId: catId,
              areaId: area.id,
              tags: place.tags,
              status: PlaceStatus.ACTIVE,
            });
            finalPlaceId = newPlace.id as string;
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
            await this.crawlerRepo.updatePlaceSource(existingSource.id as string, {
              rawData: place.sourceData,
              lastSyncedAt: new Date(),
            });
          }

          // Flush progress to DB every 50 items to reduce write amplification
          if (processedItems % 50 === 0) {
            await this.crawlerRepo.updateCrawlJob(jobId, {
              processedItems,
              insertedCount,
              duplicateCount,
              errorCount,
            });
          }
        } catch (err) {
          errorCount++;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error processing OSM node ${place.externalId}: ${message}`);
        }
      }

      await this.crawlerRepo.updateCrawlJob(jobId, {
        status: CrawlJobStatus.COMPLETED,
        processedItems,
        insertedCount,
        duplicateCount,
        errorCount,
        completedAt: new Date(),
      });

      // Update data_coverage cache for this area
      const activeCount = await this.crawlerRepo.countActivePlacesByArea(area.id);
      await this.crawlerRepo.upsertDataCoverage(area.id, {
        placeCount: activeCount,
        status: DataCoverageStatus.PARTIAL,
        lastCrawledAt: new Date(),
      });

      this.logger.log(
        `Job ${jobId} completed: inserted=${insertedCount}, dupes=${duplicateCount}, errors=${errorCount}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.crawlerRepo.updateCrawlJob(jobId, {
        status: CrawlJobStatus.FAILED,
        lastError: message,
        completedAt: new Date(),
      });
    }
  }
}
