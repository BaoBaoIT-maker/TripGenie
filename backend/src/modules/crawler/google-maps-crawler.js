/**
 * File khởi chạy chính cho Trình cào dữ liệu Google Maps ĐA TỈNH THÀNH (Entry Point)
 * Hỗ trợ: Đà Nẵng, TP.HCM, Lâm Đồng (Đà Lạt), An Giang
 *
 * Cách chạy:
 *   node backend/src/modules/crawler/google-maps-crawler.js                       (Mặc định Đà Nẵng 200 địa điểm)
 *   node backend/src/modules/crawler/google-maps-crawler.js 1000                  (Đà Nẵng 1.000 địa điểm)
 *   node backend/src/modules/crawler/google-maps-crawler.js hcm 1000              (TP.HCM 1.000 địa điểm)
 *   node backend/src/modules/crawler/google-maps-crawler.js lamdong 1000          (Lâm Đồng - Đà Lạt 1.000 địa điểm)
 *   node backend/src/modules/crawler/google-maps-crawler.js angiang 500           (An Giang 500 địa điểm)
 *   node backend/src/modules/crawler/google-maps-crawler.js hcm food 200          (Chỉ cào Ẩm thực TP.HCM)
 *   node backend/src/modules/crawler/google-maps-crawler.js lamdong cafe 200      (Chỉ cào Cafe Đà Lạt/Lâm Đồng)
 *   node backend/src/modules/crawler/google-maps-crawler.js --headless 1000       (Chạy ngầm không mở cửa sổ)
 *   node backend/src/modules/crawler/google-maps-crawler.js --append hcm 500      (Gộp thêm vào danh sách cũ)
 */

const { startCrawler } = require('./crawler');

// Đọc tham số dòng lệnh linh hoạt (hỗ trợ cả flag --total, --province lẫn tham số vị trí)
const args = process.argv.slice(2);
const isHeadless = args.includes('--headless');
const isAppendMode = args.includes('--append');

let targetTotal = 200;
let topicFilter = 'ALL';
let provinceFilter = 'DANANG';
let customQuery = null;

const validTopics = ['STAY', 'HOTEL', 'FOOD', 'CAFE', 'SIGHTSEEING', 'TOURISM', 'NIGHTLIFE', 'SHOPPING'];
const validProvinces = {
  DANANG: 'DANANG',
  DN: 'DANANG',
  'DA-NANG': 'DANANG',
  HCM: 'HCMC',
  HCMC: 'HCMC',
  SAIGON: 'HCMC',
  'HO-CHI-MINH': 'HCMC',
  TPHCM: 'HCMC',
  LAMDONG: 'LAMDONG',
  'LAM-DONG': 'LAMDONG',
  DALAT: 'LAMDONG',
  'DA-LAT': 'LAMDONG',
  ANGIANG: 'ANGIANG',
  'AN-GIANG': 'ANGIANG',
  CHAUDOC: 'ANGIANG',
  'CHAU-DOC': 'ANGIANG',
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = args[i + 1] || '';

  if (a === '--query' || a === '-q') {
    customQuery = next;
    i++;
  } else if (a.startsWith('--query=')) {
    customQuery = a.substring('--query='.length);
  } else if (a === '--total' || a === '-n') {
    if (/^\d+$/.test(next)) {
      targetTotal = parseInt(next, 10);
      i++;
    }
  } else if (a.startsWith('--total=')) {
    const val = a.split('=')[1];
    if (/^\d+$/.test(val)) targetTotal = parseInt(val, 10);
  } else if (a === '--province' || a === '-p') {
    const up = next.toUpperCase();
    if (validProvinces[up]) {
      provinceFilter = validProvinces[up];
      i++;
    }
  } else if (a.startsWith('--province=')) {
    const up = a.split('=')[1].toUpperCase();
    if (validProvinces[up]) provinceFilter = validProvinces[up];
  } else if (a === '--topic' || a === '-t') {
    const up = next.toUpperCase();
    if (validTopics.includes(up)) {
      topicFilter = up;
      i++;
    }
  } else if (a.startsWith('--topic=')) {
    const up = a.split('=')[1].toUpperCase();
    if (validTopics.includes(up)) topicFilter = up;
  } else if (!a.startsWith('--')) {
    const upper = a.toUpperCase();
    if (/^\d+$/.test(a)) {
      targetTotal = parseInt(a, 10);
    } else if (validProvinces[upper]) {
      provinceFilter = validProvinces[upper];
    } else if (validTopics.includes(upper)) {
      topicFilter = upper;
    }
  }
}

// Chạy crawler với các tùy chọn
startCrawler({
  province: provinceFilter,
  targetTotal,
  headless: isHeadless,
  append: isAppendMode,
  topic: topicFilter,
  query: customQuery,
});
