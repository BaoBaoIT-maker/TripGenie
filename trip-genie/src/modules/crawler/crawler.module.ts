import { Module } from '@nestjs/common';
import { CrawlerController } from './crawler.controller';
import { CrawlJobService } from './services/crawl-job.service';
import { OsmIngestionService } from './services/osm-ingestion.service';
import { DeduplicationService } from './services/deduplication.service';
import { OsmProvider } from './providers/osm.provider';
import { CrawlerRepository } from './crawler.repository';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  controllers: [CrawlerController],
  providers: [
    // Deduplication — used internally by OsmIngestionService
    DeduplicationService,

    // Repository — bound to ICrawlerRepository via token
    {
      provide: INJECT_TOKENS.CRAWLER_REPOSITORY,
      useClass: CrawlerRepository,
    },

    // Data Provider — OSM Overpass API
    {
      provide: INJECT_TOKENS.OSM_PROVIDER,
      useClass: OsmProvider,
    },

    // Ingestion Service — implements IIngestionService
    // Swap useClass here to change provider without touching CrawlJobService (OCP)
    {
      provide: INJECT_TOKENS.OSM_INGESTION_SERVICE,
      useClass: OsmIngestionService,
    },

    // Orchestration service — depends on IIngestionService (DIP)
    CrawlJobService,
  ],
  exports: [CrawlJobService],
})
export class CrawlerModule {}
