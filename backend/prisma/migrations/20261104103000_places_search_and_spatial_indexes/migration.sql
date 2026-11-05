-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create GIN Trigram Indexes for fast text and fuzzy search on places
CREATE INDEX IF NOT EXISTS "idx_places_name_trgm" ON "places" USING gin ("name" gin_trgm_ops) WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_places_name_norm_trgm" ON "places" USING gin ("name_normalized" gin_trgm_ops) WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_places_address_trgm" ON "places" USING gin ("address" gin_trgm_ops) WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_places_desc_trgm" ON "places" USING gin ("description" gin_trgm_ops) WHERE ("deleted_at" IS NULL AND "description" IS NOT NULL);

-- 3. Create GIN Index for array tags filtering
CREATE INDEX IF NOT EXISTS "idx_places_tags_gin" ON "places" USING gin ("tags") WHERE ("deleted_at" IS NULL);

-- 4. Create GiST Spatial Index for PostGIS bounding radius and nearest-neighbor search
CREATE INDEX IF NOT EXISTS "idx_places_location_gist" ON "places" USING gist ("location") WHERE ("deleted_at" IS NULL);
