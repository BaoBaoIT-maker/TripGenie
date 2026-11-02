-- Migration: Cleanup dead / redundant columns across places, place_embeddings, place_images, and ai_chat_messages
-- 1. Drop view active_places if exists so ALTER TABLE places succeeds
DROP VIEW IF EXISTS active_places;

-- 2. Table: places (drop address_normalized, address_verified, coordinate_source)
ALTER TABLE places DROP COLUMN IF EXISTS address_normalized;
ALTER TABLE places DROP COLUMN IF EXISTS address_verified;
ALTER TABLE places DROP COLUMN IF EXISTS coordinate_source;

-- 3. Recreate view active_places without dead columns
CREATE OR REPLACE VIEW active_places AS
    SELECT * FROM places
    WHERE deleted_at IS NULL
      AND status != 'DUPLICATE';

-- 4. Table: place_embeddings (drop model_version)
ALTER TABLE place_embeddings DROP COLUMN IF EXISTS model_version;

-- 5. Table: place_images (drop width, height)
ALTER TABLE place_images DROP COLUMN IF EXISTS width;
ALTER TABLE place_images DROP COLUMN IF EXISTS height;

-- 6. Table: ai_chat_messages (drop latency_ms, token_count)
ALTER TABLE ai_chat_messages DROP COLUMN IF EXISTS latency_ms;
ALTER TABLE ai_chat_messages DROP COLUMN IF EXISTS token_count;
