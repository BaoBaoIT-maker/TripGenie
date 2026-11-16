import type { TransitMode, IntracityMode, BudgetLevel, TravelPace } from '@/types/itinerary';

export const WIZARD_DEFAULTS = {
  ORIGIN_CITY: 'TP. Hồ Chí Minh',
  DESTINATION_CITY: 'Đà Nẵng',
  TRANSIT_MODE: 'FLIGHT' as TransitMode,
  INTRACITY_MODE: 'MOTORBIKE_RENTAL' as IntracityMode,
  BUDGET_LEVEL: 'MEDIUM' as BudgetLevel,
  PACE: 'BALANCED' as TravelPace,
  DEFAULT_DAYS: 3,
  DEBOUNCE_MS: 350,
} as const;

export interface VehicleOption {
  id: TransitMode;
  title: string;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: 'FLIGHT',
    title: 'Máy bay',
  },
  {
    id: 'TRAIN',
    title: 'Tàu hỏa',
  },
  {
    id: 'SLEEPER_BUS',
    title: 'Xe khách',
  },
  {
    id: 'PERSONAL_MOTORBIKE',
    title: 'Xe cá nhân',
  },
];

export interface IntracityOption {
  id: IntracityMode;
  title: string;
  priceText: string;
}

export const INTRACITY_OPTIONS: IntracityOption[] = [
  {
    id: 'MOTORBIKE_RENTAL',
    title: 'Thuê xe máy',
    priceText: '~150k – 180k/ngày',
  },
  {
    id: 'GRAB_BIKE',
    title: 'Xe công nghệ (Grab/Be)',
    priceText: 'Gọi chuyến linh hoạt',
  },
  {
    id: 'TAXI_CAR',
    title: 'Taxi / Xe du lịch',
    priceText: 'Phù hợp gia đình & nhóm',
  },
];

export interface BudgetOption {
  id: BudgetLevel;
  title: string;
  dailyCost: string;
  desc: string;
}

export const BUDGET_OPTIONS: BudgetOption[] = [
  {
    id: 'LOW',
    title: 'Tiết kiệm',
    dailyCost: '~400k/ngày',
    desc: 'Homestay, ăn uống dân dã',
  },
  {
    id: 'MEDIUM',
    title: 'Tiêu chuẩn',
    dailyCost: '~1.000k/ngày',
    desc: 'Khách sạn 3-4★, ăn uống đa dạng',
  },
  {
    id: 'HIGH',
    title: 'Sang trọng',
    dailyCost: '~2.500k/ngày',
    desc: 'Resort 5★, fine dining & xe riêng',
  },
];

export const TRAVEL_STYLE_TAGS = [
  'Ẩm thực đặc sản',
  'Cafe & Check-in',
  'Văn hóa & Lịch sử',
  'Nghỉ dưỡng & Biển',
  'Chữa lành & Chill',
  'Khám phá bản địa',
] as const;

export const STYLE_PROFILE_MAP: Record<string, string> = {
  CULTURE: 'Văn hóa & Lịch sử',
  FOOD: 'Ẩm thực đặc sản',
  CHILL: 'Cafe & Check-in',
  NATURE: 'Nghỉ dưỡng & Biển',
  ADVENTURE: 'Khám phá bản địa',
  CHECKIN: 'Cafe & Check-in',
  HEALING: 'Chữa lành & Chill',
};
