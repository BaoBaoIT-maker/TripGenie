import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class CrawlerRepository implements ICrawlerRepository {
  private readonly logger = new Logger(CrawlerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAreaById(areaId: number): Promise<any | null> {
    return this.prisma.travelArea.findUnique({
      where: { id: areaId },
    });
  }

  async getCategoryBySlug(slug: string): Promise<any | null> {
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

  async findPlaceSourceByExternal(provider: string, externalId: string): Promise<any | null> {
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
      AND status != 'DUPLICATE'
    `;
  }

  async createPlace(data: CreatePlaceInput): Promise<any> {
    // Raw query needed for PostGIS geometry type
    const result = await this.prisma.$queryRaw`
      INSERT INTO places (
        id, name, name_normalized, description, latitude, longitude,
        location, address, category_id, area_id, status, tags
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
        ${data.tags}
      )
      RETURNING *;
    `;
    return (result as any[])[0];
  }

  async createPlaceSource(data: CreatePlaceSourceInput): Promise<any> {
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

  async updatePlaceSource(id: string, data: UpdatePlaceSourceInput): Promise<any> {
    return this.prisma.placeSource.update({
      where: { id },
      data: {
        externalUrl: data.externalUrl ?? undefined,
        rawData: data.rawData ?? undefined,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  async createCrawlJob(data: CreateCrawlJobInput): Promise<any> {
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

  async updateCrawlJob(id: string, data: UpdateCrawlJobInput): Promise<any> {
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

  async getCrawlJobById(id: string): Promise<any | null> {
    return this.prisma.crawlJob.findUnique({
      where: { id },
    });
  }

  async upsertDataCoverage(areaId: number, data: UpsertCoverageInput): Promise<any> {
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
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
  }
}
