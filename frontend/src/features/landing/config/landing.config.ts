export interface DestinationOption {
  value: string;
  label: string;
  locationName: string;
}

export interface DurationOption {
  value: string;
  label: string;
  days: number;
}

export interface VibeOption {
  value: string;
  label: string;
}

export interface QuickSuggestion {
  label: string;
  href: string;
}

export const LANDING_CONFIG = {
  hero: {
    videoSrc:
      "https://res.cloudinary.com/drhe1rp0y/video/upload/f_auto,q_auto/v1795148758/tripgenie/assets/hero_original.mp4",
    posterSrc:
      "https://res.cloudinary.com/drhe1rp0y/video/upload/f_auto,q_auto/v1795148758/tripgenie/assets/hero_original.jpg",
    badgeText: "Lên lịch trình thông minh",
    headlineLine1: "Khám phá Việt Nam",
    headlineLine2: "theo cách của bạn",
    defaultLocationTitle: "Vịnh Hạ Long, Quảng Ninh",
    quickSuggestions: [
      { label: "Đà Nẵng", href: "/explore?area=da-nang" },
      { label: "Phú Quốc", href: "/explore?area=phu-quoc" },
      { label: "Hội An", href: "/explore?area=hoi-an" },
      { label: "Hà Nội", href: "/explore?area=ha-noi" },
      { label: "Sa Pa", href: "/explore?area=sa-pa" },
    ] as QuickSuggestion[],
  },
  destinations: [
    {
      value: "ha-long",
      label: "Hạ Long — Kỳ quan di sản",
      locationName: "Vịnh Hạ Long, Quảng Ninh",
    },
    {
      value: "da-nang",
      label: "Đà Nẵng — Hội An",
      locationName: "Bán đảo Sơn Trà & Biển Mỹ Khê, Đà Nẵng",
    },
    {
      value: "ha-noi",
      label: "Hà Nội — Phố cổ 36 phố",
      locationName: "Hồ Gươm & Phố Cổ 36 Phố, Hà Nội",
    },
    {
      value: "phu-quoc",
      label: "Phú Quốc — Đảo ngọc",
      locationName: "Bãi Sao & Hòn Thơm, Phú Quốc",
    },
    {
      value: "sa-pa",
      label: "Sa Pa — Mây ngàn",
      locationName: "Đèo Ô Quy Hồ & Bản Tả Van, Sa Pa",
    },
    {
      value: "da-lat",
      label: "Đà Lạt — Thành phố sương mù",
      locationName: "Hồ Tuyền Lâm & Rừng Thông, Đà Lạt",
    },
  ] as DestinationOption[],
  durations: [
    { value: "3", label: "3 Ngày 2 Đêm (Tiêu chuẩn)", days: 3 },
    { value: "2", label: "2 Ngày 1 Đêm (Cuối tuần)", days: 2 },
    { value: "4", label: "4 Ngày 3 Đêm (Trọn vẹn)", days: 4 },
  ] as DurationOption[],
  vibes: [
    { value: "foodie", label: "Ăn quán bản địa & Cafe chill" },
    { value: "relax", label: "Nghỉ dưỡng & Chữa lành" },
    { value: "checkin", label: "Check-in danh lam & Di sản" },
  ] as VibeOption[],
};
