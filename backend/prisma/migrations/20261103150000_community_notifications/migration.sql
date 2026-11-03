-- CreateEnum
CREATE TYPE "notification_type_enum" AS ENUM ('POST_LIKED', 'POST_COMMENTED', 'COMMENT_REPLIED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recipient_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "notification_type_enum" NOT NULL,
    "post_id" UUID NOT NULL,
    "comment_id" UUID,
    "event_key" VARCHAR(128) NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_id_event_key_key" ON "notifications"("recipient_id", "event_key");
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at", "id");
CREATE INDEX "notifications_recipient_id_read_at_created_at_id_idx" ON "notifications"("recipient_id", "read_at", "created_at", "id");
CREATE INDEX "notifications_post_id_idx" ON "notifications"("post_id");
CREATE INDEX "notifications_comment_id_idx" ON "notifications"("comment_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
