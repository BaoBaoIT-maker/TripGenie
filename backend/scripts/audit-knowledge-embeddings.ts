import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KnowledgeService } from '../src/modules/knowledge/knowledge.service';
import { PrismaService } from '../src/database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

interface DocumentDbRow {
  id: string;
  title: string;
  source_url: string;
  source_type: string;
  is_processed: boolean;
  chunk_count: number;
  area_id: number | null;
  area_name: string | null;
  actual_chunks: bigint;
  embedded_chunks: bigint;
  null_embeddings: bigint;
  avg_dims: number | null;
}

interface PlaceEmbeddingStat {
  total_places: bigint;
  embedded_places: bigint;
  embedding_dims: number | null;
}

interface IndexStat {
  indexname: string;
  tablename: string;
  indexdef: string;
}

async function runAudit() {
  console.log('========================================================================');
  console.log('  TRIPGENIE: AUDIT & VERIFICATION CƠ SỞ DỮ LIỆU VECTOR EMBEDDING');
  console.log('========================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const prisma = app.get(PrismaService);
  const knowledgeService = app.get(KnowledgeService);

  try {
    // -------------------------------------------------------------------------
    // 1. KIỂM TRA TẬP TIN MARKDOWN TRÊN ĐĨA VS DATABASE
    // -------------------------------------------------------------------------
    const knowledgeDir = path.resolve(__dirname, '../data/knowledge');
    const localFiles = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md')).sort();
    console.log(`📁 Thư mục data/knowledge có ${localFiles.length} file tài liệu:`);
    localFiles.forEach((f, idx) => console.log(`   ${idx + 1}. ${f}`));

    // -------------------------------------------------------------------------
    // 2. TRUY VẤN CHI TIẾT VECTOR TRONG DATABASE (knowledge_documents & knowledge_chunks)
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('📊 QUÉT CHI TIẾT BẢNG KNOWLEDGE_DOCUMENTS & KNOWLEDGE_CHUNKS');
    console.log('------------------------------------------------------------------------');

    const docStats = await prisma.$queryRawUnsafe<DocumentDbRow[]>(`
      SELECT
        d.id,
        d.title,
        d.source_url,
        d.source_type,
        d.is_processed,
        d.chunk_count,
        d.area_id,
        a.name_vi AS area_name,
        COUNT(c.id) AS actual_chunks,
        COUNT(c.id) FILTER (WHERE c.embedding IS NOT NULL) AS embedded_chunks,
        COUNT(c.id) FILTER (WHERE c.embedding IS NULL) AS null_embeddings,
        (
          SELECT vector_dims(c2.embedding)
          FROM knowledge_chunks c2
          WHERE c2.document_id = d.id AND c2.embedding IS NOT NULL
          LIMIT 1
        ) AS avg_dims
      FROM knowledge_documents d
      LEFT JOIN travel_areas a ON d.area_id = a.id
      LEFT JOIN knowledge_chunks c ON d.id = c.document_id
      GROUP BY d.id, d.title, d.source_url, d.source_type, d.is_processed, d.chunk_count, d.area_id, a.name_vi
      ORDER BY d.source_url ASC;
    `);

    console.log(`\nTìm thấy ${docStats.length}/${localFiles.length} tài liệu trong DB:\n`);
    let totalChunksDb = 0;
    let totalEmbeddedChunksDb = 0;
    let totalNullEmbeddings = 0;

    docStats.forEach((doc, idx) => {
      const actual = Number(doc.actual_chunks);
      const embedded = Number(doc.embedded_chunks);
      const nulls = Number(doc.null_embeddings);
      const dims = doc.avg_dims ?? 0;

      totalChunksDb += actual;
      totalEmbeddedChunksDb += embedded;
      totalNullEmbeddings += nulls;

      const isComplete = doc.is_processed && actual === doc.chunk_count && actual === embedded && nulls === 0 && dims === 1536;
      const statusIcon = isComplete ? '✅ OK' : '❌ THIẾU';

      console.log(`[${idx + 1}] ${statusIcon} "${doc.title}"`);
      console.log(`    File URL: ${doc.source_url}`);
      console.log(`    Khu vực: ${doc.area_name ?? 'Toàn quốc (NULL)'} (area_id: ${doc.area_id ?? 'NULL'})`);
      console.log(`    Số chunk ghi nhận: ${doc.chunk_count} | Số chunk thực tế trong DB: ${actual}`);
      console.log(`    Số chunk đã nhúng vector: ${embedded} | Chunk thiếu vector: ${nulls}`);
      console.log(`    Vector Dimension: ${dims} dims (Chuẩn Gemini text-embedding-004 / embedding-2: 1536)`);
      console.log('');
    });

    console.log(`=> TỔNG KẾT KNOWLEDGE CHUNKS:`);
    console.log(`   - Tổng số chunks trong DB: ${totalChunksDb}`);
    console.log(`   - Tổng số chunks có vector 1536-dims: ${totalEmbeddedChunksDb}`);
    console.log(`   - Số chunk thiếu vector: ${totalNullEmbeddings}`);

    // -------------------------------------------------------------------------
    // 3. QUÉT BẢNG PLACE_EMBEDDINGS (Vector của các địa điểm du lịch)
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('📍 QUÉT BẢNG PLACE_EMBEDDINGS (VECTƠ ĐỊA ĐIỂM DU LỊCH)');
    console.log('------------------------------------------------------------------------');

    const placeStats = await prisma.$queryRawUnsafe<PlaceEmbeddingStat[]>(`
      SELECT
        (SELECT COUNT(*) FROM places) AS total_places,
        (SELECT COUNT(*) FROM place_embeddings WHERE embedding IS NOT NULL) AS embedded_places,
        (SELECT vector_dims(embedding) FROM place_embeddings WHERE embedding IS NOT NULL LIMIT 1) AS embedding_dims;
    `);

    if (placeStats.length > 0) {
      const p = placeStats[0];
      console.log(`   - Tổng số địa điểm (places): ${Number(p.total_places)}`);
      console.log(`   - Số địa điểm đã nhúng vector (place_embeddings): ${Number(p.embedded_places)}`);
      console.log(`   - Vector Dimension địa điểm: ${p.embedding_dims ?? 'Chưa có'} dims`);
    }

    // -------------------------------------------------------------------------
    // 4. KIỂM TRA HNSW INDEX TRONG POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('⚡ KIỂM TRA CHỈ MỤC HNSW INDEX (PGVECTOR ACCELERATION)');
    console.log('------------------------------------------------------------------------');

    const indexStats = await prisma.$queryRawUnsafe<IndexStat[]>(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE tablename IN ('knowledge_chunks', 'place_embeddings');
    `);

    indexStats.forEach((idx) => {
      console.log(`   📌 Index: ${idx.indexname} (${idx.tablename}) -> ${idx.indexdef}`);
    });

    // -------------------------------------------------------------------------
    // 5. TEST TỪNG TÀI LIỆU (8/8 DOCUMENT RETRIEVAL TESTS)
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('🎯 TEST RETRIEVAL TRUY VẤN VECTƠ TỪNG TÀI LIỆU (8/8 CẨM NANG)');
    console.log('========================================================================');

    const testCases = [
      {
        targetDocIdx: 1,
        targetFile: '01-vietnam-attraction-tickets-events.md',
        targetTitle: 'Đại Từ Điển Giá Vé Danh Thắng & Lịch Sự Kiện Định Kỳ Toàn Quốc',
        query: 'Giá vé cáp treo Fansipan Sapa và combo buffet bao nhiêu?',
        expectedTopic: 'Fansipan Sapa',
      },
      {
        targetDocIdx: 2,
        targetFile: '02-da-nang-city-handbook.md',
        targetTitle: 'Cẩm Nang Du Lịch Thực Chiến & Địa Chỉ Bản Địa TP. Đà Nẵng',
        query: 'Quán bún chả cá nào ngon nhất Đà Nẵng đường Nguyễn Chí Thanh?',
        expectedTopic: 'Bún chả cá Nguyễn Chí Thanh',
      },
      {
        targetDocIdx: 3,
        targetFile: '03-hoi-an-and-hue-handbook.md',
        targetTitle: 'Cẩm Nang Di Sản Miền Trung: Hội An & Cố Đô Huế',
        query: 'Đi tàu hỏa kết nối di sản Huế Đà Nẵng HD1 HD2 có gì đặc biệt?',
        expectedTopic: 'Tàu hỏa kết nối di sản Huế - Đà Nẵng',
      },
      {
        targetDocIdx: 4,
        targetFile: '04-phu-quoc-and-islands-handbook.md',
        targetTitle: 'Cẩm Nang Du Lịch Biển Đảo: Phú Quốc, Côn Đảo & Lý Sơn',
        query: 'Mùa gió chướng Phú Quốc bờ Đông bờ Tây và ngắm sao biển Rạch Vẹm tháng mấy?',
        expectedTopic: 'Mùa gió Phú Quốc & Sao biển Rạch Vẹm',
      },
      {
        targetDocIdx: 5,
        targetFile: '05-hanoi-and-north-handbook.md',
        targetTitle: 'Cẩm Nang Khám Phá Thủ Đô Hà Nội & Vòng Cung Đông Tây Bắc',
        query: 'Lịch viếng Lăng Bác và cách đặt vé tour đêm Hỏa Lò Hà Nội?',
        expectedTopic: 'Lăng Bác & Di tích Nhà tù Hỏa Lò',
      },
      {
        targetDocIdx: 6,
        targetFile: '06-hochiminh-and-south-handbook.md',
        targetTitle: 'Cẩm Nang Sài Gòn Đô Thị Phồn Hoa & Miền Tây Sông Nước',
        query: 'Cách đặt vé Saigon Waterbus đi ngắm hoàng hôn sông Sài Gòn?',
        expectedTopic: 'Saigon Waterbus',
      },
      {
        targetDocIdx: 7,
        targetFile: '07-vietnam-transit-and-logistics.md',
        targetTitle: 'Cẩm Nang Giao Thông, Di Chuyển & Logistics Du Lịch Toàn Quốc',
        query: 'Cách phân biệt taxi dù lừa đảo sân bay và mẹo đi xe số hãm phanh đổ đèo?',
        expectedTopic: 'Bẫy taxi sân bay & Kỹ thuật đổ đèo an toàn',
      },
      {
        targetDocIdx: 8,
        targetFile: '08-travel-personas-safety-culture.md',
        targetTitle: 'Cẩm Nang An Toàn, Văn Hóa Tâm Linh, Đối Tượng Đặc Thù & Cấp Cứu Du Lịch',
        query: 'Cần đổi tiền ngoại tệ ở phố Hà Trung hay Chợ Bến Thành và số hotline cấp cứu 115?',
        expectedTopic: 'Đổi ngoại tệ & Hotline cấp cứu y tế',
      },
    ];

    let passedTests = 0;

    for (const tc of testCases) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`[TEST #${tc.targetDocIdx}] Mục tiêu: "${tc.targetTitle}"`);
      console.log(`❓ Câu hỏi: "${tc.query}"`);

      const results = await knowledgeService.searchKnowledge(tc.query, {
        limit: 2,
        minSimilarity: 0.25,
      });

      if (results.length === 0) {
        console.log(`❌ THẤT BẠI: Không tìm thấy chunk nào vượt ngưỡng minSimilarity!`);
        continue;
      }

      const topHit = results[0];
      const isTargetMatched = Boolean(topHit.source_url?.includes(tc.targetFile));
      const scorePercent = (topHit.similarity_score * 100).toFixed(2);

      if (isTargetMatched) {
        passedTests++;
        console.log(`✅ CHÍNH XÁC (HIT): Top #1 đúng tài liệu mục tiêu!`);
      } else {
        console.log(`⚠️ KHÁC TÀI LIỆU MỤC TIÊU: Top #1 rơi vào "${topHit.document_title}"`);
      }

      console.log(`   - Similarity Score: ${scorePercent}%`);
      console.log(`   - Document Title: "${topHit.document_title}"`);
      console.log(`   - Breadcrumbs: ${topHit.metadata.breadcrumbs}`);
      const preview = topHit.content.replace(/\n+/g, ' ').slice(0, 160);
      console.log(`   - Trích đoạn: "${preview}..."`);

      if (results.length > 1) {
        const secondHit = results[1];
        console.log(`   - Top #2 (${(secondHit.similarity_score * 100).toFixed(2)}%): "${secondHit.document_title}" > ${secondHit.metadata.breadcrumbs}`);
      }
    }

    console.log('\n========================================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passedTests}/${testCases.length} TÀI LIỆU ĐƯỢC RETRIEVE CHÍNH XÁC TOP #1!`);
    console.log('========================================================================\n');
  } catch (error) {
    console.error('Audit failed with error:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runAudit();
