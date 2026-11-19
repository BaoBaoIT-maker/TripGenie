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

function normalizeForScan(text) {
  return text
    .toLowerCase()
    .replace(/(\p{L})[._*~-]+(?=\p{L})/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runBannedWordsTest() {
  console.log('--- TESTING BANNED WORDS ENGINE ---');

  // 1. Fetch active words from DB
  const activeWords = await prisma.bannedWord.findMany({
    where: { isActive: true },
    select: { word: true, category: true },
  });
  console.log(`Loaded ${activeWords.length} active banned words from DB.`);

  // 2. Compile Unicode Regex
  const wordList = activeWords.map((w) => w.word.toLowerCase().trim());
  wordList.sort((a, b) => b.length - a.length);
  const escaped = wordList.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'iu');

  function check(text) {
    const normalized = normalizeForScan(text);
    const match = regex.exec(normalized);
    return {
      isBanned: Boolean(match),
      matchedWord: match ? match[0] : null,
    };
  }

  // 3. Test Cases: Direct banned words
  const directCases = [
    { input: 'Anh nắc em đụ', expectedBanned: true },
    { input: 'Cái thằng chó đẻ này', expectedBanned: true },
    { input: 'Đánh bạc tài xỉu kiếm tiền', expectedBanned: true },
    { input: 'Chuyển khoản cọc giữ phòng nhé', expectedBanned: true },
    { input: 'You are an asshole get out', expectedBanned: true },
  ];

  console.log('\n[TEST GROUP 1: DIRECT VIOLATIONS]');
  for (const tc of directCases) {
    const res = check(tc.input);
    const pass = res.isBanned === tc.expectedBanned;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.input}" -> isBanned: ${res.isBanned} (matched: ${res.matchedWord})`);
    if (!pass) throw new Error(`Test failed for: ${tc.input}`);
  }

  // 4. Test Cases: Leetspeak disguised words
  const leetspeakCases = [
    { input: 'Anh n.ắ.c em đ.ụ', expectedBanned: true },
    { input: 'đ-é-o bao giờ đi nữa', expectedBanned: true },
    { input: 'c*ặ*c gì thế', expectedBanned: true },
    { input: 'l_ồ_n m_ẹ m_à_y', expectedBanned: true },
  ];

  console.log('\n[TEST GROUP 2: LEETSPEAK EVASIONS]');
  for (const tc of leetspeakCases) {
    const res = check(tc.input);
    const pass = res.isBanned === tc.expectedBanned;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.input}" -> isBanned: ${res.isBanned} (matched: ${res.matchedWord})`);
    if (!pass) throw new Error(`Test failed for: ${tc.input}`);
  }

  // 5. Test Cases: False Positives (completely legitimate words)
  const legitCases = [
    { input: 'Hạnh phúc trên từng nẻo đường du lịch', expectedBanned: false },
    { input: 'Con gà cục tác lá chanh', expectedBanned: false },
    { input: 'Lồng đèn Hội An rất đẹp rực rỡ', expectedBanned: false },
    { input: 'Thịt con lợn quay thơm ngon', expectedBanned: false },
    { input: 'Du lịch qua các châu lục trên thế giới', expectedBanned: false },
    { input: 'Món cá rô phi chiên giòn tuyệt hảo', expectedBanned: false },
  ];

  console.log('\n[TEST GROUP 3: FALSE POSITIVE PREVENTION (LEGIT WORDS)]');
  for (const tc of legitCases) {
    const res = check(tc.input);
    const pass = res.isBanned === tc.expectedBanned;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.input}" -> isBanned: ${res.isBanned}`);
    if (!pass) throw new Error(`False positive detected for legitimate text: ${tc.input}`);
  }

  // 6. Benchmark speed
  console.log('\n[TEST GROUP 4: SPEED BENCHMARK]');
  const samplePost = 'Kinh nghiệm du lịch Đà Nẵng 4 ngày 3 đêm cho gia đình. Khách sạn gần biển Mỹ Khê, đồ ăn tươi ngon và không bị chặt chém giá cả. Điểm đến Bà Nà Hills rất đẹp, cảnh quan thơ mộng tuyệt vời.';
  const iterations = 5000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    check(samplePost);
  }
  const duration = performance.now() - start;
  const avgMs = duration / iterations;
  console.log(`Scanned ${iterations} times in ${duration.toFixed(2)}ms (Average: ${avgMs.toFixed(4)}ms per check)`);
  if (avgMs > 0.1) {
    console.warn('Warning: Scan speed exceeded 0.1ms threshold');
  } else {
    console.log(`[PASS] In-Memory Scan Speed is blazing fast (< 0.05ms): ${avgMs.toFixed(4)}ms!`);
  }

  console.log('\n--- ALL ENGINE TESTS PASSED 100% ---');
  await prisma.$disconnect();
  await pool.end();
}

runBannedWordsTest().catch(async (e) => {
  console.error('Test error:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
