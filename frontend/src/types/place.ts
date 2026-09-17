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

export interface Place {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  whyGo?: string[];
  tips?: string[];
  suggestedDuration?: string; // "1.5 - 2 giờ"
  category: PlaceCategory;
  categoryLabel: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  priceLevel: 1 | 2 | 3 | 4; // 1: < 50k, 2: 50k-150k, 3: 150k-500k, 4: > 500k
  priceRangeText: string; // "45.000đ - 90.000đ"
  images: string[];
  coverImage: string;
  tags: string[];
  suitableFor: SuitableAudience[];
  styles: TravelStyle[];
  matchScore?: number; // Ví dụ: 95 (%)
  matchReason?: string; // "Vì bạn thích Cafe chill và view thung lũng"
  openingHoursText?: string; // "07:00 - 22:30 hàng ngày"
  featured?: boolean;
}
