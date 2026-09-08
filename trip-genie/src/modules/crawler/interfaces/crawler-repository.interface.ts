import { BudgetLevel } from '@prisma/client';

export interface ICrawlerRepository {
  getAreaById(areaId: number): Promise<any | null>;
  getCategoryBySlug(slug: string): Promise<any | null>;
  getCategoryMap(): Promise<Map<string, number>>;
  findPlaceSourceByExternal(provider: string, externalId: string): Promise<any | null>;
  findNearbyPlaces(lat: number, lng: number, radiusMeters: number): Promise<any[]>;
  getPlaceById(id: string): Promise<any | null>;
  getUnenrichedPlacesByArea(areaId: number, limit?: number): Promise<any[]>;
  updatePlace(id: string, data: UpdatePlaceInput): Promise<any>;
  createPlace(data: CreatePlaceInput): Promise<any>;
  createPlaceImages(placeId: string, photoUrls: string[], sourceName?: string): Promise<number>;
  createPlaceSource(data: CreatePlaceSourceInput): Promise<any>;
  updatePlaceSource(id: string, data: UpdatePlaceSourceInput): Promise<any>;
  createCrawlJob(data: CreateCrawlJobInput): Promise<any>;
  updateCrawlJob(id: string, data: UpdateCrawlJobInput): Promise<any>;
  getCrawlJobById(id: string): Promise<any | null>;
  upsertDataCoverage(areaId: number, data: UpsertCoverageInput): Promise<any>;
  countActivePlacesByArea(areaId: number): Promise<number>;
}

export interface UpdatePlaceInput {
  name?: string;
  nameNormalized?: string;
  description?: string | null;
  latitude?: number;
  longitude?: number;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: any | null;
  priceLevel?: BudgetLevel | null;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  tags?: string[];
  status?: string;
}

export interface CreatePlaceInput {
  name: string;
  nameNormalized: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  categoryId: number;
  areaId: number;
  tags: string[];
  status: string;
  phone?: string | null;
  website?: string | null;
  openingHours?: any | null;
}

export interface CreatePlaceSourceInput {
  placeId: string;
  provider: string;
  externalId: string;
  externalUrl?: string | null;
  rawData?: any;
  lastSyncedAt: Date;
}

export interface UpdatePlaceSourceInput {
  externalUrl?: string | null;
  rawData?: any;
  lastSyncedAt?: Date;
}

export interface CreateCrawlJobInput {
  areaId: number;
  jobType: string;
  provider: string;
  status: string;
  createdBy?: string | null;
}

export interface UpdateCrawlJobInput {
  status?: string;
  totalItems?: number;
  processedItems?: number;
  insertedCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
  errorCount?: number;
  checkpoint?: any;
  lastError?: string | null;
  startedAt?: Date;
  completedAt?: Date;
}

export interface UpsertCoverageInput {
  placeCount: number;
  status: string;
  lastCrawledAt: Date;
}
