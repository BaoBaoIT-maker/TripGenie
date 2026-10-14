import { Injectable, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { IEmbeddingService } from '../places/interfaces/embedding-service.interface';
import {
  EmbeddedChunkData,
  IngestionResult,
  KNOWLEDGE_CONSTANTS,
  KnowledgeSearchResult,
  KnowledgeSourceType,
  SearchChunksOptions,
} from './knowledge.constants';
import { IKnowledgeRepository } from './knowledge.repository';
import { createSemanticChunks, parseFrontmatter } from './markdown-chunker';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(INJECT_TOKENS.KNOWLEDGE_REPOSITORY)
    private readonly knowledgeRepo: IKnowledgeRepository,
    @Inject(INJECT_TOKENS.EMBEDDING_SERVICE)
    private readonly embeddingService: IEmbeddingService,
  ) {}

  /**
   * Scans and ingests all Markdown files from the knowledge directory.
   * Idempotent: Skips unchanged files where DB content matches file content.
   */
  async ingestAll(customDir?: string): Promise<IngestionResult[]> {
    const knowledgeDir =
      customDir ??
      path.resolve(process.cwd(), KNOWLEDGE_CONSTANTS.DEFAULT_KNOWLEDGE_DIR);

    if (!fs.existsSync(knowledgeDir)) {
      this.logger.warn(`Knowledge directory not found at: ${knowledgeDir}`);
      return [];
    }

    const files = fs
      .readdirSync(knowledgeDir)
      .filter((file) => file.endsWith('.md'))
      .sort();

    this.logger.log(`Found ${files.length} knowledge markdown files to ingest.`);
    const results: IngestionResult[] = [];

    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      try {
        const res = await this.ingestFile(filePath);
        results.push(res);
      } catch (err: any) {
        this.logger.error(`Error ingesting file ${file}: ${err.message}`, err.stack);
        results.push({
          filename: file,
          status: 'failed',
          reason: err.message,
        });
      }
    }

    return results;
  }

  /**
   * Ingests a single markdown file into knowledge base.
   */
  async ingestFile(filePath: string): Promise<IngestionResult> {
    const filename = path.basename(filePath);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const relativeSourceUrl = path
      .relative(process.cwd(), filePath)
      .replace(/\\/g, '/');

    const { frontmatter, body } = parseFrontmatter(rawContent);

    // 1. Idempotency Check: Ponytail Rung 1 & 6 (String equality in RAM)
    const existingDoc = await this.knowledgeRepo.findDocumentBySourceUrl(
      relativeSourceUrl,
    );

    if (
      existingDoc &&
      existingDoc.content === rawContent &&
      existingDoc.isProcessed
    ) {
      this.logger.log(`[SKIP] Unchanged: ${filename} (${existingDoc.chunkCount} chunks)`);
      return {
        filename,
        status: 'skipped',
        title: existingDoc.title,
        chunkCount: existingDoc.chunkCount,
      };
    }

    this.logger.log(`[INGESTING] Processing ${filename}: "${frontmatter.title}"...`);

    // 2. Resolve Area ID from area_slug
    let areaId: number | null = null;
    if (frontmatter.area_slug) {
      areaId = await this.knowledgeRepo.findAreaIdBySlug(frontmatter.area_slug);
    }

    // 3. Semantic Heading Chunking (Pure utility)
    const chunks = createSemanticChunks(frontmatter.title, body, {
      categoryTags: frontmatter.category_tags || [],
      areaSlug: frontmatter.area_slug,
    });

    if (chunks.length === 0) {
      throw new Error(`Document ${filename} produced 0 chunks.`);
    }

    // 4. Generate Embeddings for each chunk
    this.logger.log(`Generating embeddings for ${chunks.length} chunks of "${filename}"...`);
    const embeddedChunks: EmbeddedChunkData[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await this.embeddingService.generateEmbedding(chunk.content);
      embeddedChunks.push({
        index: i,
        content: chunk.content,
        metadata: chunk.metadata,
        vector,
      });

      // Gentle rate-limiting delay between chunks to respect Gemini Free Tier 100 RPM
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    // 5. Delegate persistence to Repository (DIP Principle)
    const modelName = this.embeddingService.getModelName();
    const savedDoc = await this.knowledgeRepo.upsertDocumentWithChunks(
      {
        title: frontmatter.title,
        sourceType: frontmatter.source_type || KnowledgeSourceType.CURATED_GUIDE,
        sourceUrl: relativeSourceUrl,
        content: rawContent,
        language: frontmatter.language || KNOWLEDGE_CONSTANTS.DEFAULT_LANGUAGE,
        areaId,
        categoryTags: frontmatter.category_tags || [],
        chunkCount: embeddedChunks.length,
      },
      embeddedChunks,
      modelName,
    );

    this.logger.log(`[SUCCESS] Ingested ${filename} -> ${savedDoc.chunkCount} chunks saved.`);

    return {
      filename,
      status: 'ingested',
      title: savedDoc.title,
      chunkCount: savedDoc.chunkCount,
    };
  }

  /**
   * Queries knowledge chunks using pgvector Cosine Similarity (<=>).
   * Supports pre-filtering by areaId (includes nationwide chunks with area_id IS NULL).
   * Enforces minimum similarity threshold (default 0.25) to avoid hallucinations.
   */
  async searchKnowledge(
    query: string,
    options?: SearchChunksOptions,
  ): Promise<KnowledgeSearchResult[]> {
    const queryVector = await this.embeddingService.generateEmbedding(query);
    return this.knowledgeRepo.searchSimilarChunks(queryVector, options);
  }
}
