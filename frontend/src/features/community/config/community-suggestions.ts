/**
 * Danh sách gợi ý từ khóa hashtag và điểm đến cho tính năng autocomplete cộng đồng
 */

export const POPULAR_COMMUNITY_TAGS = [
  // Điểm đến hot
  '#DaLat',
  '#DaNang',
  '#PhuQuoc',
  '#HoiAn',
  '#HaNoi',
  '#Saigon',
  '#NhaTrang',
  '#VungTau',
  '#HaGiang',
  '#Sapa',
  '#NinhBinh',
  '#QuyNhon',
  '#Hue',
  '#PhanThiet',
  '#PhuYen',
  '#TayBac',
  '#CaoBang',
  // Chủ đề & phong cách
  '#SanMay',
  '#FoodTour',
  '#AmThuc',
  '#CheckIn',
  '#SongAo',
  '#DuLichTuTuc',
  '#ReviewDuLich',
  '#Phuot',
  '#KhamPha',
  '#Chill',
  '#CafeDep',
  '#Trekking',
  '#Camping',
  '#Bikepacking',
  '#DuLichGiaDinh',
  '#DuLichTietKiem',
  '#NghiDuong',
] as const;

export const POPULAR_COMMUNITY_DESTINATIONS = [
  { name: 'Đà Lạt', province: 'Lâm Đồng' },
  { name: 'Đà Nẵng', province: 'Đà Nẵng' },
  { name: 'Phú Quốc', province: 'Kiên Giang' },
  { name: 'Hội An', province: 'Quảng Nam' },
  { name: 'Hà Nội', province: 'Hà Nội' },
  { name: 'TP. Hồ Chí Minh', province: 'Hồ Chí Minh' },
  { name: 'Nha Trang', province: 'Khánh Hòa' },
  { name: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu' },
  { name: 'Sa Pa', province: 'Lào Cai' },
  { name: 'Hà Giang', province: 'Hà Giang' },
  { name: 'Ninh Bình', province: 'Ninh Bình' },
  { name: 'Quy Nhơn', province: 'Bình Định' },
  { name: 'Huế', province: 'Thừa Thiên Huế' },
  { name: 'Phan Thiết', province: 'Bình Thuận' },
  { name: 'Phú Yên', province: 'Phú Yên' },
] as const;

/**
 * Chuẩn hóa chuỗi tìm kiếm không dấu để so khớp linh hoạt
 */
export function normalizeKeyword(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}
