-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "place_image_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: place_images moderation & contributor tracking
ALTER TABLE "place_images"
  ADD COLUMN IF NOT EXISTS "status" "place_image_status_enum" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "uploaded_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "moderation_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "place_images"
    ADD CONSTRAINT "place_images_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "place_images"
    ADD CONSTRAINT "place_images_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "place_images_place_id_status_idx" ON "place_images"("place_id", "status");
CREATE INDEX IF NOT EXISTS "place_images_status_created_at_idx" ON "place_images"("status", "created_at");

-- Update chk_audit_target_type constraint to allow place_image and banned_word
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "chk_audit_target_type";

ALTER TABLE "audit_logs" ADD CONSTRAINT "chk_audit_target_type" CHECK (
  lower("target_type") IN (
    'place',
    'place_image',
    'review',
    'user',
    'crawl_job',
    'itinerary',
    'community_post',
    'post_comment',
    'community_group',
    'content_report',
    'travel_area',
    'system_setting',
    'banned_word'
  )
);
