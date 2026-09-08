import { Module } from '@nestjs/common';
import { CrawlerController } from './crawler.controller';
import { CrawlJobService } from './services/crawl-job.service';
import { OsmIngestionService } from './services/osm-ingestion.service';
import { DeduplicationService } from './services/deduplication.service';
import { PlaceEnrichmentService } from './services/place-enrichment.service';
import { OsmProvider } from './providers/osm.provider';
import { FoursquareProvider } from './providers/foursquare.provider';
import { WikimediaProvider } from './providers/wikimedia.provider';
import { CrawlerRepository } from './crawler.repository';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  controllers: [CrawlerController],
  providers: [
    DeduplicationService,
    PlaceEnrichmentService,

    // Repository — bound to ICrawlerRepository via token
    {
      provide: INJECT_TOKENS.CRAWLER_REPOSITORY,
      useClass: CrawlerRepository,
    },

    // Data Providers — OSM, Foursquare, Wikimedia
    {
      provide: INJECT_TOKENS.OSM_PROVIDER,
      useClass: OsmProvider,
    },
    {
      provide: INJECT_TOKENS.FOURSQUARE_PROVIDER,
      useClass: FoursquareProvider,
    },
    {
      provide: INJECT_TOKENS.WIKIMEDIA_PROVIDER,
      useClass: WikimediaProvider,
    },

    // Ingestion Service — implements IIngestionService
    {
      provide: INJECT_TOKENS.OSM_INGESTION_SERVICE,
      useClass: OsmIngestionService,
    },

    CrawlJobService,
  ],
  exports: [CrawlJobService, PlaceEnrichmentService],
})
export class CrawlerModule {}
