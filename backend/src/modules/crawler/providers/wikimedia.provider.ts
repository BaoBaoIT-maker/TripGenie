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
      let targetTitle: string | null = null;

      // 1. Priority: lookup Vietnamese or English title via Wikidata sitelinks
      if (wikidataId && wikidataId.startsWith('Q')) {
        try {
          const wdRes = await this.httpClient.get(
            `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&format=json`,
          );
          const entity = wdRes.data?.entities?.[wikidataId];
          if (entity?.sitelinks?.viwiki?.title) {
            targetTitle = entity.sitelinks.viwiki.title;
          } else if (entity?.sitelinks?.enwiki?.title) {
            targetTitle = entity.sitelinks.enwiki.title;
          }
        } catch {
          // Ignore Wikidata error, continue to search by name
        }
      }

      // 2. OpenSearch on Vietnamese Wikipedia to resolve exact page titles
      if (!targetTitle && name) {
        try {
          const searchRes = await this.httpClient.get(
            `https://vi.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name.trim())}&limit=1&namespace=0&format=json`,
          );
          const matchedTitles = searchRes.data?.[1];
          if (Array.isArray(matchedTitles) && matchedTitles.length > 0) {
            targetTitle = matchedTitles[0];
          }
        } catch {
          // Ignore OpenSearch error
        }
      }

      const searchTitle = targetTitle || name.trim();
      const encodedTitle = encodeURIComponent(searchTitle.replace(/\s+/g, '_'));

      const response = await this.httpClient.get(
        `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
      );
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

      // Fallback: Query Wikimedia Commons for high-res photo if page summary lacked an image
      if (photoUrls.length === 0 && searchTitle) {
        try {
          const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTitle + ' Da Nang')}&gsrnamespace=6&gsrlimit=2&prop=imageinfo&iiprop=url&format=json`;
          const commonsRes = await this.httpClient.get(commonsUrl);
          const pages = commonsRes.data?.query?.pages || {};
          for (const k of Object.keys(pages)) {
            const u = pages[k]?.imageinfo?.[0]?.url;
            if (u && !photoUrls.includes(u)) {
              photoUrls.push(u);
            }
          }
        } catch {
          // Ignore Commons error
        }
      }

      const description = data.extract || data.description || null;

      const validPhotoUrls = photoUrls.filter((url) =>
        /\.(jpe?g|png|webp|svg)($|\?)/i.test(url),
      );

      if (validPhotoUrls.length === 0 && !description) {
        return null;
      }

      return {
        photoUrls: validPhotoUrls.length > 0 ? validPhotoUrls : null,
        description,
        sourceName: this.providerName,
      };
    } catch {
      // Wikimedia returns 404 for non-existent page titles — expected and non-fatal
      return null;
    }
  }
}
