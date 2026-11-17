-- Rename enum ReportTargetType to report_target_type_enum to match Prisma schema mapping
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportTargetType') THEN
    ALTER TYPE "ReportTargetType" RENAME TO "report_target_type_enum";
  END IF;
END $$;

-- Drop obsolete check constraint chk_report_target_type on content_reports
-- since target_type is now strongly typed by report_target_type_enum
ALTER TABLE "content_reports" DROP CONSTRAINT IF EXISTS "chk_report_target_type";
