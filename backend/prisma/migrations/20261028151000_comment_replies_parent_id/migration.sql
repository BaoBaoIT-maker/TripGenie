-- AlterTable: Add parent_id and reply_to_name to post_comments for 1-level indented replies
ALTER TABLE "post_comments"
  ADD COLUMN IF NOT EXISTS "parent_id" UUID,
  ADD COLUMN IF NOT EXISTS "reply_to_name" VARCHAR(150);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_parent_id_fkey'
  ) THEN
    ALTER TABLE "post_comments"
      ADD CONSTRAINT "post_comments_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "post_comments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_comments_parent_id_idx" ON "post_comments"("parent_id");
