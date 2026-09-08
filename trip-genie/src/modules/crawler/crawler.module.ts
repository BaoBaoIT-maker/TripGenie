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
    CrawlJobService,
    OsmIngestionService,
    DeduplicationService,
    {
      provide: INJECT_TOKENS.OSM_PROVIDER,
      useClass: OsmProvider,
    },
    {
      provide: INJECT_TOKENS.CRAWLER_REPOSITORY,
      useClass: CrawlerRepository,
    },
  ],
  exports: [CrawlJobService],
})
export class CrawlerModule {}
