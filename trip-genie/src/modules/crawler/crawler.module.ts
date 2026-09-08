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

    // Individual Provider Classes
    OsmProvider,
    FoursquareProvider,
    WikimediaProvider,

    // Data Ingestion Provider Token
    {
      provide: INJECT_TOKENS.OSM_PROVIDER,
      useClass: OsmProvider,
    },

    // Multi-Provider Enrichment Array Token (Plug & Play Chain of Responsibility)
    {
      provide: INJECT_TOKENS.ENRICHMENT_PROVIDERS,
      useFactory: (fsq: FoursquareProvider, wiki: WikimediaProvider) => [wiki, fsq], // Order: Wiki landmark photos first, then Foursquare ratings
      inject: [FoursquareProvider, WikimediaProvider],
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
