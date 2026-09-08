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
    @Inject(INJECT_TOKENS.FOURSQUARE_PROVIDER)
    private readonly foursquareProvider: IEnrichmentProvider,
    @Inject(INJECT_TOKENS.WIKIMEDIA_PROVIDER)
    private readonly wikimediaProvider: IEnrichmentProvider,
  ) {}

  /**
   * Enriches a single place by ID using Foursquare and Wikimedia providers.
   * Safe Partial Update: Only updates non-null fields retrieved from providers.
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
   * Enriches batch of unenriched places within a travel area.
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
    this.logger.log(`Enriching place "${place.name}" (${place.id})`);

    const updatePayload: Record<string, any> = {};

    // 1. Try Wikimedia for photos & descriptions (ideal for landmarks/tourist spots)
    const wikiDetails = await this.wikimediaProvider.enrichPlace(
      place.name,
      place.latitude,
      place.longitude,
      place.wikidata,
    );

    if (wikiDetails) {
      if (wikiDetails.description && !place.description) {
        updatePayload.description = wikiDetails.description;
      }
    }

    // 2. Try Foursquare for ratings, price level, opening hours, contact & photos
    const fsqDetails = await this.foursquareProvider.enrichPlace(
      place.name,
      place.latitude,
      place.longitude,
    );

    if (fsqDetails) {
      if (typeof fsqDetails.ratingAvg === 'number' && place.ratingAvg === null) {
        updatePayload.ratingAvg = fsqDetails.ratingAvg;
      }
      if (typeof fsqDetails.ratingCount === 'number') {
        updatePayload.ratingCount = fsqDetails.ratingCount;
      }
      if (typeof fsqDetails.priceLevel === 'number' && place.priceLevel === null) {
        updatePayload.priceLevel = fsqDetails.priceLevel;
      }
      if (fsqDetails.openingHours && !place.openingHours) {
        updatePayload.openingHours = fsqDetails.openingHours;
      }
      if (fsqDetails.phone && !place.phone) {
        updatePayload.phone = fsqDetails.phone;
      }
      if (fsqDetails.website && !place.website) {
        updatePayload.website = fsqDetails.website;
      }
    }

    // If any enrichments were found, safely apply partial update to DB
    if (Object.keys(updatePayload).length > 0) {
      await this.crawlerRepo.updatePlace(place.id, updatePayload);
      this.logger.log(`Successfully enriched place "${place.name}" with fields: ${Object.keys(updatePayload).join(', ')}`);
      return true;
    }

    this.logger.debug(`No additional enrichment found for "${place.name}"`);
    return false;
  }
}
