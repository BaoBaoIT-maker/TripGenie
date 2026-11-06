export interface AmenityFilter {
  id: string;
  label: string;
}

export interface SuperCategory {
  id: string;
  label: string;
  slugs: string[];
  count: number;
  amenities: AmenityFilter[];
}

export const SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: "all",
    label: "Tất cả",
    slugs: [],
    count: 3197,
    amenities: [
      { id: "gan-bien", label: "Gần biển / View biển" },
      { id: "may-lanh", label: "Có máy lạnh" },
      { id: "wifi-manh", label: "Wifi tốc độ cao" },
      { id: "cho-do-xe", label: "Chỗ đỗ xe ô tô" },
      { id: "mien-phi", label: "Miễn phí vé" },
    ],
  },
  {
    id: "luu-tru",
    label: "Lưu trú & Nghỉ dưỡng",
    slugs: ["khach-san", "homestay", "spa"],
    count: 680,
    amenities: [
      { id: "ho-boi", label: "Có hồ bơi" },
      { id: "gan-bien", label: "Gần biển / View biển" },
      { id: "an-sang", label: "Bao gồm ăn sáng" },
      { id: "cho-do-xe", label: "Chỗ đỗ xe ô tô" },
      { id: "thu-cung", label: "Cho phép thú cưng" },
    ],
  },
  {
    id: "am-thuc",
    label: "Ẩm thực & Quán ăn",
    slugs: ["nha-hang", "an-vat-via-he"],
    count: 1111,
    amenities: [
      { id: "hai-san", label: "Hải sản tươi sống" },
      { id: "dac-san", label: "Đặc sản Đà Nẵng" },
      { id: "mon-chay", label: "Món chay" },
      { id: "ngoai-troi", label: "Bàn ngoài trời" },
      { id: "phong-rieng", label: "Phòng riêng VIP" },
    ],
  },
  {
    id: "ca-phe",
    label: "Cà phê & Tráng miệng",
    slugs: ["ca-phe"],
    count: 1119,
    amenities: [
      { id: "may-lanh", label: "Phòng máy lạnh" },
      { id: "wifi-manh", label: "Wifi làm việc" },
      { id: "o-cam-dien", label: "Nhiều ổ cắm" },
      { id: "view-dep", label: "View đẹp / Rooftop" },
      { id: "yen-tinh", label: "Yên tĩnh" },
      { id: "mo-khuya", label: "Mở khuya / 24-7" },
    ],
  },
  {
    id: "tham-quan",
    label: "Tham quan & Di tích",
    slugs: ["diem-tham-quan", "di-tich-lich-su", "thien-nhien"],
    count: 92,
    amenities: [
      { id: "mien-phi", label: "Miễn phí vé" },
      { id: "check-in", label: "Check-in chụp hình" },
      { id: "trong-nha", label: "Trong nhà" },
      { id: "tre-em", label: "Phù hợp trẻ em" },
    ],
  },
  {
    id: "giai-tri",
    label: "Vui chơi & Về đêm",
    slugs: ["bar-pub", "vui-choi"],
    count: 131,
    amenities: [
      { id: "nhac-song", label: "Nhạc sống / Acoustic" },
      { id: "cocktail", label: "Cocktail / Bia thủ công" },
      { id: "beach-club", label: "Beach club" },
    ],
  },
  {
    id: "mua-sam",
    label: "Chợ & Mua sắm",
    slugs: ["cho-sieu-thi"],
    count: 64,
    amenities: [
      { id: "dac-san-qua", label: "Đặc sản làm quà" },
      { id: "hai-san-kho", label: "Hải sản khô" },
      { id: "cho-dem", label: "Chợ đêm" },
    ],
  },
];
