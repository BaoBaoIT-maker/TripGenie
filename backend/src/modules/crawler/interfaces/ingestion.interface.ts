/**
 * IIngestionService — Strategy Pattern abstraction for data ingestion.
 * Any new provider (PasGo, Google, etc.) must implement this interface.
 * CrawlJobService depends ONLY on this interface, not concrete implementations.
 * This satisfies DIP (Dependency Inversion Principle) and OCP (Open/Closed Principle).
 */
export interface IIngestionService {
  processArea(jobId: string, areaId: number): Promise<void>;
}
