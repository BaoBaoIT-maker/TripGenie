-- 1. Create PostModerationStatus enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_moderation_status_enum') THEN
    CREATE TYPE "post_moderation_status_enum" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED');
  END IF;
END $$;

-- 2. Add is_verified_creator to users (separates Email OTP verification from Creator/Thổ Địa badge)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_verified_creator" BOOLEAN NOT NULL DEFAULT false;

-- 3. Create community_groups table (Admin-managed Community Spaces + Default General Group)
CREATE TABLE IF NOT EXISTS "community_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "subtitle" VARCHAR(255),
    "description" TEXT,
    "icon_url" TEXT,
    "cover_url" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes for community_groups
CREATE UNIQUE INDEX IF NOT EXISTS "community_groups_slug_key" ON "community_groups"("slug");
CREATE INDEX IF NOT EXISTS "community_groups_is_active_sort_order_idx" ON "community_groups"("is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "community_groups_is_default_idx" ON "community_groups"("is_default");

-- 5. Foreign key for community_groups.created_by -> users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_groups_created_by_fkey'
  ) THEN
    ALTER TABLE "community_groups"
      ADD CONSTRAINT "community_groups_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Extend community_posts with group_id and AI/Admin moderation columns
ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "group_id" UUID,
  ADD COLUMN IF NOT EXISTS "moderation_status" "post_moderation_status_enum" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "moderation_note" TEXT,
  ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMPTZ;

-- 7. Foreign key for community_posts.group_id -> community_groups.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_group_id_fkey'
  ) THEN
    ALTER TABLE "community_posts"
      ADD CONSTRAINT "community_posts_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "community_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 8. Composite Indexes for community_posts and content_reports
CREATE INDEX IF NOT EXISTS "community_posts_group_id_deleted_at_created_at_idx"
  ON "community_posts"("group_id", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "community_posts_moderation_status_deleted_at_created_at_idx"
  ON "community_posts"("moderation_status", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "community_posts_deleted_at_clone_count_like_count_idx"
  ON "community_posts"("deleted_at", "clone_count" DESC, "like_count" DESC);

CREATE INDEX IF NOT EXISTS "content_reports_reported_by_target_type_target_id_idx"
  ON "content_reports"("reported_by", "target_type", "target_id");
