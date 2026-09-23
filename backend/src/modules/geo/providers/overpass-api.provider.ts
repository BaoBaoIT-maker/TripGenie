import { Injectable, Logger } from '@nestjs/common';
import { IOverpassProvider, BoundingBox, OsmElementRaw } from '../interfaces/geo.interface';

@Injectable()
export class OverpassApiProvider implements IOverpassProvider {
  private readonly logger = new Logger(OverpassApiProvider.name);

  // Danh sách các Overpass endpoint công khai để fallback khi một endpoint quá tải
  private readonly OVERPASS_ENDPOINTS: ReadonlyArray<string> = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  /**
   * Xây dựng câu truy vấn Overpass QL chuẩn (Single Responsibility)
   */
  private buildQuery(bbox: BoundingBox, limit: number): string {
    const { minLat, minLng, maxLat, maxLng } = bbox;
    return `
      [out:json][timeout:45];
      (
        node["tourism"](${minLat},${minLng},${maxLat},${maxLng});
        way["tourism"](${minLat},${minLng},${maxLat},${maxLng});
        node["historic"](${minLat},${minLng},${maxLat},${maxLng});
        way["historic"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"~"restaurant|cafe"](${minLat},${minLng},${maxLat},${maxLng});
        node["leisure"~"park|water_park|resort"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out center ${limit};
    `;
  }

  /**
   * Truy vấn các địa điểm du lịch, ẩm thực, văn hóa theo Bounding Box
   */
  async queryPlacesInBBox(bbox: BoundingBox, limit: number = 300): Promise<OsmElementRaw[]> {
    const query = this.buildQuery(bbox, limit);

    for (const endpoint of this.OVERPASS_ENDPOINTS) {
      try {
        this.logger.log(`Querying Overpass API at: ${endpoint} for bbox [${bbox.minLat}, ${bbox.minLng}, ${bbox.maxLat}, ${bbox.maxLng}]`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TripGenie-Travel-Assistant/1.0',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(50000),
        });

        if (response.status === 429) {
          this.logger.warn(`Overpass endpoint ${endpoint} rate-limited (429), trying next endpoint...`);
          continue;
        }

        if (!response.ok) {
          this.logger.warn(`Overpass endpoint ${endpoint} responded with status: ${response.status}`);
          continue;
        }

        const data = (await response.json()) as { elements?: OsmElementRaw[] };
        const elements = data.elements || [];
        this.logger.log(`Overpass API returned ${elements.length} elements`);
        return elements;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Error querying Overpass endpoint ${endpoint}: ${errorMsg}`);
      }
    }

    this.logger.error('All Overpass API endpoints failed or timed out.');
    return [];
  }
}
