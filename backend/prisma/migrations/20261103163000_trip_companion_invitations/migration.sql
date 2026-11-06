-- 1. CreateEnum TripInvitationStatus
CREATE TYPE "trip_invitation_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- 2. AlterEnum NotificationType (add trip invitation notification types)
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'TRIP_INVITED';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'TRIP_INVITATION_ACCEPTED';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'TRIP_INVITATION_DECLINED';

-- 3. CreateTable trip_invitations
CREATE TABLE "trip_invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "trip_group_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" "trip_invitation_status_enum" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "responded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_invitations_pkey" PRIMARY KEY ("id")
);

-- 4. CreateIndexes for trip_invitations
CREATE INDEX "trip_invitations_invitee_id_status_created_at_idx" ON "trip_invitations"("invitee_id", "status", "created_at");
CREATE INDEX "trip_invitations_trip_group_id_status_idx" ON "trip_invitations"("trip_group_id", "status");

-- Partial unique index ensuring at most one PENDING invitation per (trip_group, invitee)
CREATE UNIQUE INDEX "unique_pending_trip_invitation" ON "trip_invitations"("trip_group_id", "invitee_id") WHERE "status" = 'PENDING';

-- 5. Foreign keys for trip_invitations
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_trip_group_id_fkey" FOREIGN KEY ("trip_group_id") REFERENCES "trip_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Alter notifications table to support trip invitation targets
ALTER TABLE "notifications" ALTER COLUMN "post_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "itinerary_id" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "invitation_id" UUID;

CREATE INDEX IF NOT EXISTS "notifications_itinerary_id_idx" ON "notifications"("itinerary_id");
CREATE INDEX IF NOT EXISTS "notifications_invitation_id_idx" ON "notifications"("invitation_id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "trip_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
