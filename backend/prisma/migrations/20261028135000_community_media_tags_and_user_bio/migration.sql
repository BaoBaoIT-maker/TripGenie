-- AlterTable: Add bio to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" VARCHAR(300);

-- AlterTable: Add media_urls, tags, and make itinerary_id nullable on community_posts
ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "itinerary_id" DROP NOT NULL;

-- Drop unique constraint/index on itinerary_id so multiple posts can share or omit an itinerary
ALTER TABLE "community_posts" DROP CONSTRAINT IF EXISTS "community_posts_itinerary_id_key";
DROP INDEX IF EXISTS "community_posts_itinerary_id_key";

-- Update foreign key onDelete behavior to SET NULL for itinerary_id
ALTER TABLE "community_posts" DROP CONSTRAINT IF EXISTS "community_posts_itinerary_id_fkey";
ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_itinerary_id_fkey"
  FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index on itinerary_id
CREATE INDEX IF NOT EXISTS "community_posts_itinerary_id_idx" ON "community_posts"("itinerary_id");
