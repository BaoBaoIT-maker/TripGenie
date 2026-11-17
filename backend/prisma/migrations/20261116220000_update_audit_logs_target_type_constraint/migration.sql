-- Update chk_audit_target_type constraint to support all administrative audit targets
-- and allow case-insensitive target types (user, place, review, crawl_job, itinerary,
-- community_post, post_comment, community_group, content_report, travel_area, system_setting)
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "chk_audit_target_type";

ALTER TABLE "audit_logs" ADD CONSTRAINT "chk_audit_target_type" CHECK (
  lower("target_type") IN (
    'place',
    'review',
    'user',
    'crawl_job',
    'itinerary',
    'community_post',
    'post_comment',
    'community_group',
    'content_report',
    'travel_area',
    'system_setting'
  )
);
