/**
 * Cấu hình hệ thống cào dữ liệu Google Maps ĐA TỈNH THÀNH (Đà Nẵng, TP.HCM, Lâm Đồng, An Giang)
 * Đường dẫn: backend/src/modules/crawler/config.js
 */
const path = require('path');
const fs = require('fs');

function getBravePath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const possiblePaths = [
    path.join(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    path.join(programFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    path.join(programFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// =============================================================================
// CẤU HÌNH TỈNH THÀNH & TỌA ĐỘ TRỌNG TÂM (ĐỒNG BỘ POSTGRES TRAVEL_AREAS)
// =============================================================================
const PROVINCES = {
  DANANG: {
    key: 'DANANG',
    slug: 'da-nang',
    name: 'Đà Nẵng',
    areaId: 5,
    areaName: 'Thành phố Đà Nẵng',
    city: 'Đà Nẵng',
    coords: '@16.0600,108.2200,13z',
    aliases: ['DANANG', 'DA-NANG', 'DN'],
    districts: ['Hải Châu', 'Sơn Trà', 'Ngũ Hành Sơn', 'Thanh Khê', 'Liên Chiểu', 'Cẩm Lệ'],
    customQueries: {
      STAY: [
        'khách sạn Đà Nẵng',
        'homestay Đà Nẵng',
        'resort Đà Nẵng',
        'khách sạn gần biển Đà Nẵng',
        'khách sạn Hải Châu Đà Nẵng',
        'khách sạn Sơn Trà Đà Nẵng',
        'homestay Ngũ Hành Sơn Đà Nẵng',
        'khách sạn view sông Hàn Đà Nẵng',
        'villa Đà Nẵng',
        'khách sạn Thanh Khê Đà Nẵng',
      ],
      FOOD: [
        'quán ăn Đà Nẵng',
        'hải sản Đà Nẵng',
        'ẩm thực Đà Nẵng',
        'quán ăn Hải Châu',
        'quán ăn Sơn Trà',
        'hải sản Sơn Trà',
        'quán ăn Ngũ Hành Sơn',
        'quán ăn Thanh Khê',
        'quán ăn Cẩm Lệ',
        'quán ăn Liên Chiểu',
        'gà rán Jollibee Đà Nẵng',
        'KFC Lotteria Đà Nẵng',
        'thức ăn nhanh gà rán pizza Đà Nẵng',
        'mì quảng Đà Nẵng',
        'bánh tráng cuốn thịt heo Đà Nẵng',
        'bún chả cá Đà Nẵng',
        'cơm gà Đà Nẵng',
        'quán lẩu nướng Đà Nẵng',
        'quán ăn vặt Đà Nẵng',
      ],
      CAFE: [
        'cafe Đà Nẵng',
        'cà phê Đà Nẵng',
        'Highlands Coffee Đà Nẵng',
        'Starbucks Đà Nẵng',
        'Phúc Long Coffee Tea Đà Nẵng',
        'The Coffee House Đà Nẵng',
        'trà sữa Đà Nẵng',
        'cafe Hải Châu',
        'cà phê Hải Châu',
        'trà sữa Hải Châu',
        'cafe Sơn Trà',
        'cà phê Sơn Trà',
        'trà sữa Sơn Trà',
        'cafe Ngũ Hành Sơn',
        'trà sữa Ngũ Hành Sơn',
        'cafe Thanh Khê',
        'trà sữa Thanh Khê',
        'cafe Cẩm Lệ',
        'cafe Liên Chiểu',
        'tiệm bánh ngọt Đà Nẵng',
      ],
      SIGHTSEEING: [
        'địa điểm du lịch Đà Nẵng',
        'điểm tham quan Đà Nẵng',
        'du lịch Đà Nẵng',
        'bãi biển Đà Nẵng',
        'bán đảo Sơn Trà',
        'danh thắng Ngũ Hành Sơn',
        'bảo tàng Đà Nẵng',
        'chùa Linh Ứng Đà Nẵng',
        'Cầu Rồng Đà Nẵng',
        'Bà Nà Hills',
      ],
      NIGHTLIFE: [
        'quán bar Đà Nẵng',
        'quán pub Đà Nẵng',
        'lounge Đà Nẵng',
        'sky bar Đà Nẵng',
        'vui chơi đêm Đà Nẵng',
        'chợ đêm Helio Đà Nẵng',
        'chợ đêm Sơn Trà Đà Nẵng',
        'quán bia Đà Nẵng',
      ],
      SHOPPING: [
        'chợ Cồn Đà Nẵng',
        'chợ Hàn Đà Nẵng',
        'đặc sản làm quà Đà Nẵng',
        'chợ Đà Nẵng',
        'siêu thị Vincom Đà Nẵng',
        'quà lưu niệm Đà Nẵng',
      ],
    },
  },

  HCMC: {
    key: 'HCMC',
    slug: 'ho-chi-minh',
    name: 'TP. Hồ Chí Minh',
    areaId: 3,
    areaName: 'Thành phố Hồ Chí Minh',
    city: 'Hồ Chí Minh',
    coords: '@10.7769,106.7009,13z',
    aliases: ['HCMC', 'HCM', 'SAIGON', 'HO-CHI-MINH', 'TPHCM'],
    districts: ['Quận 1', 'Quận 2', 'Quận 3', 'Quận 5', 'Quận 7', 'Thủ Đức', 'Bình Thạnh', 'Phú Nhuận', 'Gò Vấp', 'Tân Bình'],
    customQueries: {
      STAY: [
        'khách sạn Quận 1',
        'khách sạn Sài Gòn',
        'khách sạn Quận 3',
        'khách sạn Quận 7',
        'homestay Sài Gòn',
        'homestay Quận 1',
        'khách sạn Thủ Đức',
        'khách sạn view sông Sài Gòn',
        'resort Sài Gòn',
      ],
      FOOD: [
        'quán ăn Sài Gòn',
        'quán ăn Quận 1',
        'quán ăn Quận 3',
        'quán ăn Quận 5',
        'quán ăn Quận 7',
        'quán ăn Thủ Đức',
        'quán ăn Bình Thạnh',
        'gà rán Jollibee Sài Gòn',
        'KFC Lotteria McDonald Sài Gòn',
        'thức ăn nhanh gà rán pizza Sài Gòn',
        'cơm tấm Sài Gòn',
        'hủ tiếu Sài Gòn',
        'quán ốc Sài Gòn',
        'ẩm thực Chợ Lớn Quận 5',
        'quán lẩu nướng Sài Gòn',
        'quán ăn vặt Sài Gòn',
      ],
      CAFE: [
        'cafe Sài Gòn',
        'cà phê Sài Gòn',
        'Highlands Coffee Sài Gòn',
        'Starbucks Sài Gòn',
        'Phúc Long Sài Gòn',
        'The Coffee House Sài Gòn',
        'trà sữa Sài Gòn',
        'cafe Quận 1',
        'cà phê Quận 1',
        'trà sữa Quận 1',
        'cafe Quận 2',
        'trà sữa Quận 2',
        'cafe Quận 3',
        'trà sữa Quận 3',
        'cafe Quận 7',
        'trà sữa Quận 7',
        'cafe Thủ Đức',
        'cafe Bình Thạnh',
        'tiệm bánh ngọt Sài Gòn',
      ],
      SIGHTSEEING: [
        'địa điểm du lịch Sài Gòn',
        'tham quan Sài Gòn',
        'chợ Bến Thành',
        'nhà thờ Đức Bà Sài Gòn',
        'Dinh Độc Lập',
        'Bưu điện trung tâm Sài Gòn',
        'bến Bạch Đằng Sài Gòn',
        'địa đạo Củ Chi',
        'bảo tàng Chứng tích chiến tranh',
      ],
      NIGHTLIFE: [
        'bar Quận 1',
        'pub Sài Gòn',
        'lounge Sài Gòn',
        'rooftop bar Sài Gòn',
        'phố đi bộ Bùi Viện',
        'phố đi bộ Nguyễn Huệ',
        'vui chơi đêm Sài Gòn',
      ],
      SHOPPING: [
        'chợ Bến Thành Sài Gòn',
        'chợ An Đông Sài Gòn',
        'chợ Tân Định Sài Gòn',
        'chợ Lớn Sài Gòn',
        'Takashimaya Sài Gòn',
        'Vincom Đồng Khởi Sài Gòn',
        'đặc sản làm quà Sài Gòn',
      ],
    },
  },

  LAMDONG: {
    key: 'LAMDONG',
    slug: 'lam-dong',
    name: 'Lâm Đồng (Đà Lạt)',
    areaId: 27,
    areaName: 'Tỉnh Lâm Đồng',
    city: 'Lâm Đồng',
    coords: '@11.9404,108.4583,13z',
    aliases: ['LAMDONG', 'LAM-DONG', 'DALAT', 'DA-LAT'],
    districts: ['Đà Lạt', 'Bảo Lộc', 'Lạc Dương', 'Đức Trọng'],
    customQueries: {
      STAY: [
        'homestay Đà Lạt',
        'khách sạn Đà Lạt',
        'resort hồ Tuyền Lâm Đà Lạt',
        'villa Đà Lạt',
        'glamping Đà Lạt',
        'homestay view đồi Đà Lạt',
        'khách sạn gần chợ Đà Lạt',
        'khách sạn Bảo Lộc',
      ],
      FOOD: [
        'quán ăn Đà Lạt',
        'gà rán Jollibee Đà Lạt',
        'KFC Lotteria Đà Lạt',
        'thức ăn nhanh gà rán pizza Đà Lạt',
        'lẩu gà lá é Đà Lạt',
        'lẩu bò Ba Toa Đà Lạt',
        'bánh ướt lòng gà Đà Lạt',
        'bánh tráng nướng chợ Đà Lạt',
        'quán nướng BBQ Đà Lạt',
        'cơm lam gà nướng Đà Lạt',
        'kem bơ Đà Lạt',
        'quán ăn Bảo Lộc',
      ],
      CAFE: [
        'cafe Đà Lạt',
        'cà phê Đà Lạt',
        'Highlands Coffee Đà Lạt',
        'The Coffee House Đà Lạt',
        'trà sữa Phúc Long Gong Cha Đà Lạt',
        'trà sữa Đà Lạt',
        'cafe săn mây Đà Lạt',
        'cafe view đồi Đà Lạt',
        'cafe hồ Xuân Hương Đà Lạt',
        'cafe acoustic Đà Lạt',
        'cafe đồi chè Cầu Đất',
        'tiệm bánh kem Đà Lạt',
        'cafe Bảo Lộc',
      ],
      SIGHTSEEING: [
        'địa điểm du lịch Đà Lạt',
        'tham quan Đà Lạt',
        'thác Datanla Đà Lạt',
        'hồ Tuyền Lâm Đà Lạt',
        'đỉnh Langbiang Đà Lạt',
        'quảng trường Lâm Viên Đà Lạt',
        'vườn hoa cẩm tú cầu Đà Lạt',
        'ga Đà Lạt',
        'chùa Linh Phước Đà Lạt',
        'thác Pongour Lâm Đồng',
      ],
      NIGHTLIFE: [
        'chợ đêm Đà Lạt',
        'quán pub acoustic Đà Lạt',
        'quán bar chill Đà Lạt',
        'vui chơi đêm Đà Lạt',
      ],
      SHOPPING: [
        'đặc sản Đà Lạt',
        'mứt dâu Đà Lạt',
        'L’angfarm Đà Lạt',
        'vườn dâu tươi Đà Lạt',
        'chợ Đà Lạt',
      ],
    },
  },

  ANGIANG: {
    key: 'ANGIANG',
    slug: 'an-giang',
    name: 'An Giang',
    areaId: 31,
    areaName: 'Tỉnh An Giang',
    city: 'An Giang',
    coords: '@10.5186,105.1259,12z',
    aliases: ['ANGIANG', 'AN-GIANG', 'CHAUDOC', 'CHAU-DOC', 'LONGXUYEN'],
    districts: ['Châu Đốc', 'Long Xuyên', 'Tri Tôn', 'Tịnh Biên', 'Thoại Sơn'],
    customQueries: {
      STAY: [
        'khách sạn Châu Đốc',
        'khách sạn Long Xuyên',
        'khách sạn An Giang',
        'Victoria Châu Đốc núi Sam',
        'homestay An Giang',
        'khách sạn gần Miếu Bà Châu Đốc',
        'nhà nghỉ Tri Tôn An Giang',
      ],
      FOOD: [
        'quán ăn Châu Đốc',
        'quán ăn Long Xuyên',
        'quán ăn An Giang',
        'gà rán Jollibee Long Xuyên Châu Đốc',
        'KFC Lotteria An Giang',
        'thức ăn nhanh gà rán pizza An Giang',
        'bún cá Châu Đốc',
        'lẩu mắm Châu Đốc',
        'bò 7 món núi Sam Châu Đốc',
        'gà đốt Ô Thum Tri Tôn',
        'bánh xèo Núi Cấm An Giang',
        'cơm tấm Long Xuyên',
        'đặc sản An Giang',
      ],
      CAFE: [
        'cafe Châu Đốc',
        'cà phê Châu Đốc',
        'Highlands Coffee Long Xuyên Châu Đốc',
        'trà sữa Phúc Long King Koi An Giang',
        'trà sữa Châu Đốc',
        'cafe Long Xuyên',
        'cà phê Long Xuyên',
        'trà sữa Long Xuyên',
        'cafe Tri Tôn',
        'cafe view cánh đồng thốt nốt',
        'tiệm trà bánh An Giang',
      ],
      SIGHTSEEING: [
        'du lịch An Giang',
        'miếu Bà Chúa Xứ Châu Đốc',
        'rừng tràm Trà Sư An Giang',
        'núi Cấm An Giang',
        'hồ Tà Pạ Tri Tôn',
        'chùa Hang Châu Đốc',
        'chợ nổi Long Xuyên',
        'làng Chăm Châu Phong An Giang',
      ],
      NIGHTLIFE: [
        'chợ đêm Châu Đốc',
        'chợ đêm Long Xuyên',
        'phố đi bộ Long Xuyên',
        'cafe bờ kè sông Hậu An Giang',
      ],
      SHOPPING: [
        'chợ Châu Đốc mắm cá',
        'đường thốt nốt Tri Tôn An Giang',
        'chợ Tịnh Biên An Giang',
        'đặc sản làm quà An Giang',
        'chợ Long Xuyên',
      ],
    },
  },
};

// Hàm lấy cấu hình tỉnh/thành theo từ khóa nhập vào
function getProvinceConfig(keyOrAlias = 'DANANG') {
  const upper = (keyOrAlias || 'DANANG').toUpperCase().trim();
  for (const prov of Object.values(PROVINCES)) {
    if (prov.key === upper || prov.aliases.includes(upper)) {
      return prov;
    }
  }
  return PROVINCES.DANANG; // Mặc định Đà Nẵng
}

// Hàm sinh cấu hình 6 chủ đề theo tỉnh thành
function getTopicsForProvince(provinceConfig = PROVINCES.DANANG) {
  const q = provinceConfig.customQueries;
  return {
    STAY: {
      key: 'STAY',
      name: '🏨 Lưu trú & Nghỉ dưỡng',
      targetRatio: 0.175, // ~17.5%
      queries: q.STAY,
    },
    FOOD: {
      key: 'FOOD',
      name: '🍔 Ẩm thực & Quán ăn',
      targetRatio: 0.275, // ~27.5%
      queries: q.FOOD,
    },
    CAFE: {
      key: 'CAFE',
      name: '☕ Cà phê & Tráng miệng',
      targetRatio: 0.225, // ~22.5%
      queries: q.CAFE,
    },
    SIGHTSEEING: {
      key: 'SIGHTSEEING',
      name: '🏛️ Tham quan & Di tích',
      targetRatio: 0.15, // ~15.0%
      queries: q.SIGHTSEEING,
    },
    NIGHTLIFE: {
      key: 'NIGHTLIFE',
      name: '🎉 Vui chơi & Về đêm',
      targetRatio: 0.10, // ~10.0%
      queries: q.NIGHTLIFE,
    },
    SHOPPING: {
      key: 'SHOPPING',
      name: '🛍️ Chợ & Mua sắm',
      targetRatio: 0.075, // ~7.5%
      queries: q.SHOPPING,
    },
  };
}

// Hàm tự động sinh các câu truy vấn DIỆN RỘNG (Broad Queries) theo từng quận khi thiếu số lượng
// Giúp tìm ra hàng trăm quán phổ thông (cafe quận 1, trà sữa quận 2, quán ăn quận 3...)
function generateBroadQueries(topicKey, provinceConfig) {
  const city = provinceConfig.city;
  const districts = provinceConfig.districts || [];
  const list = [];

  switch (topicKey) {
    case 'FOOD':
      for (const d of districts) {
        list.push(`quán ăn ${d} ${city}`);
        list.push(`ẩm thực ${d} ${city}`);
      }
      list.push(`quán ăn ${city}`, `đặc sản ngon ${city}`, `gà rán Jollibee ${city}`, `thức ăn nhanh KFC ${city}`);
      break;

    case 'CAFE':
      for (const d of districts) {
        list.push(`cafe ${d} ${city}`);
        list.push(`cà phê ${d} ${city}`);
        list.push(`trà sữa ${d} ${city}`);
      }
      list.push(`cafe ${city}`, `trà sữa ${city}`, `Highlands Coffee ${city}`, `Starbucks ${city}`, `Phúc Long ${city}`);
      break;

    case 'STAY':
      for (const d of districts) {
        list.push(`khách sạn ${d} ${city}`);
        list.push(`homestay ${d} ${city}`);
      }
      list.push(`khách sạn ${city}`, `resort ${city}`, `homestay ${city}`);
      break;

    case 'SIGHTSEEING':
      for (const d of districts) {
        list.push(`điểm tham quan ${d} ${city}`);
        list.push(`du lịch ${d} ${city}`);
      }
      list.push(`du lịch ${city}`, `danh lam thắng cảnh ${city}`);
      break;

    case 'NIGHTLIFE':
      for (const d of districts) {
        list.push(`bar pub ${d} ${city}`);
        list.push(`vui chơi ${d} ${city}`);
      }
      list.push(`bar pub ${city}`, `vui chơi đêm ${city}`);
      break;

    case 'SHOPPING':
      for (const d of districts) {
        list.push(`chợ ${d} ${city}`);
        list.push(`siêu thị ${d} ${city}`);
      }
      list.push(`chợ ${city}`, `mua sắm đặc sản ${city}`);
      break;
  }

  return list;
}

// Tương thích ngược với các file cũ gọi DANANG_CONFIG & TOPICS
const DANANG_CONFIG = PROVINCES.DANANG;
const TOPICS = getTopicsForProvince(PROVINCES.DANANG);

module.exports = {
  getBravePath,
  PROVINCES,
  getProvinceConfig,
  getTopicsForProvince,
  generateBroadQueries,
  DANANG_CONFIG,
  TOPICS,
};
