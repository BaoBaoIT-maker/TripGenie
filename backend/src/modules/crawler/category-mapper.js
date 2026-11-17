/**
 * Module phân loại danh mục & ước tính khoảng giá
 * Đường dẫn: backend/src/modules/crawler/category-mapper.js
 */

function normalizeSlug(str) {
  if (!str) return 'dia-diem';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapCategory(googleCategory, topicKey, placeName = '') {
  const cat = (googleCategory || '').toLowerCase();
  const name = placeName.toLowerCase();

  // 1. Thắng cảnh & Du lịch & Biển
  if (name.includes('bãi biển') || name.includes('bãi đá') || cat.includes('bãi biển') || cat.includes('beach')) {
    return { categoryId: 3, categorySlug: 'thien-nhien', categoryName: 'Thiên nhiên & Biển', frontendCat: 'nature' };
  }
  if (name.includes('chùa') || name.includes('đền') || name.includes('bảo tàng') || cat.includes('di tích') || cat.includes('lịch sử') || cat.includes('bảo tàng')) {
    return { categoryId: 2, categorySlug: 'di-tich-lich-su', categoryName: 'Di tích lịch sử', frontendCat: 'culture' };
  }
  if (cat.includes('thu hút') || cat.includes('du lịch') || cat.includes('cảnh quan') || cat.includes('cầu') || name.includes('cầu rồng') || name.includes('ngũ hành sơn') || name.includes('công viên')) {
    return { categoryId: 1, categorySlug: 'diem-tham-quan', categoryName: 'Điểm tham quan', frontendCat: 'sightseeing' };
  }
  if (cat.includes('vui chơi') || cat.includes('giải trí') || cat.includes('water park') || cat.includes('theme park')) {
    return { categoryId: 7, categorySlug: 'vui-choi', categoryName: 'Vui chơi giải trí', frontendCat: 'entertainment' };
  }

  // 2. Cà phê & Bar
  if (cat.includes('cà phê') || cat.includes('cafe') || cat.includes('coffee') || cat.includes('trà') || cat.includes('tiệm bánh') || cat.includes('tráng miệng') || name.includes('cafe') || name.includes('coffee')) {
    return { categoryId: 5, categorySlug: 'ca-phe', categoryName: 'Cà phê & Tráng miệng', frontendCat: 'cafe' };
  }
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('club') || cat.includes('lounge')) {
    return { categoryId: 11, categorySlug: 'bar-pub', categoryName: 'Bar & Cuộc sống đêm', frontendCat: 'nightlife' };
  }

  // 3. Ẩm thực & Ăn uống
  if (cat.includes('bánh mì') || cat.includes('ăn vặt') || cat.includes('vỉa hè') || cat.includes('chè') || name.includes('ăn vặt') || name.includes('bánh mì')) {
    return { categoryId: 6, categorySlug: 'an-vat-via-he', categoryName: 'Ẩm thực đường phố', frontendCat: 'restaurant' };
  }
  if (name.includes('chợ') || name.includes('siêu thị') || name.includes('đặc sản làm quà') || cat.includes('chợ') || cat.includes('siêu thị') || cat.includes('market')) {
    return { categoryId: 8, categorySlug: 'cho-sieu-thi', categoryName: 'Chợ & Mua sắm', frontendCat: 'culture' };
  }
  if (cat.includes('nhà hàng') || cat.includes('quán ăn') || cat.includes('hải sản') || cat.includes('bbq') || cat.includes('lẩu') || cat.includes('mì quảng') || cat.includes('cơm') || name.includes('hải sản') || name.includes('mỳ quảng')) {
    return { categoryId: 4, categorySlug: 'nha-hang', categoryName: 'Nhà hàng ẩm thực', frontendCat: 'restaurant' };
  }

  // 4. Lưu trú
  if (cat.includes('khách sạn') || cat.includes('resort') || cat.includes('hotel') || name.includes('resort') || name.includes('hotel')) {
    return { categoryId: 9, categorySlug: 'khach-san', categoryName: 'Khách sạn & Resort', frontendCat: 'relaxation' };
  }
  if (cat.includes('homestay') || cat.includes('nhà nghỉ') || cat.includes('villa')) {
    return { categoryId: 10, categorySlug: 'homestay', categoryName: 'Homestay nghỉ dưỡng', frontendCat: 'relaxation' };
  }

  // Fallback theo topic (6 Chủ đề đồng bộ 100% với giao diện)
  if (topicKey === 'STAY') return { categoryId: 9, categorySlug: 'khach-san', categoryName: 'Khách sạn & Resort', frontendCat: 'relaxation' };
  if (topicKey === 'FOOD') return { categoryId: 4, categorySlug: 'nha-hang', categoryName: 'Nhà hàng ẩm thực', frontendCat: 'restaurant' };
  if (topicKey === 'CAFE') return { categoryId: 5, categorySlug: 'ca-phe', categoryName: 'Cà phê & Tráng miệng', frontendCat: 'cafe' };
  if (topicKey === 'SIGHTSEEING' || topicKey === 'TOURISM') return { categoryId: 1, categorySlug: 'diem-tham-quan', categoryName: 'Điểm tham quan', frontendCat: 'sightseeing' };
  if (topicKey === 'NIGHTLIFE') return { categoryId: 11, categorySlug: 'bar-pub', categoryName: 'Bar & Cuộc sống đêm', frontendCat: 'nightlife' };
  if (topicKey === 'SHOPPING') return { categoryId: 8, categorySlug: 'cho-sieu-thi', categoryName: 'Chợ & Mua sắm', frontendCat: 'culture' };
  if (topicKey === 'HOTEL_SHOPPING') return { categoryId: 9, categorySlug: 'khach-san', categoryName: 'Khách sạn & Resort', frontendCat: 'relaxation' };

  return { categoryId: 4, categorySlug: 'nha-hang', categoryName: 'Nhà hàng ẩm thực', frontendCat: 'restaurant' };
}

function getPriceInfo(categorySlug, rawPriceText) {
  if (rawPriceText && rawPriceText.includes('₫')) {
    return { priceLevel: 2, priceRangeText: rawPriceText };
  }

  switch (categorySlug) {
    case 'an-vat-via-he':
      return { priceLevel: 1, priceRangeText: '25.000đ - 55.000đ' };
    case 'ca-phe':
      return { priceLevel: 1, priceRangeText: '30.000đ - 65.000đ' };
    case 'bar-pub':
      return { priceLevel: 2, priceRangeText: '80.000đ - 250.000đ' };
    case 'nha-hang':
      return { priceLevel: 2, priceRangeText: '120.000đ - 350.000đ' };
    case 'diem-tham-quan':
    case 'di-tich-lich-su':
    case 'thien-nhien':
      return { priceLevel: 1, priceRangeText: 'Miễn phí hoặc 30.000đ - 100.000đ vé vào cổng' };
    case 'khach-san':
      return { priceLevel: 3, priceRangeText: '850.000đ - 2.800.000đ / đêm' };
    case 'homestay':
      return { priceLevel: 2, priceRangeText: '350.000đ - 850.000đ / đêm' };
    case 'cho-sieu-thi':
      return { priceLevel: 2, priceRangeText: 'Tùy món quà & đặc sản chọn mua' };
    default:
      return { priceLevel: 2, priceRangeText: '50.000đ - 200.000đ' };
  }
}

module.exports = {
  normalizeSlug,
  mapCategory,
  getPriceInfo,
};
