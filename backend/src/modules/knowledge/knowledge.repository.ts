import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  EmbeddedChunkData,
  KNOWLEDGE_CONSTANTS,
  KnowledgeSearchResult,
  SearchChunksOptions,
  UpsertKnowledgeDocumentData,
} from './knowledge.constants';

export interface IKnowledgeRepository {
  findDocumentBySourceUrl(sourceUrl: string): Promise<{
    id: string;
    title: string;
    content: string;
    isProcessed: boolean;
    chunkCount: number;
  } | null>;

  upsertDocumentWithChunks(
    docData: UpsertKnowledgeDocumentData,
    chunks: EmbeddedChunkData[],
    modelName: string,
  ): Promise<{ id: string; title: string; chunkCount: number }>;

  searchSimilarChunks(
    vector: number[],
    options?: SearchChunksOptions,
  ): Promise<KnowledgeSearchResult[]>;

  findAreaIdBySlug(slug: string): Promise<number | null>;
}

@Injectable()
export class KnowledgeRepository implements IKnowledgeRepository {
  private readonly logger = new Logger(KnowledgeRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findDocumentBySourceUrl(sourceUrl: string) {
    return this.prisma.knowledgeDocument.findFirst({
      where: { sourceUrl },
      select: {
        id: true,
        title: true,
        content: true,
        isProcessed: true,
        chunkCount: true,
      },
    });
  }

  async findAreaIdBySlug(slug: string): Promise<number | null> {
    const area = await this.prisma.travelArea.findUnique({
      where: { slug },
      select: { id: true },
    });
    return area?.id ?? null;
  }

  async upsertDocumentWithChunks(
    docData: UpsertKnowledgeDocumentData,
    chunks: EmbeddedChunkData[],
    modelName: string,
  ): Promise<{ id: string; title: string; chunkCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeDocument.findFirst({
        where: { sourceUrl: docData.sourceUrl },
        select: { id: true },
      });

      let docId: string;

      if (existing) {
        docId = existing.id;
        await tx.knowledgeDocument.update({
          where: { id: docId },
          data: {
            title: docData.title,
            sourceType: docData.sourceType,
            content: docData.content,
            language: docData.language,
            areaId: docData.areaId,
            categoryTags: docData.categoryTags,
            isProcessed: true,
            chunkCount: docData.chunkCount,
            processedAt: new Date(),
          },
        });

        // Cascade delete ensures chunks are cleaned up cleanly
        await tx.$executeRaw`DELETE FROM knowledge_chunks WHERE document_id = ${docId}::uuid;`;
      } else {
        const created = await tx.knowledgeDocument.create({
          data: {
            title: docData.title,
            sourceType: docData.sourceType,
            sourceUrl: docData.sourceUrl,
            content: docData.content,
            language: docData.language,
            areaId: docData.areaId,
            categoryTags: docData.categoryTags,
            isProcessed: true,
            chunkCount: docData.chunkCount,
            processedAt: new Date(),
          },
        });
        docId = created.id;
      }

      // Insert embedded chunks using raw SQL for Unsupported("vector(1536)")
      for (const item of chunks) {
        const vectorString = `[${item.vector.join(',')}]`;
        const metadataJson = JSON.stringify(item.metadata);

        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (
            document_id, chunk_index, content, embedding, model_name, metadata, created_at
          ) VALUES (
            ${docId}::uuid,
            ${item.index},
            ${item.content},
            ${vectorString}::vector,
            ${modelName},
            ${metadataJson}::jsonb,
            NOW()
          );
        `;
      }

      return {
        id: docId,
        title: docData.title,
        chunkCount: chunks.length,
      };
    });
  }

  async searchSimilarChunks(
    vector: number[],
    options?: SearchChunksOptions,
  ): Promise<KnowledgeSearchResult[]> {
    const limit = options?.limit ?? KNOWLEDGE_CONSTANTS.DEFAULT_CHUNK_LIMIT;
    const minSimilarity =
      options?.minSimilarity ?? KNOWLEDGE_CONSTANTS.DEFAULT_MIN_SIMILARITY;

    const vectorString = `[${vector.join(',')}]`;

    // Pre-filtering: area-specific OR nationwide (area_id IS NULL or country level)
    const areaCondition =
      options?.areaId !== undefined
        ? `AND (d.area_id = $4 OR d.area_id IS NULL OR d.area_id IN (SELECT id FROM travel_areas WHERE slug = '${KNOWLEDGE_CONSTANTS.NATIONWIDE_AREA_SLUG}' OR type = 'COUNTRY'))`
        : '';

    const args: unknown[] = [vectorString, minSimilarity, limit];
    if (options?.areaId !== undefined) {
      args.push(options.areaId);
    }

    const sql = `
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.metadata,
        d.title AS document_title,
        d.source_type,
        d.source_url,
        d.area_id,
        ROUND((1 - (c.embedding <=> $1::vector))::numeric, 4) AS similarity_score
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        ${areaCondition}
        AND (1 - (c.embedding <=> $1::vector)) >= $2
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    return this.prisma.$queryRawUnsafe<KnowledgeSearchResult[]>(sql, ...args);
  }
}
