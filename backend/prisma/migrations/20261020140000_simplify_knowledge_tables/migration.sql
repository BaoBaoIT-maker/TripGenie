-- Simplify knowledge tables: drop columns no query or logic reads.
-- Data-preserving: breadcrumbs is backfilled from metadata before metadata is dropped (no re-embedding needed).

ALTER TABLE knowledge_chunks ADD COLUMN breadcrumbs TEXT;
UPDATE knowledge_chunks SET breadcrumbs = COALESCE(metadata->>'breadcrumbs', '');
ALTER TABLE knowledge_chunks ALTER COLUMN breadcrumbs SET NOT NULL;
ALTER TABLE knowledge_chunks DROP COLUMN metadata, DROP COLUMN model_name;

ALTER TABLE knowledge_documents
  DROP COLUMN source_type,
  DROP COLUMN language,
  DROP COLUMN category_tags,
  DROP COLUMN is_processed,
  DROP COLUMN chunk_count,
  DROP COLUMN processed_at;
