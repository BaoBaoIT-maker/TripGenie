/**
 * Domain constants and enums for Knowledge Base & RAG.
 * Adheres to AGENTS.md "No Hard-coding" rule: all magic strings/numbers are extracted here.
 */

export enum KnowledgeSourceType {
  CURATED_GUIDE = 'curated_guide',
  OFFICIAL_PORTAL = 'official_portal',
  CRAWLED_WEB = 'crawled_web',
}

export const KNOWLEDGE_CONSTANTS = {
  DEFAULT_KNOWLEDGE_DIR: 'data/knowledge',
  DEFAULT_LANGUAGE: 'vi',
  DEFAULT_CHUNK_LIMIT: 4,
  DEFAULT_MIN_SIMILARITY: 0.25,
  MIN_CHUNK_CHAR_LENGTH: 50,
  NATIONWIDE_AREA_SLUG: 'viet-nam',
} as const;

export interface ChunkMetadata {
  sectionTitle: string;
  h2Title?: string;
  h3Title?: string;
  breadcrumbs: string;
  categoryTags: string[];
  areaSlug?: string;
}

export interface KnowledgeSearchResult {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: ChunkMetadata;
  document_title: string;
  source_type: string;
  source_url: string | null;
  area_id: number | null;
  similarity_score: number;
}

export interface IngestionResult {
  filename: string;
  status: 'skipped' | 'ingested' | 'failed';
  title?: string;
  chunkCount?: number;
  reason?: string;
}

export interface UpsertKnowledgeDocumentData {
  title: string;
  sourceType: string;
  sourceUrl: string;
  content: string;
  language: string;
  areaId: number | null;
  categoryTags: string[];
  chunkCount: number;
}

export interface EmbeddedChunkData {
  index: number;
  content: string;
  metadata: ChunkMetadata;
  vector: number[];
}

export interface SearchChunksOptions {
  areaId?: number;
  limit?: number;
  minSimilarity?: number;
}
