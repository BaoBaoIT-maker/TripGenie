/**
 * Interface & Types cho hệ thống GeoModule (Chuẩn SOLID & Type-Safe)
 */

export interface PlaceCategorySummary {
  id: number;
  name: string;
}

export interface PlaceAreaSummary {
  id: number;
  name: string;
}

/**
 * Kiểu dữ liệu đầu vào cho việc đóng gói GeoJSON (không dùng any)
 */
export interface PlaceGeoInput {
  id: string;
  name: string;
  address: string;
  addressNormalized?: string | null;
  latitude: number;
  longitude: number;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  priceLevel?: string | null;
  category?: PlaceCategorySummary | null;
  area?: PlaceAreaSummary | null;
  distanceMeters?: number | null;
}

export interface GeoJsonPointGeometry {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat] chuẩn RFC 7946
}

export interface GeoJsonPointFeature {
  type: 'Feature';
  geometry: GeoJsonPointGeometry;
  properties: {
    id: string;
    name: string;
    address: string;
    ratingAvg: number;
    reviewCount: number;
    priceLevel?: string | null;
    category?: PlaceCategorySummary | null;
    area?: PlaceAreaSummary | null;
    distanceMeters?: number | null;
    [key: string]: unknown;
  };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonPointFeature[];
  metadata?: {
    total: number;
    center?: [number, number];
    radiusMeters?: number;
    [key: string]: unknown;
  };
}
