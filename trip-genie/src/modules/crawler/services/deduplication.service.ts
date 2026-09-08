import { Inject, Injectable, Logger } from '@nestjs/common';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { NormalizedPlace } from '../interfaces/provider.interface';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  private readonly RADIUS_METERS = 50; // Threshold for spatial deduplication

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
  ) {}

  /**
   * Checks if a crawled place already exists in our database.
   * Logic:
   * 1. Check if exactly same provider + externalId exists in place_sources (100% match)
   * 2. Spatial + Lexical check: Find places within 50m, check if normalized names match closely.
   */
  async findDuplicate(place: NormalizedPlace): Promise<string | null> {
    // 1. Exact Source Match
    const existingSource = await this.crawlerRepo.findPlaceSourceByExternal(
      place.provider,
      place.externalId,
    );
    if (existingSource) {
      return existingSource.placeId; // Already exists
    }

    // 2. Spatial + Lexical Match
    const nearbyPlaces = await this.crawlerRepo.findNearbyPlaces(
      place.latitude,
      place.longitude,
      this.RADIUS_METERS,
    );

    for (const nearby of nearbyPlaces) {
      if (this.isNameMatch(place.nameNormalized, nearby.name_normalized)) {
        this.logger.debug(`Found duplicate via spatial+lexical: ${place.name} == ${nearby.name}`);
        return nearby.id;
      }
    }

    return null; // Is a brand new place
  }

  private isNameMatch(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    
    // Very simple fuzzy match for now: substring or exact
    // Ideally use pg_trgm similarity > 0.6 in DB query directly
    return name1 === name2 || name1.includes(name2) || name2.includes(name1);
  }
}
