import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KnowledgeService } from '../src/modules/knowledge/knowledge.service';

async function bootstrap() {
  console.log('====================================================');
  console.log('  TRIPGENIE: SEEDING AGENTIC RAG KNOWLEDGE BASE');
  console.log('====================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const knowledgeService = app.get(KnowledgeService);

  try {
    const results = await knowledgeService.ingestAll();
    console.log('\n--- KNOWLEDGE INGESTION SUMMARY ---');
    console.table(results);
    console.log('Knowledge seeding completed successfully!\n');
  } catch (error) {
    console.error('Knowledge seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
