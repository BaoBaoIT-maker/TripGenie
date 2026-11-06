import { Inject, Injectable, Logger } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { IEnrichmentProvider, EnrichedPlaceDetails } from '../interfaces/enrichment-provider.interface';

@Injectable()
export class PlaceEnrichmentService {
  private readonly logger = new Logger(PlaceEnrichmentService.name);

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    @Inject(INJECT_TOKENS.ENRICHMENT_PROVIDERS)
    private readonly providers: IEnrichmentProvider[],
  ) {}

  /**
   * Enriches a single place by ID using configured enrichment providers.
   * Safe Partial Update: Only updates missing or non-null fields retrieved from providers.
   */
  async enrichPlaceById(placeId: string): Promise<boolean> {
    const place = await this.crawlerRepo.getPlaceById(placeId);
    if (!place) {
      this.logger.warn(`Place ${placeId} not found for enrichment`);
      return false;
    }

    return this.enrichSinglePlace(place);
  }

  /**
   * Enriches a batch of unenriched places within a travel area.
   */
  async enrichPlacesByArea(areaId: number, limit: number = 50): Promise<{ processed: number; enriched: number }> {
    const places = await this.crawlerRepo.getUnenrichedPlacesByArea(areaId, limit);
    this.logger.log(`Found ${places.length} unenriched places in area ${areaId}`);

    let enrichedCount = 0;
    for (const place of places) {
      const success = await this.enrichSinglePlace(place);
      if (success) enrichedCount++;
    }

    return { processed: places.length, enriched: enrichedCount };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async enrichSinglePlace(place: any): Promise<boolean> {
    this.logger.log(`Enriching place "${place.name}" (${place.id}) with ${this.providers.length} provider(s)`);

    const updatePayload: Record<string, any> = {};
    const wikidataId = this.extractWikidataId(place);
    let totalNewImages = 0;
    let modified = false;

    // Chain of Responsibility: Iterate through all registered enrichment providers
    for (const provider of this.providers) {
      try {
        const details: EnrichedPlaceDetails | null = await provider.enrichPlace(
          place.name,
          place.latitude,
          place.longitude,
          wikidataId,
        );

        if (!details) continue;

        // 1. Description (if missing)
        if (details.description && !place.description && !updatePayload.description) {
          updatePayload.description = details.description;
          modified = true;
        }

        // 2. Rating & Review Count (if missing or 0)
        if (typeof details.ratingAvg === 'number' && (place.ratingAvg === 0 || place.ratingAvg === null)) {
          updatePayload.ratingAvg = details.ratingAvg;
          modified = true;
        }
        if (typeof details.reviewCount === 'number' && !updatePayload.reviewCount) {
          updatePayload.reviewCount = details.reviewCount;
          modified = true;
        }

        // 3. Price Level (Enum BudgetLevel: LOW, MEDIUM, HIGH, LUXURY)
        if (details.budgetLevel && !place.priceLevel && !updatePayload.priceLevel) {
          updatePayload.priceLevel = details.budgetLevel;
          modified = true;
        }

        // 4. Opening hours
        if (details.openingHours && !place.openingHours && !updatePayload.openingHours) {
          updatePayload.openingHours = details.openingHours;
          modified = true;
        }

        // 5. Contact info (phone & website)
        if (details.phone && !place.phone && !updatePayload.phone) {
          updatePayload.phone = details.phone;
          modified = true;
        }
        if (details.website && !place.website && !updatePayload.website) {
          updatePayload.website = details.website;
          modified = true;
        }

        // 6. Save image URLs to place_images table
        if (details.photoUrls && details.photoUrls.length > 0) {
          const added = await this.crawlerRepo.createPlaceImages(
            place.id,
            details.photoUrls,
            provider.providerName || 'enrichment',
          );
          if (added > 0) {
            totalNewImages += added;
            modified = true;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Provider "${provider.providerName}" failed for place "${place.name}": ${msg}`);
      }
    }

    // Apply partial update to DB if any fields were updated
    if (Object.keys(updatePayload).length > 0) {
      await this.crawlerRepo.updatePlace(place.id, updatePayload);
    }

    if (modified) {
      this.logger.log(`Successfully enriched "${place.name}" (Updated fields: ${Object.keys(updatePayload).join(', ')}, New images: ${totalNewImages})`);
      return true;
    }

    this.logger.debug(`No enrichment data found for "${place.name}"`);
    return false;
  }

  private extractWikidataId(place: any): string | null {
    if (place.wikidata) return place.wikidata;
    if (Array.isArray(place.sources)) {
      for (const source of place.sources) {
        const raw = source.rawData || {};
        const tags = raw.tags || {};
        if (tags.wikidata) return tags.wikidata;
        if (raw.wikidata) return raw.wikidata;
      }
    }
    return null;
  }
}
