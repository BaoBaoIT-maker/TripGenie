import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IEnrichmentProvider, EnrichedPlaceDetails } from '../interfaces/enrichment-provider.interface';

@Injectable()
export class WikimediaProvider implements IEnrichmentProvider {
  readonly providerName = 'wikimedia';
  private readonly logger = new Logger(WikimediaProvider.name);
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: 'https://vi.wikipedia.org/api/rest_v1/page/summary',
      timeout: 8_000,
      headers: {
        'User-Agent': 'TripGenieBot/1.0 (https://tripgenie.app; contact@tripgenie.app)',
      },
    });
  }

  async enrichPlace(
    name: string,
    lat: number,
    lng: number,
    wikidataId?: string | null,
  ): Promise<EnrichedPlaceDetails | null> {
    try {
      // Priority search term: wikidataId (if available) or cleaned name
      const searchTerm = wikidataId ? wikidataId.trim() : name.trim();
      const encodedTitle = encodeURIComponent(searchTerm.replace(/\s+/g, '_'));

      const response = await this.httpClient.get(`/${encodedTitle}`);
      const data = response.data;

      if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
        return null;
      }

      const photoUrls: string[] = [];
      if (data.originalimage?.source) {
        photoUrls.push(data.originalimage.source);
      } else if (data.thumbnail?.source) {
        photoUrls.push(data.thumbnail.source);
      }

      const description = data.extract || data.description || null;

      if (photoUrls.length === 0 && !description) {
        return null;
      }

      return {
        photoUrls: photoUrls.length > 0 ? photoUrls : null,
        description,
        sourceName: this.providerName,
      };
    } catch (error) {
      // Wikimedia returns 404 for non-existent page titles — expected and non-fatal
      return null;
    }
  }
}
