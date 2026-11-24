export type PlaceCategory =
  | "cafe"
  | "restaurant"
  | "sightseeing"
  | "nature"
  | "entertainment"
  | "culture"
  | "nightlife"
  | "relaxation";

export type SuitableAudience =
  | "couple"
  | "family"
  | "friends"
  | "solo"
  | "kids";

export type TravelStyle =
  | "chill"
  | "checkin"
  | "foodie"
  | "nature"
  | "luxury"
  | "budget"
  | "adventure"
  | "healing";

export interface PlaceOpeningHour {
  dayOfWeek: number; // 0 - Sunday, 1 - Monday, ...
  open: string; // "07:00"
  close: string; // "22:00"
}

export const CONTRIBUTED_PHOTO_STATES = {
  UPLOADING: "uploading",
  PENDING: "pending",
  ERROR: "error",
} as const;

export type ContributedPhotoUploadState =
  (typeof CONTRIBUTED_PHOTO_STATES)[keyof typeof CONTRIBUTED_PHOTO_STATES];

export interface PendingContributedPhoto {
  id: string;
  imageUrl: string;
  caption?: string | null;
  uploadState?: ContributedPhotoUploadState;
  errorMessage?: string | null;
}

export interface PlaceAttributes {
  descriptionEn?: string;
  suggestedDuration?: string;
  whyGo?: string[];
  tips?: string[];
  [key: string]: unknown;
}

export interface Place {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  whyGo?: string[];
  tips?: string[];
  suggestedDuration?: string;
  category: PlaceCategory;
  categorySlug?: string;
  categoryLabel: string;
  categoryName?: string;
  categoryNameVi?: string | null;
  areaId?: number;
  areaSlug?: string;
  areaName?: string;
  areaNameVi?: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  priceLevel?: 1 | 2 | 3 | 4; // 1: < 50k, 2: 50k-150k, 3: 150k-500k, 4: > 500k
  priceRangeText?: string;
  images: string[];
  pendingContributedImages?: PendingContributedPhoto[];
  coverImage: string;
  phone?: string;
  website?: string;
  tags: string[];
  suitableFor: SuitableAudience[];
  styles: TravelStyle[];
  matchScore?: number; // Ví dụ: 95 (%)
  matchReason?: string;
  isOpenNow?: boolean | null;
  openingHoursText?: string;
  attributes?: PlaceAttributes;
  featured?: boolean;
  distanceKm?: number;
}
