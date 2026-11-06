import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Collection, CollectionPlace, Prisma } from '@prisma/client';
import {
  ICollectionsRepository,
  CollectionWithCount,
  CollectionDetail,
  DEFAULT_COLLECTION_TITLE,
  DEFAULT_COLLECTION_DESCRIPTION,
} from './interfaces/collections-repository.interface';

@Injectable()
export class CollectionsRepository implements ICollectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserCollections(userId: string): Promise<CollectionWithCount[]> {
    const collections = await this.prisma.collection.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { places: true },
        },
        places: {
          take: 4,
          select: {
            place: {
              select: {
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { imageUrl: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return collections.map((col) => {
      const previewImages = col.places
        .map((p) => p.place.images[0]?.imageUrl)
        .filter(Boolean) as string[];

      const { places, ...rest } = col;
      return {
        ...rest,
        previewImages,
      } as CollectionWithCount;
    });
  }

  async findCollectionById(id: string): Promise<CollectionDetail | null> {
    const col = await this.prisma.collection.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { places: true },
        },
        places: {
          orderBy: { addedAt: 'desc' },
          include: {
            place: {
              select: {
                id: true,
                name: true,
                description: true,
                address: true,
                latitude: true,
                longitude: true,
                ratingAvg: true,
                reviewCount: true,
                priceLevel: true,
                priceRange: true,
                category: {
                  select: {
                    name: true,
                    nameVi: true,
                    slug: true,
                  },
                },
                area: {
                  select: {
                    name: true,
                    nameVi: true,
                    slug: true,
                  },
                },
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: {
                    imageUrl: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return col as unknown as CollectionDetail | null;
  }

  async createCollection(data: {
    userId: string;
    title: string;
    description?: string;
    isPublic?: boolean;
    coverImage?: string;
  }): Promise<Collection> {
    return this.prisma.collection.create({
      data,
    });
  }

  async updateCollection(
    id: string,
    data: Prisma.CollectionUpdateInput,
  ): Promise<Collection> {
    return this.prisma.collection.update({
      where: { id },
      data,
    });
  }

  async softDeleteCollection(id: string): Promise<Collection> {
    return this.prisma.collection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findSavedPlaceIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.collectionPlace.findMany({
      where: {
        collection: {
          userId,
          deletedAt: null,
        },
      },
      select: { placeId: true },
      distinct: ['placeId'],
    });

    return rows.map((r) => r.placeId);
  }

  async addPlaceToCollection(
    collectionId: string,
    placeId: string,
    notes?: string,
  ): Promise<CollectionPlace> {
    return this.prisma.collectionPlace.upsert({
      where: {
        collectionId_placeId: { collectionId, placeId },
      },
      update: { notes: notes ?? undefined },
      create: { collectionId, placeId, notes },
    });
  }

  async removePlaceFromCollection(
    collectionId: string,
    placeId: string,
  ): Promise<void> {
    await this.prisma.collectionPlace.deleteMany({
      where: { collectionId, placeId },
    });
  }

  async isPlaceInCollection(
    collectionId: string,
    placeId: string,
  ): Promise<boolean> {
    const count = await this.prisma.collectionPlace.count({
      where: { collectionId, placeId },
    });
    return count > 0;
  }

  async findOrCreateDefaultCollection(userId: string): Promise<Collection> {
    let defaultCol = await this.prisma.collection.findFirst({
      where: {
        userId,
        title: DEFAULT_COLLECTION_TITLE,
        deletedAt: null,
      },
    });

    if (!defaultCol) {
      defaultCol = await this.prisma.collection.create({
        data: {
          userId,
          title: DEFAULT_COLLECTION_TITLE,
          description: DEFAULT_COLLECTION_DESCRIPTION,
          isPublic: false,
        },
      });
    }

    return defaultCol;
  }

  async findCollectionsContainingPlace(
    userId: string,
    placeId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.collectionPlace.findMany({
      where: {
        placeId,
        collection: {
          userId,
          deletedAt: null,
        },
      },
      select: { collectionId: true },
    });

    return rows.map((r) => r.collectionId);
  }
}

