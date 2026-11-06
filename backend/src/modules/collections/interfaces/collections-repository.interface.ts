import { Collection, CollectionPlace, Prisma } from '@prisma/client';

export const DEFAULT_COLLECTION_TITLE = 'Yêu thích';
export const DEFAULT_COLLECTION_DESCRIPTION =
  'Bộ sưu tập các địa điểm yêu thích của bạn';

export type CollectionWithCount = Collection & {
  _count: { places: number };
  previewImages?: string[];
};

export type CollectionPlaceDetail = CollectionPlace & {
  place: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    ratingAvg: number | null;
    reviewCount: number | null;
    priceLevel: string | null;
    priceRange: unknown;
    category: {
      name: string;
      nameVi: string | null;
      slug: string;
    } | null;
    area: {
      name: string;
      nameVi: string | null;
      slug: string;
    } | null;
    images: {
      imageUrl: string;
      thumbnailUrl: string | null;
    }[];
  };
};

export type CollectionDetail = Collection & {
  places: CollectionPlaceDetail[];
  _count: { places: number };
};

export interface ICollectionsRepository {
  findUserCollections(userId: string): Promise<CollectionWithCount[]>;
  findCollectionById(id: string): Promise<CollectionDetail | null>;
  createCollection(data: {
    userId: string;
    title: string;
    description?: string;
    isPublic?: boolean;
    coverImage?: string;
  }): Promise<Collection>;
  updateCollection(
    id: string,
    data: Prisma.CollectionUpdateInput,
  ): Promise<Collection>;
  softDeleteCollection(id: string): Promise<Collection>;
  findSavedPlaceIds(userId: string): Promise<string[]>;
  addPlaceToCollection(
    collectionId: string,
    placeId: string,
    notes?: string,
  ): Promise<CollectionPlace>;
  removePlaceFromCollection(
    collectionId: string,
    placeId: string,
  ): Promise<void>;
  isPlaceInCollection(
    collectionId: string,
    placeId: string,
  ): Promise<boolean>;
  findOrCreateDefaultCollection(userId: string): Promise<Collection>;
  findCollectionsContainingPlace(userId: string, placeId: string): Promise<string[]>;
}

