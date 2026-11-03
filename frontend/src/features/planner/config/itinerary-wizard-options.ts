import type { TransitMode, IntracityMode, BudgetLevel, TravelPace } from '@/types/itinerary';

// ponytail: static list of covered cities; upgrade → GET /areas with place coverage
export const COVERED_CITIES: ReadonlyArray<{ label: string; value: string; areaId?: number }> = [
  { label: 'Đà Nẵng', value: 'Đà Nẵng', areaId: 5 },
  { label: 'Hội An', value: 'Hội An' },
  { label: 'Đà Lạt', value: 'Đà Lạt' },
  { label: 'Nha Trang', value: 'Nha Trang' },
  { label: 'Hà Nội', value: 'Hà Nội' },
  { label: 'TP. Hồ Chí Minh', value: 'TP. Hồ Chí Minh' },
  { label: 'Phú Quốc', value: 'Phú Quốc' },
  { label: 'Huế', value: 'Huế' },
];

export const ORIGIN_CITIES: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'TP. Hồ Chí Minh', value: 'TP. Hồ Chí Minh' },
  { label: 'Hà Nội', value: 'Hà Nội' },
  { label: 'Đà Nẵng', value: 'Đà Nẵng' },
  { label: 'Cần Thơ', value: 'Cần Thơ' },
  { label: 'Hải Phòng', value: 'Hải Phòng' },
];

export const TRANSIT_OPTIONS: ReadonlyArray<{ label: string; value: TransitMode; desc: string }> = [
  { label: 'Máy bay', value: 'FLIGHT', desc: 'Nhanh, phù hợp đường dài' },
  { label: 'Xe khách giường nằm', value: 'SLEEPER_BUS', desc: 'Tiết kiệm, ngủ trên xe' },
  { label: 'Tàu hỏa', value: 'TRAIN', desc: 'Ngắm cảnh, thoải mái' },
  { label: 'Ô tô cá nhân', value: 'PERSONAL_CAR', desc: 'Chủ động, linh hoạt' },
  { label: 'Xe máy cá nhân', value: 'PERSONAL_MOTORBIKE', desc: 'Phiêu lưu, tiết kiệm' },
];

export const INTRACITY_OPTIONS: ReadonlyArray<{ label: string; value: IntracityMode; desc: string }> = [
  { label: 'Thuê xe máy', value: 'MOTORBIKE_RENTAL', desc: 'Phổ biến, tự do' },
  { label: 'Grab xe máy', value: 'GRAB_BIKE', desc: 'Tiện lợi, không cần thuê' },
  { label: 'Taxi / Grab ô tô', value: 'TAXI_CAR', desc: 'Thoải mái, mưa nắng' },
];

export const BUDGET_OPTIONS: ReadonlyArray<{ label: string; value: BudgetLevel; desc: string }> = [
  { label: 'Tiết kiệm', value: 'LOW', desc: 'Hostel, ăn vỉa hè' },
  { label: 'Trung bình', value: 'MEDIUM', desc: 'Khách sạn 2–3 sao, quán ăn bình dân' },
  { label: 'Cao cấp', value: 'HIGH', desc: 'Khách sạn 4–5 sao, nhà hàng ngon' },
];

export const TRAVEL_STYLE_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Văn hóa', value: 'CULTURE' },
  { label: 'Ẩm thực', value: 'FOOD' },
  { label: 'Tham quan', value: 'SIGHTSEEING' },
  { label: 'Thư giãn', value: 'RELAX' },
  { label: 'Thiên nhiên', value: 'NATURE' },
];

export const PACE_OPTIONS: ReadonlyArray<{ label: string; value: TravelPace; desc: string }> = [
  { label: 'Thoải mái', value: 'RELAXED', desc: '2–3 điểm/ngày' },
  { label: 'Cân bằng', value: 'BALANCED', desc: '4–5 điểm/ngày' },
  { label: 'Dày đặc', value: 'PACKED', desc: '6–7 điểm/ngày' },
];

export const MAX_TRIP_DAYS = 30;
