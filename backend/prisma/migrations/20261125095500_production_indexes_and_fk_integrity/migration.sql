-- Batch 2: Production DB hardening — hot-path composite/FK indexes & FK integrity

-- 1. Missing hot-path composite & FK indexes
CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx" ON "user_identities"("user_id");
CREATE INDEX IF NOT EXISTS "places_area_id_status_deleted_at_rating_avg_idx" ON "places"("area_id", "status", "deleted_at", "rating_avg" DESC);
CREATE INDEX IF NOT EXISTS "places_area_id_category_id_status_deleted_at_idx" ON "places"("area_id", "category_id", "status", "deleted_at");
CREATE INDEX IF NOT EXISTS "place_sources_place_id_idx" ON "place_sources"("place_id");
CREATE INDEX IF NOT EXISTS "place_sources_sync_status_last_synced_at_idx" ON "place_sources"("sync_status", "last_synced_at");
CREATE INDEX IF NOT EXISTS "collection_places_place_id_idx" ON "collection_places"("place_id");
CREATE INDEX IF NOT EXISTS "itineraries_creator_id_deleted_at_updated_at_idx" ON "itineraries"("creator_id", "deleted_at", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "group_members_user_id_idx" ON "group_members"("user_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_updated_at_idx" ON "ai_chat_sessions"("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_linked_itinerary_id_idx" ON "ai_chat_sessions"("linked_itinerary_id");
CREATE INDEX IF NOT EXISTS "crawl_jobs_status_priority_scheduled_at_idx" ON "crawl_jobs"("status", "priority", "scheduled_at");
CREATE INDEX IF NOT EXISTS "crawl_jobs_area_id_idx" ON "crawl_jobs"("area_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- 2. Remove hardcoded Vietnamese default title from ai_chat_sessions (handled in UI by locale)
ALTER TABLE "ai_chat_sessions"
  ALTER COLUMN "title" DROP DEFAULT;

-- 3. Preserve audit logs on user hard-delete (actor_id nullable + ON DELETE SET NULL)
ALTER TABLE "audit_logs"
  ALTER COLUMN "actor_id" DROP NOT NULL;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actor_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Prevent FK restriction errors on nullable optional references
ALTER TABLE "places" DROP CONSTRAINT IF EXISTS "places_created_by_fkey";
ALTER TABLE "places"
  ADD CONSTRAINT "places_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "places" DROP CONSTRAINT IF EXISTS "places_merged_into_fkey";
ALTER TABLE "places"
  ADD CONSTRAINT "places_merged_into_fkey"
  FOREIGN KEY ("merged_into") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT IF EXISTS "ai_chat_sessions_linked_itinerary_id_fkey";
ALTER TABLE "ai_chat_sessions"
  ADD CONSTRAINT "ai_chat_sessions_linked_itinerary_id_fkey"
  FOREIGN KEY ("linked_itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_reports" DROP CONSTRAINT IF EXISTS "content_reports_reviewed_by_fkey";
ALTER TABLE "content_reports"
  ADD CONSTRAINT "content_reports_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crawl_jobs" DROP CONSTRAINT IF EXISTS "crawl_jobs_area_id_fkey";
ALTER TABLE "crawl_jobs"
  ADD CONSTRAINT "crawl_jobs_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "travel_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crawl_jobs" DROP CONSTRAINT IF EXISTS "crawl_jobs_place_id_fkey";
ALTER TABLE "crawl_jobs"
  ADD CONSTRAINT "crawl_jobs_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crawl_jobs" DROP CONSTRAINT IF EXISTS "crawl_jobs_created_by_fkey";
ALTER TABLE "crawl_jobs"
  ADD CONSTRAINT "crawl_jobs_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
