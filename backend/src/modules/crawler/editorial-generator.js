/**
 * Module sinh nội dung điểm nổi bật, mẹo du lịch, đối tượng phù hợp
 * Khớp chuẩn 100% với giao diện PlaceDetailPage (frontend/src/app/places/[slug]/page.tsx)
 * Đường dẫn: backend/src/modules/crawler/editorial-generator.js
 */

function generateEditorialContent(placeName, categorySlug, ratingAvg) {
  const star = ratingAvg && ratingAvg > 0 ? ratingAvg.toFixed(1) : '4.5';

  if (categorySlug === 'nha-hang' || categorySlug === 'an-vat-via-he') {
    return {
      tagline: `Điểm hẹn ẩm thực nổi tiếng tại Đà Nẵng với ${star}⭐ đánh giá`,
      whyGo: [
        'Hương vị đậm đà, chế biến từ nguyên liệu tươi sống chọn lọc trong ngày.',
        'Không gian rộng rãi, thoáng mát, nhân viên phục vụ nhanh nhẹn và chu đáo.',
        `Nhận được sự tin tưởng của đông đảo du khách và người dân địa phương với ${star} sao trên Google Maps.`,
      ],
      tips: [
        'Nên ghé sớm trước 19h hoặc đặt bàn trước vào các ngày cuối tuần để có chỗ ngồi đẹp.',
        'Hỏi nhân viên về các món đặc sản bán chạy nhất trong ngày (best-seller).',
        'Có khu vực đỗ xe máy và hỗ trợ thanh toán qua chuyển khoản QR tiện lợi.',
      ],
      suggestedDuration: '1.5 - 2 giờ',
      suitableFor: ['friends', 'family', 'foodie'],
      styles: ['foodie', 'checkin'],
    };
  }

  if (categorySlug === 'ca-phe' || categorySlug === 'bar-pub') {
    return {
      tagline: `Không gian thưởng thức đồ uống và check-in thư giãn cực chill`,
      whyGo: [
        'Góc nhìn (view) thoáng đãng, ngắm trọn vẻ đẹp phố biển Đà Nẵng từ trên cao hoặc ven sông.',
        'Menu đồ uống phong phú từ cà phê pha máy, trà hoa quả tươi đến bánh ngọt tráng miệng.',
        'Ánh sáng tự nhiên và thiết kế nội thất hiện đại, lý tưởng cho những bức ảnh check-in sống ảo.',
      ],
      tips: [
        'Khoảng thời gian hoàng hôn (16h30 - 18h00) hoặc buổi tối là lúc quán có góc view đẹp nhất.',
        'Nên gọi các món trà trái cây signature hoặc cà phê muối đặc trưng.',
      ],
      suggestedDuration: '1 - 2 giờ',
      suitableFor: ['couple', 'friends', 'solo'],
      styles: ['chill', 'checkin'],
    };
  }

  if (categorySlug === 'diem-tham-quan' || categorySlug === 'di-tich-lich-su' || categorySlug === 'thien-nhien') {
    return {
      tagline: `Điểm tham quan tiêu biểu không thể bỏ lỡ khi ghé thăm Đà Nẵng`,
      whyGo: [
        'Khung cảnh thiên nhiên kỳ vĩ cùng giá trị văn hóa - lịch sử đặc sắc của thành phố đáng sống.',
        'Điểm check-in biểu tượng được hàng triệu lượt du khách trong và ngoài nước ghé thăm.',
        'Không gian trong lành, thoáng đãng, thích hợp để ngắm cảnh và lưu giữ những bức hình kỷ niệm.',
      ],
      tips: [
        'Nên mang theo nón, kính râm, kem chống nắng và nước suối cá nhân khi tham quan.',
        'Thời điểm tham quan đẹp nhất là sáng sớm (7h - 9h) hoặc chiều tà (15h30 - 17h30) để tránh nắng gắt.',
        'Tuân thủ nội quy giữ gìn vệ sinh chung và không xả rác bừa bãi tại điểm tham quan.',
      ],
      suggestedDuration: '2 - 3 giờ',
      suitableFor: ['family', 'friends', 'solo'],
      styles: ['nature', 'checkin', 'adventure'],
    };
  }

  // Khách sạn & Mua sắm
  return {
    tagline: `Trải nghiệm dịch vụ chất lượng và mua sắm đặc sản chuẩn vị`,
    whyGo: [
      'Vị trí thuận lợi, kết nối nhanh chóng đến các bãi biển đẹp và trung tâm ẩm thực Đà Nẵng.',
      'Dịch vụ chuyên nghiệp, tiện nghi đầy đủ đáp ứng nhu cầu nghỉ dưỡng và mua sắm của du khách.',
      `Được đánh giá cao với số điểm ấn tượng ${star} sao trên Google Maps.`,
    ],
    tips: [
      'Liên hệ trước để kiểm tra tình trạng phòng hoặc hỏi về các chính sách ưu đãi.',
      'Khi mua sắm đặc sản, hãy chú ý hạn sử dụng và quy cách đóng gói để tiện mang lên máy bay.',
    ],
    suggestedDuration: '1.5 - 2.5 giờ',
    suitableFor: ['family', 'couple', 'friends'],
    styles: ['luxury', 'chill', 'foodie'],
  };
}

module.exports = {
  generateEditorialContent,
};
