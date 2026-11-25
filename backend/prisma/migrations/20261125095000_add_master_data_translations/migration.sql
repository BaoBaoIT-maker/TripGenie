-- Batch 1: Multi-language JSONB translations for master/reference tables
-- Non-breaking: keeps existing name / name_vi columns intact as defaults/fallbacks.

ALTER TABLE "travel_areas"
  ADD COLUMN IF NOT EXISTS "translations" JSONB;

ALTER TABLE "transit_hubs"
  ADD COLUMN IF NOT EXISTS "translations" JSONB;

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "translations" JSONB;

-- Backfill existing English/Vietnamese labels into translations JSONB without overwriting future locales
UPDATE "travel_areas"
SET "translations" = jsonb_strip_nulls(
  COALESCE("translations", '{}'::jsonb) ||
  jsonb_build_object(
    'en', COALESCE("translations"->>'en', "name"),
    'vi', COALESCE("translations"->>'vi', "name_vi", "name")
  )
)
WHERE "translations" IS NULL OR NOT ("translations" ? 'en') OR NOT ("translations" ? 'vi');

UPDATE "categories"
SET "translations" = jsonb_strip_nulls(
  COALESCE("translations", '{}'::jsonb) ||
  jsonb_build_object(
    'en', COALESCE("translations"->>'en', "name"),
    'vi', COALESCE("translations"->>'vi', "name_vi", "name")
  )
)
WHERE "translations" IS NULL OR NOT ("translations" ? 'en') OR NOT ("translations" ? 'vi');
