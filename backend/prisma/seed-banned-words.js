require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const INITIAL_BANNED_WORDS = [
  // --- PROFANITY (Thô tục, chửi bậy, xúc phạm) ---
  { word: 'đm', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'đkm', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'đcm', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'vcl', category: 'PROFANITY', notes: 'Từ thô tục viết tắt' },
  { word: 'vkl', category: 'PROFANITY', notes: 'Từ thô tục viết tắt' },
  { word: 'đéo', category: 'PROFANITY', notes: 'Từ thô tục' },
  { word: 'đĩ', category: 'PROFANITY', notes: 'Từ thô tục xúc phạm' },
  { word: 'lồn', category: 'PROFANITY', notes: 'Từ tục tĩu bộ phận sinh dục' },
  { word: 'cặc', category: 'PROFANITY', notes: 'Từ tục tĩu bộ phận sinh dục' },
  { word: 'buồi', category: 'PROFANITY', notes: 'Từ tục tĩu bộ phận sinh dục' },
  { word: 'chó đẻ', category: 'PROFANITY', notes: 'Từ chửi bậy xúc phạm' },
  { word: 'óc chó', category: 'PROFANITY', notes: 'Từ xúc phạm trí tuệ' },
  { word: 'mẹ mày', category: 'PROFANITY', notes: 'Từ xúc phạm gia đình' },
  { word: 'bố mày', category: 'PROFANITY', notes: 'Từ xưng hô xúc phạm' },
  { word: 'thằng chó', category: 'PROFANITY', notes: 'Từ xúc phạm' },
  { word: 'con đĩ', category: 'PROFANITY', notes: 'Từ xúc phạm' },
  { word: 'mặt lồn', category: 'PROFANITY', notes: 'Từ thô tục lăng mạ' },
  { word: 'đĩ mẹ', category: 'PROFANITY', notes: 'Từ chửi thề' },
  { word: 'đậu má', category: 'PROFANITY', notes: 'Từ chửi thề nói trại' },
  { word: 'clgt', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'dcm', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'dkm', category: 'PROFANITY', notes: 'Từ chửi thề viết tắt' },
  { word: 'fuck', category: 'PROFANITY', notes: 'Chửi thề tiếng Anh' },
  { word: 'motherfucker', category: 'PROFANITY', notes: 'Chửi thề tiếng Anh' },
  { word: 'bitch', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },
  { word: 'asshole', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },
  { word: 'cunt', category: 'PROFANITY', notes: 'Tục tĩu tiếng Anh' },
  { word: 'whore', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },
  { word: 'slut', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },
  { word: 'dickhead', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },
  { word: 'bastard', category: 'PROFANITY', notes: 'Xúc phạm tiếng Anh' },

  // --- ADULT (Khiêu dâm, đồi trụy, 18+) ---
  { word: 'nắc', category: 'ADULT', notes: 'Từ lóng quan hệ thô tục' },
  { word: 'đụ', category: 'ADULT', notes: 'Từ thô tục quan hệ tình dục' },
  { word: 'đụ má', category: 'ADULT', notes: 'Chửi thề thô tục' },
  { word: 'chịch', category: 'ADULT', notes: 'Từ lóng quan hệ tình dục' },
  { word: 'xoạc', category: 'ADULT', notes: 'Từ lóng quan hệ tình dục' },
  { word: 'dâm đãng', category: 'ADULT', notes: 'Nội dung khiêu dâm' },
  { word: 'thủ dâm', category: 'ADULT', notes: 'Hành vi tình dục' },
  { word: 'quay tay', category: 'ADULT', notes: 'Từ lóng tình dục' },
  { word: 'gái gọi', category: 'ADULT', notes: 'Mại dâm' },
  { word: 'bán dâm', category: 'ADULT', notes: 'Mại dâm' },
  { word: 'mua dâm', category: 'ADULT', notes: 'Mại dâm' },
  { word: 'phim sex', category: 'ADULT', notes: 'Nội dung khiêu dâm' },
  { word: 'phim khiêu dâm', category: 'ADULT', notes: 'Nội dung khiêu dâm' },
  { word: 'chat sex', category: 'ADULT', notes: 'Gạ gẫm tình dục' },
  { word: 'gạ tình', category: 'ADULT', notes: 'Gạ gẫm tình dục' },
  { word: 'sextoy', category: 'ADULT', notes: 'Dụng cụ tình dục' },
  { word: 'lầu xanh', category: 'ADULT', notes: 'Mại dâm' },
  { word: 'sugar baby', category: 'ADULT', notes: 'Mại dâm biến tướng' },
  { word: 'sugar daddy', category: 'ADULT', notes: 'Mại dâm biến tướng' },
  { word: 'onlyfans', category: 'ADULT', notes: 'Nền tảng nội dung người lớn' },
  { word: 'pornhub', category: 'ADULT', notes: 'Trang web khiêu dâm' },
  { word: 'xvideos', category: 'ADULT', notes: 'Trang web khiêu dâm' },
  { word: 'jav', category: 'ADULT', notes: 'Phim người lớn' },
  { word: 'hentai', category: 'ADULT', notes: 'Hoạt hình khiêu dâm' },
  { word: 'sextape', category: 'ADULT', notes: 'Clip nhạy cảm' },
  { word: 'lộ clip', category: 'ADULT', notes: 'Phát tán clip nhạy cảm' },

  // --- GAMBLING (Cờ bạc, cá độ, tài xỉu, lô đề) ---
  { word: 'nhà cái', category: 'GAMBLING', notes: 'Cờ bạc trực tuyến' },
  { word: 'cá độ', category: 'GAMBLING', notes: 'Cá cược bóng đá/thể thao' },
  { word: 'tài xỉu', category: 'GAMBLING', notes: 'Game cờ bạc tài xỉu' },
  { word: 'nổ hũ', category: 'GAMBLING', notes: 'Game bài slot đổi thưởng' },
  { word: 'xóc đĩa', category: 'GAMBLING', notes: 'Cờ bạc xóc đĩa' },
  { word: 'lô đề', category: 'GAMBLING', notes: 'Cờ bạc lô đề' },
  { word: 'soi cầu', category: 'GAMBLING', notes: 'Cờ bạc lô đề' },
  { word: 'kubet', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'bet88', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'fun88', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'w88', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'fb88', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'thabet', category: 'GAMBLING', notes: 'Trang cờ bạc' },
  { word: 'baccarat', category: 'GAMBLING', notes: 'Đánh bài cờ bạc trực tuyến' },
  { word: 'đánh bài ăn tiền', category: 'GAMBLING', notes: 'Cờ bạc vi phạm pháp luật' },

  // --- SCAM (Lừa đảo, cọc tiền bẩn, vé ảo) ---
  { word: 'lừa đảo', category: 'SCAM', notes: 'Hành vi chiếm đoạt' },
  { word: 'chuyển khoản cọc', category: 'SCAM', notes: 'Dấu hiệu lừa cọc vé du lịch' },
  { word: 'cọc trước 100%', category: 'SCAM', notes: 'Lừa tiền cọc' },
  { word: 'nhận cọc giữ chỗ', category: 'SCAM', notes: 'Lừa đảo đặt phòng/vé' },
  { word: 'bán vé giả', category: 'SCAM', notes: 'Vé du lịch/sự kiện giả' },
  { word: 'bắn tiền ngay', category: 'SCAM', notes: 'Hối thúc chuyển khoản' },
  { word: 'inbox nhận giải', category: 'SCAM', notes: 'Lừa đảo trúng thưởng' },
  { word: 'việc nhẹ lương cao', category: 'SCAM', notes: 'Lừa đảo việc làm du lịch' },

  // --- OTHER (Chất cấm, ma túy, vũ khí) ---
  { word: 'ma túy', category: 'OTHER', notes: 'Chất cấm' },
  { word: 'thuốc lắc', category: 'OTHER', notes: 'Chất cấm' },
  { word: 'cần sa', category: 'OTHER', notes: 'Chất kích thích' },
  { word: 'hàng đá', category: 'OTHER', notes: 'Chất cấm' },
  { word: 'thuốc kích dục', category: 'OTHER', notes: 'Chất cấm' },
  { word: 'bán súng', category: 'OTHER', notes: 'Vũ khí trái phép' },
];

