import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { ICrawlerProvider, NormalizedPlace } from '../interfaces/provider.interface';
import { OsmCategorySlug, CrawlProviderName } from '../../../common/enums/crawler.enum';
import { normalizeVietnamese } from '../../../common/utils/string.util';

/** Maps OSM amenity/tourism/historic tags to internal category slugs */
const OSM_TAG_TO_CATEGORY: Record<string, OsmCategorySlug> = {
  'amenity:restaurant': OsmCategorySlug.RESTAURANT,
  'amenity:cafe': OsmCategorySlug.CAFE,
  'amenity:bar': OsmCategorySlug.BAR_PUB,
  'amenity:pub': OsmCategorySlug.BAR_PUB,
  'tourism:hotel': OsmCategorySlug.HOTEL,
  'tourism:hostel': OsmCategorySlug.HOTEL,
  'tourism:museum': OsmCategorySlug.ATTRACTION,
  'tourism:attraction': OsmCategorySlug.ATTRACTION,
  'tourism:viewpoint': OsmCategorySlug.ATTRACTION,
};

@Injectable()
export class OsmProvider implements ICrawlerProvider {
  private readonly logger = new Logger(OsmProvider.name);
  private readonly overpassUrl: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.overpassUrl = this.configService.get<string>(
      'OVERPASS_API_URL',
      'https://overpass-api.de/api/interpreter',
    );
    this.httpClient = axios.create({
      timeout: 30_000, // 30 seconds — Overpass can be slow
    });
  }

  async fetchByBbox(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
  ): Promise<NormalizedPlace[]> {
    this.logger.log(`Fetching OSM data for bbox [${minLat}, ${minLng}, ${maxLat}, ${maxLng}]`);

    const query = this.buildOverpassQuery(minLat, maxLat, minLng, maxLng);

    try {
      const response = await this.httpClient.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
      });

      const elements: any[] = response.data.elements || [];
      this.logger.log(`Received ${elements.length} raw elements from OSM`);

      return elements
        .filter((el) => el.tags?.name) // Skip nameless places
        .map((el) => this.toNormalizedPlace(el))
        .filter((place): place is NormalizedPlace => place !== null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching from Overpass API: ${message}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildOverpassQuery(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
  ): string {
    const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
    return `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|bar|pub"](${bbox});
        node["tourism"~"hotel|hostel|museum|attraction|viewpoint"](${bbox});
        node["historic"](${bbox});
      );
      out body;
    `;
  }

  private toNormalizedPlace(el: any): NormalizedPlace | null {
    const categorySlug = this.mapOsmTagsToCategory(el.tags);
    if (!categorySlug) return null;

    return {
      externalId: String(el.id),
      provider: CrawlProviderName.OSM,
      name: el.tags.name as string,
      nameNormalized: normalizeVietnamese(el.tags.name as string),
      latitude: el.lat as number,
      longitude: el.lon as number,
      address: this.formatAddress(el.tags),
      description: (el.tags.description as string) || null,
      categorySlug,
      tags: this.extractTags(el.tags),
      sourceData: el,
    };
  }

  private mapOsmTagsToCategory(tags: Record<string, string>): OsmCategorySlug | null {
    if (tags.amenity) {
      const mapped = OSM_TAG_TO_CATEGORY[`amenity:${tags.amenity}`];
      if (mapped) return mapped;
    }
    if (tags.tourism) {
      const mapped = OSM_TAG_TO_CATEGORY[`tourism:${tags.tourism}`];
      if (mapped) return mapped;
    }
    if (tags.historic) return OsmCategorySlug.HISTORICAL;
    return null;
  }

  private formatAddress(tags: Record<string, string>): string | null {
    const parts: string[] = [];
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private extractTags(osmTags: Record<string, string>): string[] {
    const tags: string[] = [];
    if (osmTags.cuisine) {
      tags.push(...osmTags.cuisine.split(';').map((t) => t.trim().toLowerCase()));
    }
    return tags;
  }
}
