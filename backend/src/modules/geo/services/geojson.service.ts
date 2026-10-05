import { Injectable } from '@nestjs/common';
import {
  PlaceGeoInput,
  GeoJsonPointFeature,
  GeoJsonFeatureCollection,
} from '../interfaces/geo.interface';

@Injectable()
export class GeoJsonService {
  /**
   * Kiểm tra tọa độ có hợp lệ trên Trái Đất và trong lãnh thổ Việt Nam
   */
  isValidCoordinate(lat: number, lng: number): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;

    // Phạm vi toàn cầu
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

    // Phạm vi Việt Nam (khoảng lat: 8.0 - 24.0, lng: 102.0 - 111.0)
    return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 111.0;
  }

  /**
   * Đóng gói danh sách địa điểm thành GeoJSON FeatureCollection chuẩn RFC 7946 (Type-safe, no any)
   */
  buildFeatureCollection(
    places: PlaceGeoInput[],
    metadata: Record<string, unknown> = {},
  ): GeoJsonFeatureCollection {
    const features: GeoJsonPointFeature[] = [];

    for (const place of places) {
      if (this.isValidCoordinate(place.latitude, place.longitude)) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [place.longitude, place.latitude], // Chuẩn RFC 7946: [lng, lat]
          },
          properties: {
            id: place.id,
            name: place.name,
            address: place.addressNormalized || place.address,
            ratingAvg: place.ratingAvg ?? 0,
            reviewCount: place.reviewCount ?? 0,
            priceLevel: place.priceLevel,
            category: place.category,
            area: place.area,
            distanceMeters: place.distanceMeters,
          },
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        total: features.length,
        ...metadata,
      },
    };
  }
}
