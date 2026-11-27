-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "banned_word_action_enum" AS ENUM ('BLOCK', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: add action column (BLOCK = Tier 1 sync block, REVIEW = Tier 2 async AI/Admin review)
ALTER TABLE "banned_words"
  ADD COLUMN IF NOT EXISTS "action" "banned_word_action_enum" NOT NULL DEFAULT 'BLOCK';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "banned_words_action_idx" ON "banned_words"("action");
