/**
 * Interface representing enriched place details returned from external enrichment providers
 * (such as Foursquare Places API or Wikimedia REST API).
 */
export interface EnrichedPlaceDetails {
  ratingAvg?: number | null;
  ratingCount?: number | null;
  priceLevel?: number | null;
  openingHours?: Record<string, any> | string | null;
  phone?: string | null;
  website?: string | null;
  photoUrls?: string[] | null;
  description?: string | null;
}

/**
 * Strategy contract for Place Data Enrichment Providers.
 */
export interface IEnrichmentProvider {
  /**
   * Search and return enriched details for a place given its name and GPS coordinates.
   */
  enrichPlace(name: string, lat: number, lng: number, wikidataId?: string | null): Promise<EnrichedPlaceDetails | null>;
}
