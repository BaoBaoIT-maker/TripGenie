-- AlterTable notifications: add target_type, target_id, metadata
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "target_type" VARCHAR(32);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "target_id" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure metadata is an object
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_metadata_object'
  ) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "chk_notifications_metadata_object" CHECK (jsonb_typeof("metadata") = 'object');
  END IF;
END $$;

-- Backfill existing notifications based on event type
UPDATE "notifications"
SET "target_type" = 'POST', "target_id" = "post_id"
WHERE "type" = 'POST_LIKED' AND "post_id" IS NOT NULL AND "target_type" IS NULL;

UPDATE "notifications"
SET "target_type" = 'COMMENT', "target_id" = "comment_id"
WHERE "type" IN ('POST_COMMENTED', 'COMMENT_REPLIED') AND "comment_id" IS NOT NULL AND "target_type" IS NULL;

UPDATE "notifications"
SET "target_type" = 'TRIP_INVITATION', "target_id" = "invitation_id"
WHERE "type" IN ('TRIP_INVITED', 'TRIP_INVITATION_ACCEPTED', 'TRIP_INVITATION_DECLINED') AND "invitation_id" IS NOT NULL AND "target_type" IS NULL;

-- Enforce NOT NULL constraints once backfilled
ALTER TABLE "notifications" ALTER COLUMN "target_type" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "target_id" SET NOT NULL;

-- Create index on (target_type, target_id) for rapid lifecycle cleanup
CREATE INDEX IF NOT EXISTS "notifications_target_type_target_id_idx" ON "notifications"("target_type", "target_id");
