/**
 * Centralized enums for the Crawler module.
 * All magic strings are replaced by these enums to enforce type-safety and DRY.
 */

export enum CrawlProviderName {
  OSM = 'osm',
  PASGO = 'pasgo',
  GOOGLE = 'google',
}

export enum CrawlJobType {
  REGION_CRAWL = 'REGION_CRAWL',
  PLACE_SYNC = 'PLACE_SYNC',
  EMBEDDING_GEN = 'EMBEDDING_GEN',
}

export enum CrawlJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum DataCoverageStatus {
  COMPLETE = 'COMPLETE',
  PARTIAL = 'PARTIAL',
  NOT_COVERED = 'NOT_COVERED',
  STALE = 'STALE',
}

export enum PlaceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  DUPLICATE = 'DUPLICATE',
}

export enum OsmCategorySlug {
  RESTAURANT = 'nha-hang',
  CAFE = 'ca-phe',
  STREET_FOOD = 'an-vat',
  BAR_PUB = 'bar-pub',
  ATTRACTION = 'diem-tham-quan',
  BEACH = 'bai-bien',
  HISTORICAL = 'di-tich',
  NATURE = 'thien-nhien',
  HOTEL = 'khach-san',
  HOMESTAY = 'homestay',
  SHOPPING = 'mua-sam',
  ENTERTAINMENT = 'vui-choi',
  SPORT = 'the-thao',
  SPA = 'spa',
  MARKET = 'cho-sieu-thi',
}

export enum CrawlerQueueName {
  CRAWL = 'crawl-queue',
  ENRICH = 'enrich-queue',
}
