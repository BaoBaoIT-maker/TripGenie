import { BudgetLevel } from '@prisma/client';

export class PlaceCategoryDto {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  iconUrl: string | null;
}

export class PlaceAreaDto {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
}

export class PlaceImageDto {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  isPrimary: boolean;
  caption: string | null;
}

export class PlaceSourceDto {
  provider: string;
  externalUrl: string | null;
  sourceRating: number | null;
  sourceReviewCount: number | null;
}

export class PlaceItemDto {
  id: string;
  name: string;
  description: string | null;
  address: string;
  district: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  ratingAvg: number;
  reviewCount: number;
  imageCount: number;
  priceLevel: BudgetLevel | null;
  phone: string | null;
  website: string | null;
  openingHours: Record<string, unknown> | null;
  isOpenNow: boolean | null;
  primaryImage: string | null;
  category: PlaceCategoryDto | null;
  area: PlaceAreaDto | null;
}

export class PlaceDetailDto extends PlaceItemDto {
  priceRange: Record<string, unknown> | null;
  tags: string[];
  attributes: Record<string, unknown>;
  images: PlaceImageDto[];
  sources: PlaceSourceDto[];
}

export class PaginationMetaDto {
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PaginatedPlacesResponseDto {
  items: PlaceItemDto[];
  meta: PaginationMetaDto;
}

export class CategoryItemDto {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  iconUrl: string | null;
  sortOrder: number;
  placeCount?: number;
}

export class TravelAreaItemDto {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  type: string;
  bbox: {
    minLat: number | null;
    maxLat: number | null;
    minLng: number | null;
    maxLng: number | null;
  };
}
