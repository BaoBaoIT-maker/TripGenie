import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { BudgetLevel } from '@prisma/client';
import { IEnrichmentProvider, EnrichedPlaceDetails } from '../interfaces/enrichment-provider.interface';

@Injectable()
export class FoursquareProvider implements IEnrichmentProvider {
  readonly providerName = 'foursquare';
  private readonly logger = new Logger(FoursquareProvider.name);
  private readonly apiKey: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FOURSQUARE_API_KEY', '');
    this.httpClient = axios.create({
      baseURL: 'https://api.foursquare.com/v3/places',
      timeout: 10_000,
    });
  }

  async enrichPlace(name: string, lat: number, lng: number): Promise<EnrichedPlaceDetails | null> {
    if (!this.apiKey) {
      this.logger.debug('FOURSQUARE_API_KEY not configured — skipping Foursquare enrichment');
      return null;
    }

    try {
      // 1. Search for matching place near GPS coordinate
      const searchRes = await this.httpClient.get('/search', {
        headers: { Authorization: this.apiKey, Accept: 'application/json' },
        params: {
          ll: `${lat},${lng}`,
          query: name,
          radius: 200, // Search within 200m
          limit: 1,
        },
      });

      const results = searchRes.data?.results;
      if (!results || results.length === 0) {
        this.logger.debug(`No Foursquare match found for "${name}" at [${lat}, ${lng}]`);
        return null;
      }

      const fsqId = results[0].fsq_id;

      // 2. Fetch rich place details (rating, stats, price, hours, tel, website, photos)
      const detailsRes = await this.httpClient.get(`/${fsqId}`, {
        headers: { Authorization: this.apiKey, Accept: 'application/json' },
        params: {
          fields: 'rating,stats,price,hours,tel,website,photos',
        },
      });

      const data = detailsRes.data;
      return this.formatFoursquareDetails(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Foursquare API error for "${name}": ${message}`);
      return null; // Graceful degradation
    }
  }

  private formatFoursquareDetails(data: any): EnrichedPlaceDetails {
    const photoUrls: string[] = [];
    if (Array.isArray(data.photos)) {
      for (const photo of data.photos) {
        if (photo.prefix && photo.suffix) {
          // Construct original resolution image URL
          photoUrls.push(`${photo.prefix}original${photo.suffix}`);
        }
      }
    }

    // Convert Foursquare 0-10 rating to 0-5 scale
    const ratingAvg = typeof data.rating === 'number' ? Number((data.rating / 2).toFixed(1)) : null;
    const reviewCount = typeof data.stats?.total_ratings === 'number' ? data.stats.total_ratings : null;
    const budgetLevel = this.mapPriceToBudgetLevel(data.price);

    return {
      ratingAvg,
      reviewCount,
      budgetLevel,
      openingHours: data.hours || null,
      phone: data.tel || null,
      website: data.website || null,
      photoUrls: photoUrls.length > 0 ? photoUrls : null,
      sourceName: this.providerName,
    };
  }

  private mapPriceToBudgetLevel(price: any): BudgetLevel | null {
    if (typeof price !== 'number') return null;
    switch (price) {
      case 1:
        return BudgetLevel.LOW;
      case 2:
        return BudgetLevel.MEDIUM;
      case 3:
        return BudgetLevel.HIGH;
      case 4:
        return BudgetLevel.LUXURY;
      default:
        return null;
    }
  }
}
