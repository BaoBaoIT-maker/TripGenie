-- Restore the proposal lifecycle required by the following v2 migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_status_enum') THEN
    CREATE TYPE "proposal_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "group_place_proposals"
  ADD COLUMN IF NOT EXISTS "status" "proposal_status_enum" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "destination_id" UUID;

CREATE INDEX IF NOT EXISTS "group_place_proposals_trip_group_id_status_idx"
  ON "group_place_proposals"("trip_group_id", "status");
