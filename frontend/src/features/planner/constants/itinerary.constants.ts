/**
 * Domain constants and configuration for travel itineraries.
 * Strictly adheres to AGENTS.md (zero hard-coding, SOLID design, typed constants).
 */

import type { TransitMode } from '@/types/itinerary';

export const DEFAULT_TRIP_DAYS = 3;
export const DEFAULT_BUDGET_FALLBACK_TEXT = 'Theo thực tế';

/** Keep in sync with backend PRICING_CONFIG.PARTY_SCALING. */
export const PARTY_SIZE_BOUNDS = {
  MIN: 1,
  MAX: 20,
  DEFAULT: 1,
} as const;

/** Default map center fallback when no stop carries coordinates (Central Vietnam). */
export const DEFAULT_MAP_CENTER = {
  latitude: 16.0544,
  longitude: 108.2022,
} as const;

/** Contingency buffer ratio recommended alongside estimated trip ledger (10%). */
export const BUDGET_BUFFER_RATIO = 0.1;

/** Keep in sync with backend UpdateDestinationDto limits. */
export const DESTINATION_TIME_DEFAULTS = {
  DEFAULT_START: '09:00',
  DEFAULT_END: '10:30',
  MAX_NOTES_LENGTH: 400,
} as const;

export type WorkspaceTabKey = 'itinerary' | 'budget' | 'voting' | 'group';

export const TRANSIT_MODE_LABELS: Record<TransitMode, string> = {
  FLIGHT: 'Máy bay',
  SLEEPER_BUS: 'Xe khách',
  TRAIN: 'Tàu hỏa',
  PERSONAL_CAR: 'Ô tô cá nhân',
  PERSONAL_MOTORBIKE: 'Xe máy',
};

export interface CoverPhotoPreset {
  id: string;
  title: string;
  location: string;
  url: string;
}

/** HTTP statuses where retrying or polling cannot succeed (auth / permission / missing resource). */
export const NON_RETRYABLE_HTTP_STATUS: readonly number[] = [401, 403, 404];

/** Keep in sync with backend ITINERARY_META_LIMITS (generate-itinerary.dto.ts). */
export const ITINERARY_META_LIMITS = {
  MAX_TITLE_LENGTH: 160,
  MAX_DESCRIPTION_LENGTH: 600,
} as const;

export type ItineraryScope = 'ALL' | 'OWNED' | 'JOINED';

export interface ScopeOption {
  key: ItineraryScope;
  label: string;
  countLabel: string;
}

export const ITINERARY_SCOPE_OPTIONS: ScopeOption[] = [
  { key: 'ALL', label: 'Tất cả', countLabel: 'Tất cả' },
  { key: 'OWNED', label: 'Của tôi', countLabel: 'Tôi tạo' },
  { key: 'JOINED', label: 'Được mời', countLabel: 'Đồng hành' },
];

/**
 * Curated destination cover photo registry.
 * Extracted from UI components to prevent hardcoded URLs across the codebase.
 */
export const DESTINATION_COVERS: Record<string, string> = {
  hoian: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
  danang: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
  dalat: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  phuquoc: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  hanoi: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
  ninhbinh: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
  sapa: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
  nhatrang: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
};

export const FALLBACK_DESTINATION_COVER =
  'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80';

/**
 * Pure resolver: maps user destination to curated cover photo without hard-coding in components.
 */
export function getDestinationCover(destination?: string | null): string {
  if (!destination) return FALLBACK_DESTINATION_COVER;
  const clean = destination
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.includes('hoi an') || clean.includes('quang nam')) return DESTINATION_COVERS.hoian;
  if (clean.includes('da nang')) return DESTINATION_COVERS.danang;
  if (clean.includes('da lat') || clean.includes('lam dong')) return DESTINATION_COVERS.dalat;
  if (clean.includes('phu quoc') || clean.includes('kien giang')) return DESTINATION_COVERS.phuquoc;
  if (clean.includes('ha noi')) return DESTINATION_COVERS.hanoi;
  if (clean.includes('ninh binh') || clean.includes('trang an')) return DESTINATION_COVERS.ninhbinh;
  if (clean.includes('sa pa') || clean.includes('sapa') || clean.includes('lao cai')) return DESTINATION_COVERS.sapa;
  if (clean.includes('nha trang') || clean.includes('khanh hoa')) return DESTINATION_COVERS.nhatrang;

  return FALLBACK_DESTINATION_COVER;
}

export const COVER_PHOTO_PRESETS: readonly CoverPhotoPreset[] = [
  {
    id: 'bana-hills',
    title: 'Cầu Vàng & Bà Nà Hills',
    location: 'Đà Nẵng',
    url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'my-khe',
    title: 'Biển Mỹ Khê & Bán đảo Sơn Trà',
    location: 'Đà Nẵng',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'hoi-an',
    title: 'Phố cổ Hội An đèn lồng',
    location: 'Quảng Nam',
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'da-lat',
    title: 'Thành phố sương mù & đồi thông',
    location: 'Đà Lạt',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ha-noi',
    title: 'Hồ Hoàn Kiếm & Phố cổ',
    location: 'Hà Nội',
    url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ha-long',
    title: 'Vịnh Hạ Long kỳ vĩ',
    location: 'Quảng Ninh',
    url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'phu-quoc',
    title: 'Hoàng hôn biển ngọc',
    location: 'Phú Quốc',
    url: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'sa-pa',
    title: 'Ruộng bậc thang & núi rừng',
    location: 'Sa Pa / Lào Cai',
    url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'ninh-binh',
    title: 'Quần thể danh thắng Tràng An',
    location: 'Ninh Bình',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'nha-trang',
    title: 'Vịnh biển Nha Trang ngát xanh',
    location: 'Khánh Hòa',
    url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&auto=format&fit=crop&q=80',
  },
];
