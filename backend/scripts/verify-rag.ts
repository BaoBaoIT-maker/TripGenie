import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { KnowledgeService } from '../src/modules/knowledge/knowledge.service';

async function bootstrap() {
  console.log('====================================================');
  console.log('  TRIPGENIE: VERIFYING RAG VECTOR RETRIEVAL (LIVE DB)');
  console.log('====================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const knowledgeService = app.get(KnowledgeService);
  const prisma = app.get(PrismaService);

  const daNang = await prisma.travelArea.findUnique({
    where: { slug: 'da-nang' },
    select: { id: true, nameVi: true },
  });
  console.log(`Resolved Area: ${daNang?.nameVi} -> ID: ${daNang?.id}\n`);

  const testQueries = [
    {
      label: '1. Câu hỏi Trúng đích (Vé Bà Nà & Trẻ em)',
      query: 'Bà Nà Hills giá vé bao nhiêu và trẻ em tính chiều cao thế nào?',
      areaId: daNang?.id,
    },
    {
      label: '2. Câu hỏi Mẹo bản địa (Sơn Trà & Xe tay ga)',
      query: 'Lên bán đảo Sơn Trà có được đi xe tay ga không?',
      areaId: daNang?.id,
    },
    {
      label: '3. Câu hỏi An toàn & Tránh lừa đảo (Cân hải sản)',
      query: 'Làm sao để tránh bị cân thiếu hải sản tươi sống ở miền Trung?',
    },
  ];

  try {
    for (const item of testQueries) {
      console.log(`\n----------------------------------------------------`);
      console.log(`[TEST] ${item.label}`);
      console.log(`Query: "${item.query}" (areaId: ${item.areaId ?? 'ALL'})`);
      console.log(`----------------------------------------------------`);

      const results = await knowledgeService.searchKnowledge(item.query, {
        areaId: item.areaId,
        limit: 2,
        minSimilarity: 0.25,
      });

      if (results.length === 0) {
        console.log('⚠️ [FALLBACK TRIGGERED] Không tìm thấy chunk nào vượt ngưỡng similarity 0.25.');
      } else {
        results.forEach((r, idx) => {
          console.log(`\n  Top #${idx + 1} | Score: ${(r.similarity_score * 100).toFixed(2)}% | Doc: "${r.document_title}"`);
          console.log(`  Breadcrumbs: ${r.metadata.breadcrumbs}`);
          const snippet = r.content.split('\n').slice(0, 4).join(' ');
          console.log(`  Snippet: ${snippet.substring(0, 180)}...`);
        });
      }
    }
    console.log('\n====================================================');
    console.log('  VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