// Tier 2 (REVIEW): Context-sensitive keywords routed to async Gemini AI / Admin review
const INITIAL_REVIEW_WORDS = [
  // --- SCAM (Cảnh báo chặt chém vs kéo khách/cọc ngoài hệ thống) ---
  { word: 'chặt chém', category: 'SCAM', notes: 'Cần AI phân biệt review cảnh báo vs tố cáo vô căn cứ' },
  { word: 'bóc phốt', category: 'SCAM', notes: 'Bài phản ánh/tranh cãi cần AI đọc ngữ cảnh' },
  { word: 'phốt', category: 'SCAM', notes: 'Bài phản ánh/tranh cãi cần AI đọc ngữ cảnh' },
  { word: 'scam', category: 'SCAM', notes: 'Từ khóa nghi ngờ lừa đảo (EN)' },
  { word: 'rip-off', category: 'SCAM', notes: 'Từ khóa phản ánh chặt chém (EN)' },
  { word: 'fraud', category: 'SCAM', notes: 'Từ khóa nghi ngờ gian lận (EN)' },
  { word: 'tẩy chay', category: 'SCAM', notes: 'Kêu gọi tẩy chay cần AI xác minh ngữ cảnh' },
  { word: 'chuyển khoản', category: 'SCAM', notes: 'Giao dịch chuyển khoản ngoài hệ thống' },
  { word: 'đặt cọc', category: 'SCAM', notes: 'Cần AI phân biệt chia sẻ kinh nghiệm vs dụ cọc' },
  { word: 'cọc trước', category: 'SCAM', notes: 'Dấu hiệu dụ đặt cọc cần AI rà soát' },
  { word: 'zalo', category: 'SCAM', notes: 'Dẫn sang Zalo cá nhân (kiểm tra spam/lôi kéo)' },
  { word: 'telegram', category: 'SCAM', notes: 'Dẫn sang Telegram (kiểm tra spam/lừa đảo)' },
  { word: 'inbox', category: 'SCAM', notes: 'Kêu gọi inbox kín cần AI kiểm tra mục đích' },
  { word: 'ib ngay', category: 'SCAM', notes: 'Hối thúc nhắn tin riêng cần AI kiểm tra' },
  { word: 'vé giá rẻ', category: 'SCAM', notes: 'Cần AI phân biệt săn deal vs bán vé ảo' },
  { word: 'xả vé', category: 'SCAM', notes: 'Thanh lý vé cần AI kiểm tra rủi ro' },
  { word: 'deposit', category: 'SCAM', notes: 'Đặt cọc (EN)' },
  { word: 'wire transfer', category: 'SCAM', notes: 'Chuyển khoản (EN)' },

  // --- GAMBLING (Ngữ cảnh cảnh báo vs lôi kéo cờ bạc) ---
  { word: 'đánh bạc', category: 'GAMBLING', notes: 'AI phân biệt bài cảnh báo du lịch vs rủ rê cờ bạc' },
  { word: 'cờ bạc', category: 'GAMBLING', notes: 'AI phân biệt cảnh báo địa điểm vs quảng cáo cờ bạc' },

  // --- PROFANITY (Nhạy cảm theo ngữ cảnh) ---
  { word: 'cc', category: 'PROFANITY', notes: 'AI phân biệt xúc phạm vs viết tắt dung tích xe (cc)' },
  { word: 'ngu', category: 'PROFANITY', notes: 'Ngôn từ công kích nhẹ cần xét ngữ cảnh' },
  { word: 'điên', category: 'PROFANITY', notes: 'AI phân biệt cảm thán ("đẹp phát điên") vs công kích' },
  { word: 'rác rưởi', category: 'PROFANITY', notes: 'Xúc phạm/miệt thị cần AI xem ngữ cảnh' },
  { word: 'bẩn thỉu', category: 'PROFANITY', notes: 'AI phân biệt phản ánh vệ sinh vs công kích' },
  { word: 'mất dạy', category: 'PROFANITY', notes: 'Ngôn từ công kích cần AI xác minh' },
  { word: 'vô học', category: 'PROFANITY', notes: 'Ngôn từ công kích cần AI xác minh' },
  { word: 'stupid', category: 'PROFANITY', notes: 'Từ công kích tiếng Anh' },
  { word: 'idiot', category: 'PROFANITY', notes: 'Từ công kích tiếng Anh' },
  { word: 'trash', category: 'PROFANITY', notes: 'AI phân biệt rác thải vs công kích (EN)' },
  { word: 'garbage', category: 'PROFANITY', notes: 'AI phân biệt rác thải vs công kích (EN)' },
  { word: 'disgusting', category: 'PROFANITY', notes: 'AI phân biệt đánh giá dịch vụ vs công kích (EN)' },

  // --- OTHER (Bạo lực/cảm thán phụ thuộc ngữ cảnh) ---
  { word: 'chết', category: 'OTHER', notes: 'AI phân biệt cảm thán ("ngon chết mê") vs bạo lực' },
  { word: 'giết', category: 'OTHER', notes: 'AI phân biệt cảm thán vs đe dọa bạo lực' },
  { word: 'máu', category: 'OTHER', notes: 'AI phân biệt ẩm thực ("tiết canh/máu") vs bạo lực' },
  { word: 'đánh nhau', category: 'OTHER', notes: 'Phản ánh an ninh vs kích động bạo lực' },
  { word: 'chém', category: 'OTHER', notes: 'AI phân biệt ("chém gió") vs bạo lực' },
  { word: 'đâm', category: 'OTHER', notes: 'AI phân biệt chỉ đường/tai nạn vs đe dọa' },
  { word: 'kill', category: 'OTHER', notes: 'Ngữ cảnh cảm thán vs bạo lực (EN)' },
  { word: 'die', category: 'OTHER', notes: 'Ngữ cảnh cảm thán vs bạo lực (EN)' },
  { word: 'dead', category: 'OTHER', notes: 'Ngữ cảnh cảm thán vs bạo lực (EN)' },
  { word: 'blood', category: 'OTHER', notes: 'Ngữ cảnh mô tả vs bạo lực (EN)' },
];

async function seedBannedWords() {
  console.log('Seeding initial Banned & Review Words to PostgreSQL...');

  const allEntries = [
    ...INITIAL_BANNED_WORDS.map((item) => ({ ...item, action: 'BLOCK' })),
    ...INITIAL_REVIEW_WORDS.map((item) => ({ ...item, action: 'REVIEW' })),
  ];

  const formatted = allEntries.map((item) => ({
    word: item.word.toLowerCase().trim(),
    category: item.category,
    action: item.action,
    isActive: true,
    notes: item.notes,
  }));

  const result = await prisma.bannedWord.createMany({
    data: formatted,
    skipDuplicates: true,
  });

  const total = await prisma.bannedWord.count();
  console.log(`Seeding complete: Inserted ${result.count} new words. Total active words in DB: ${total}`);
  await prisma.$disconnect();
  await pool.end();
}

seedBannedWords().catch(async (e) => {
  console.error('Seed Banned Words failed:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
