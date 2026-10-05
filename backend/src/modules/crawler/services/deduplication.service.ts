import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { ICrawlerRepository } from '../interfaces/crawler-repository.interface';
import { NormalizedPlace } from '../interfaces/provider.interface';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  private readonly radiusMeters: number;

  constructor(
    @Inject(INJECT_TOKENS.CRAWLER_REPOSITORY)
    private readonly crawlerRepo: ICrawlerRepository,
    private readonly configService: ConfigService,
  ) {
    // Configurable via env: DEDUP_RADIUS_METERS (default 50m)
    this.radiusMeters = this.configService.get<number>('DEDUP_RADIUS_METERS', 50);
  }

  /**
   * Checks if a crawled place already exists in our database.
   *
   * Strategy (2-step):
   *  1. Exact provider+externalId match in place_sources — O(1) lookup
   *  2. Spatial proximity (within radiusMeters) + normalized name substring match
   *
   * @returns existing placeId if duplicate found, null otherwise
   */
  async findDuplicate(place: NormalizedPlace): Promise<string | null> {
    // Step 1: Exact source match
    const existingSource = await this.crawlerRepo.findPlaceSourceByExternal(
      place.provider,
      place.externalId,
    );
    if (existingSource) {
      return existingSource.placeId as string;
    }

    // Step 2: Spatial + lexical match
    const nearbyPlaces = await this.crawlerRepo.findNearbyPlaces(
      place.latitude,
      place.longitude,
      this.radiusMeters,
    );

    for (const nearby of nearbyPlaces) {
      if (this.isSimilarName(place.nameNormalized, nearby.name_normalized as string)) {
        this.logger.debug(
          `Duplicate detected via spatial+lexical: "${place.name}" ≈ "${nearby.name}"`,
        );
        return nearby.id as string;
      }
    }

    return null;
  }

  /**
   * Simple similarity check: exact match or one contains the other.
   * Future improvement: replace with Jaccard coefficient or delegate to pg_trgm similarity().
   */
  private isSimilarName(a: string, b: string): boolean {
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }
}
