import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ICrawlerProvider, NormalizedPlace, OsmNode } from '../interfaces/provider.interface';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const unorm = require('unorm') as typeof import('unorm');

@Injectable()
export class OsmProvider implements ICrawlerProvider {
  private readonly logger = new Logger(OsmProvider.name);
  private readonly overpassUrl = 'https://overpass-api.de/api/interpreter';

  async fetchByBbox(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    categories: string[] = [],
  ): Promise<NormalizedPlace[]> {
    this.logger.log(`Fetching OSM data for bbox [${minLat}, ${minLng}, ${maxLat}, ${maxLng}]`);
    
    // Build query. Simplified for now to fetch basic tourist amenities
    // Normally we map internal categories to OSM tags.
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|bar|pub"](${minLat},${minLng},${maxLat},${maxLng});
        node["tourism"~"hotel|museum|attraction|viewpoint"](${minLat},${minLng},${maxLat},${maxLng});
        node["historic"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
    `;

    try {
      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
      });

      const elements = response.data.elements || [];
      this.logger.log(`Received ${elements.length} raw elements from OSM`);

      const results: NormalizedPlace[] = [];
      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue; // Skip nameless places

        const categorySlug = this.mapOsmTagsToCategory(el.tags);
        if (!categorySlug) continue;

        results.push({
          externalId: el.id.toString(),
          provider: 'osm',
          name: el.tags.name,
          nameNormalized: this.normalizeString(el.tags.name),
          latitude: el.lat,
          longitude: el.lon,
          address: this.formatAddress(el.tags),
          description: el.tags.description || null,
          categorySlug,
          tags: this.extractTags(el.tags),
          sourceData: el,
        });
      }

      return results;
    } catch (error) {
      this.logger.error(`Error fetching from Overpass API: ${error.message}`);
      throw error;
    }
  }

  private mapOsmTagsToCategory(tags: Record<string, string>): string | null {
    if (tags.amenity === 'restaurant') return 'nha-hang';
    if (tags.amenity === 'cafe') return 'ca-phe';
    if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar-pub';
    if (tags.tourism === 'hotel' || tags.tourism === 'hostel') return 'khach-san';
    if (tags.tourism === 'museum' || tags.tourism === 'attraction') return 'diem-tham-quan';
    if (tags.historic) return 'di-tich';
    return null; // Ignore others
  }

  private normalizeString(str: string): string {
    return unorm
      .nfd(str)
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatAddress(tags: Record<string, string>): string | null {
    const parts = [];
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private extractTags(osmTags: Record<string, string>): string[] {
    const tags = [];
    if (osmTags.cuisine) {
      tags.push(...osmTags.cuisine.split(';').map((t) => t.trim().toLowerCase()));
    }
    return tags;
  }
}
