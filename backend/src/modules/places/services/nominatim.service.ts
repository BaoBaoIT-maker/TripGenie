import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Thin wrapper around Nominatim (OSM geocoder).
 * Free, no API key required. Rate limit: 1 req/s — adequate for user-triggered searches.
 *
 * ponytail: reuses axios (already in deps). No new dependency added.
 */
@Injectable()
export class NominatimService {
  private readonly logger = new Logger(NominatimService.name);

  private readonly http: AxiosInstance = axios.create({
    baseURL: 'https://nominatim.openstreetmap.org',
    timeout: 6000,
    headers: {
      // Nominatim ToS requires a descriptive User-Agent
      'User-Agent': 'TripGenieApp/1.0 (contact@tripgenie.app)',
      'Accept-Language': 'vi,en',
    },
  });

  /** Address string → coordinates. Returns null when Nominatim finds nothing. */
  async geocode(query: string): Promise<GeocodedLocation | null> {
    try {
      const res = await this.http.get('/search', {
        params: { q: query, format: 'json', limit: 1, countrycodes: 'vn' },
      });
      const item = res.data?.[0];
      if (!item) return null;
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name as string,
      };
    } catch (err: any) {
      this.logger.warn(`Nominatim geocode failed for "${query}": ${err.message}`);
      return null;
    }
  }

  /** Coordinates → human-readable address string. Returns null on failure. */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await this.http.get('/reverse', {
        params: { lat, lon: lng, format: 'json' },
      });
      return (res.data?.display_name as string) || null;
    } catch (err: any) {
      this.logger.warn(`Nominatim reverse geocode failed for [${lat},${lng}]: ${err.message}`);
      return null;
    }
  }
}
