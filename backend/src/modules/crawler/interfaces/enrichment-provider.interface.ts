import { BudgetLevel } from '@prisma/client';

/**
 * Interface representing enriched place details returned from external enrichment providers
 * (such as Foursquare Places API or Wikimedia REST API).
 */
export interface EnrichedPlaceDetails {
  ratingAvg?: number | null;
  reviewCount?: number | null;
  budgetLevel?: BudgetLevel | null;
  openingHours?: Record<string, any> | string | null;
  phone?: string | null;
  website?: string | null;
  photoUrls?: string[] | null;
  description?: string | null;
  sourceName?: string;
}

/**
 * Strategy contract for Place Data Enrichment Providers.
 */
export interface IEnrichmentProvider {
  readonly providerName: string;

  /**
   * Search and return enriched details for a place given its name, GPS coordinates, and optional wikidataId.
   */
  enrichPlace(name: string, lat: number, lng: number, wikidataId?: string | null): Promise<EnrichedPlaceDetails | null>;
}
