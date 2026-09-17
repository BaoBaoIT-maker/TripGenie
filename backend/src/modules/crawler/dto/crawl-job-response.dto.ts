/** Response DTO for POST /crawler/trigger */
export class TriggerCrawlResponseDto {
  message: string;
  jobId: string;
  area: string;
}

/** Response DTO for GET /crawler/jobs/:id */
export class CrawlJobStatusDto {
  id: string;
  status: string;
  jobType: string;
  provider: string | null;
  totalItems: number | null;
  processedItems: number;
  insertedCount: number;
  updatedCount: number;
  duplicateCount: number;
  errorCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
}
