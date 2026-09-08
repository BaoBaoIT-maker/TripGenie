import { Injectable, Logger } from '@nestjs/common';
import { TravelArea, Category, PlaceSource, CrawlJob, DataCoverage } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ICrawlerRepository,
  CreatePlaceInput,
  CreatePlaceSourceInput,
  UpdatePlaceSourceInput,
  CreateCrawlJobInput,
  UpdateCrawlJobInput,
  UpsertCoverageInput,
} from './interfaces/crawler-repository.interface';
import { PlaceStatus } from '../../common/enums/crawler.enum';

@Injectable()
export class CrawlerRepository implements ICrawlerRepository {
  private readonly logger = new Logger(CrawlerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAreaById(areaId: number): Promise<TravelArea | null> {
    return this.prisma.travelArea.findUnique({
      where: { id: areaId },
    });
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { slug },
    });
  }

  async getCategoryMap(): Promise<Map<string, number>> {
    const categories = await this.prisma.category.findMany();
    const map = new Map<string, number>();
    for (const cat of categories) {
      map.set(cat.slug, cat.id);
    }
    return map;
  }

  async findPlaceSourceByExternal(provider: string, externalId: string): Promise<PlaceSource | null> {
    return this.prisma.placeSource.findUnique({
      where: {
        provider_externalId: { provider, externalId },
      },
      include: { place: true },
    });
  }

  async findNearbyPlaces(lat: number, lng: number, radiusMeters: number): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT id, name, name_normalized, category_id, area_id
      FROM places
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        ${radiusMeters}
      )
      AND status != ${PlaceStatus.DUPLICATE}::place_status_enum
    `;
  }

  async getPlaceById(id: string): Promise<any | null> {
    return this.prisma.place.findUnique({
      where: { id },
    });
  }

  async getUnenrichedPlacesByArea(areaId: number, limit: number = 50): Promise<any[]> {
    return this.prisma.place.findMany({
      where: {
        areaId,
        status: PlaceStatus.ACTIVE,
        deletedAt: null,
        OR: [
          { ratingAvg: null as any },
          { priceLevel: null as any },
          { openingHours: null as any },
        ],
      },
      take: limit,
    });
  }

  async updatePlace(id: string, data: any): Promise<any> {
    return this.prisma.place.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.nameNormalized && { nameNormalized: data.nameNormalized }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.openingHours !== undefined && { openingHours: data.openingHours }),
        ...(data.priceLevel !== undefined && { priceLevel: data.priceLevel }),
        ...(data.ratingAvg !== undefined && { ratingAvg: data.ratingAvg }),
        ...(data.ratingCount !== undefined && { ratingCount: data.ratingCount }),
        ...(data.tags && { tags: data.tags }),
      },
    });
  }

  async createPlace(data: CreatePlaceInput): Promise<any> {
    // Raw query needed for PostGIS geometry type
    const result = await this.prisma.$queryRaw`
      INSERT INTO places (
        id, name, name_normalized, description, latitude, longitude,
        location, address, category_id, area_id, status, tags,
        phone, website, opening_hours
      )
      VALUES (
        uuid_generate_v4(),
        ${data.name},
        ${data.nameNormalized},
        ${data.description ?? null},
        ${data.latitude},
        ${data.longitude},
        ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326),
        ${data.address ?? null},
        ${data.categoryId},
        ${data.areaId},
        ${data.status}::place_status_enum,
        ${data.tags},
        ${data.phone ?? null},
        ${data.website ?? null},
        ${data.openingHours ? JSON.stringify(data.openingHours) : null}::jsonb
      )
      RETURNING *;
    `;
    return (result as any[])[0];
  }

  async createPlaceSource(data: CreatePlaceSourceInput): Promise<PlaceSource> {
    return this.prisma.placeSource.create({
      data: {
        placeId: data.placeId,
        provider: data.provider,
        externalId: data.externalId,
        externalUrl: data.externalUrl ?? null,
        rawData: data.rawData ?? undefined,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  async updatePlaceSource(id: string, data: UpdatePlaceSourceInput): Promise<PlaceSource> {
    return this.prisma.placeSource.update({
      where: { id },
      data: {
        externalUrl: data.externalUrl ?? undefined,
        rawData: data.rawData ?? undefined,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  async createCrawlJob(data: CreateCrawlJobInput): Promise<CrawlJob> {
    return this.prisma.crawlJob.create({
      data: {
        areaId: data.areaId,
        jobType: data.jobType as any,
        provider: data.provider,
        status: data.status as any,
        createdBy: data.createdBy ?? null,
        startedAt: new Date(),
      },
    });
  }

  async updateCrawlJob(id: string, data: UpdateCrawlJobInput): Promise<CrawlJob> {
    return this.prisma.crawlJob.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status as any }),
        ...(data.totalItems !== undefined && { totalItems: data.totalItems }),
        ...(data.processedItems !== undefined && { processedItems: data.processedItems }),
        ...(data.insertedCount !== undefined && { insertedCount: data.insertedCount }),
        ...(data.updatedCount !== undefined && { updatedCount: data.updatedCount }),
        ...(data.duplicateCount !== undefined && { duplicateCount: data.duplicateCount }),
        ...(data.errorCount !== undefined && { errorCount: data.errorCount }),
        ...(data.checkpoint !== undefined && { checkpoint: data.checkpoint }),
        ...(data.lastError !== undefined && { lastError: data.lastError }),
        ...(data.startedAt && { startedAt: data.startedAt }),
        ...(data.completedAt && { completedAt: data.completedAt }),
      },
    });
  }

  async getCrawlJobById(id: string): Promise<CrawlJob | null> {
    return this.prisma.crawlJob.findUnique({
      where: { id },
    });
  }

  async upsertDataCoverage(areaId: number, data: UpsertCoverageInput): Promise<DataCoverage> {
    return this.prisma.dataCoverage.upsert({
      where: { areaId },
      create: {
        areaId,
        placeCount: data.placeCount,
        status: data.status as any,
        lastCrawledAt: data.lastCrawledAt,
      },
      update: {
        placeCount: data.placeCount,
        status: data.status as any,
        lastCrawledAt: data.lastCrawledAt,
      },
    });
  }

  async countActivePlacesByArea(areaId: number): Promise<number> {
    return this.prisma.place.count({
      where: {
        areaId,
        status: PlaceStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }
}
