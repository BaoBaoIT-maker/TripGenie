import { Injectable, Logger } from '@nestjs/common';
import {
  IGeoJsonService,
  PlaceGeoInput,
  GeoJsonPointFeature,
  GeoJsonFeatureCollection,
  GeoJsonLineStringFeature,
  OsmElementRaw,
  ParsedOsmPlace,
} from '../interfaces/geo.interface';

@Injectable()
export class GeoJsonService implements IGeoJsonService {
  private readonly logger = new Logger(GeoJsonService.name);

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

  /**
   * Đóng gói tuyến đường thành GeoJSON LineString Feature
   */
  buildRouteFeature(
    coordinates: [number, number][],
    properties: Record<string, unknown> = {},
  ): GeoJsonLineStringFeature {
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        distanceMeters: typeof properties.distanceMeters === 'number' ? properties.distanceMeters : 0,
        durationSeconds: typeof properties.durationSeconds === 'number' ? properties.durationSeconds : 0,
        travelMode: typeof properties.travelMode === 'string' ? properties.travelMode : 'driving',
        ...properties,
      },
    };
  }

  /**
   * Parse thông tin thô từ một node/way của OpenStreetMap (Overpass API)
   */
  parseOsmElement(element: OsmElementRaw): ParsedOsmPlace | null {
    const tags = element.tags || {};
    const name = tags.name || tags['name:vi'] || tags['name:en'];
    if (!name) return null;

    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined || !this.isValidCoordinate(lat, lon)) {
      return null;
    }

    // Tạo chuỗi địa chỉ từ tags của OSM
    const street = tags['addr:street'] || '';
    const housenumber = tags['addr:housenumber'] || '';
    const suburb = tags['addr:suburb'] || tags['addr:district'] || '';
    const city = tags['addr:city'] || tags['addr:province'] || '';

    const addressParts: string[] = [];
    if (housenumber && street) addressParts.push(`${housenumber} ${street}`);
    else if (street) addressParts.push(street);
    if (suburb) addressParts.push(suburb);
    if (city) addressParts.push(city);

    const addressRaw = addressParts.length > 0 ? addressParts.join(', ') : name;

    const placeTags: string[] = [];
    if (tags.tourism) placeTags.push(tags.tourism);
    if (tags.amenity) placeTags.push(tags.amenity);
    if (tags.historic) placeTags.push(tags.historic);
    if (tags.leisure) placeTags.push(tags.leisure);

    return {
      name: name.trim(),
      latitude: lat,
      longitude: lon,
      addressRaw,
      phone: tags.phone || tags['contact:phone'],
      website: tags.website || tags['contact:website'],
      openingHours: tags.opening_hours ? { raw: tags.opening_hours } : null,
      tags: placeTags,
      osmType: element.type,
      osmId: element.id,
    };
  }
}
