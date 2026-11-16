-- AlterTable: enrich group_place_proposals for new-stop proposals (day, start time, reason/notes)
ALTER TABLE "group_place_proposals"
  ADD COLUMN IF NOT EXISTS "day_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "proposed_start_time" VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Replace strict unique(trip_group_id, place_id) with partial unique index for PENDING proposals only,
-- preserving APPROVED / REJECTED proposal history while allowing future re-proposals of the same place.
ALTER TABLE "group_place_proposals" DROP CONSTRAINT IF EXISTS "unique_group_place_proposal";
DROP INDEX IF EXISTS "unique_group_place_proposal";

CREATE INDEX IF NOT EXISTS "group_place_proposals_trip_group_id_place_id_idx"
  ON "group_place_proposals"("trip_group_id", "place_id");

CREATE UNIQUE INDEX IF NOT EXISTS "unique_pending_group_place_proposal"
  ON "group_place_proposals"("trip_group_id", "place_id")
  WHERE "status" = 'PENDING';
