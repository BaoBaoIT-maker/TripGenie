/**
 * Domain constants and types for Knowledge Base & RAG.
 * Adheres to AGENTS.md "No Hard-coding" rule: all magic strings/numbers are extracted here.
 */

export const KNOWLEDGE_CONSTANTS = {
  DEFAULT_KNOWLEDGE_DIR: 'data/knowledge',
  DEFAULT_CHUNK_LIMIT: 4,
  DEFAULT_MIN_SIMILARITY: 0.25,
  MIN_CHUNK_CHAR_LENGTH: 50,
  NATIONWIDE_AREA_SLUG: 'viet-nam',
} as const;

export interface KnowledgeSearchResult {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  /** "Doc title > H2 > H3". */
  breadcrumbs: string;
  document_title: string;
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
  sourceUrl: string;
  content: string;
  areaId: number | null;
}

export interface EmbeddedChunkData {
  index: number;
  content: string;
  breadcrumbs: string;
  vector: number[];
}

export interface SearchChunksOptions {
  areaId?: number;
  limit?: number;
  minSimilarity?: number;
}
