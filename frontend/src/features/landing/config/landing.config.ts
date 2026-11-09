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

export const LANDING_CONFIG = {
  hero: {
    videoSrc: "/videos/hero.mp4",
    posterSrc: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1920&auto=format&fit=crop&q=80",
    badgeText: "Nền tảng Lập Kế hoạch Du lịch & Đồng hành Thời gian thực",
    headlineLine1: "Khám phá Việt Nam,",
    headlineLine2: "theo cách của riêng bạn",
    subtitle:
      "Tự động sắp xếp lịch trình chi tiết từng giờ, tính toán chi phí minh bạch và đồng bộ thời gian thực cùng hội bạn thân mà không cần ghi chép thủ công.",
    defaultLocationTitle: "Vịnh Hạ Long, Quảng Ninh",
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
