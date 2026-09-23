/**
 * Interface & Types cho hệ thống GeoModule (Chuẩn SOLID & Type-Safe)
 */

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

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

export interface GeoJsonLineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [[lng, lat], ...]
}

export interface GeoJsonLineStringFeature {
  type: 'Feature';
  geometry: GeoJsonLineStringGeometry;
  properties: {
    distanceMeters: number;
    durationSeconds: number;
    travelMode: string;
    [key: string]: unknown;
  };
}

export interface OsmElementRaw {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

export interface ParsedOsmPlace {
  name: string;
  latitude: number;
  longitude: number;
  addressRaw: string;
  phone?: string;
  website?: string;
  openingHours?: { raw: string } | null;
  tags: string[];
  osmType: string;
  osmId: number;
}

export interface IAddressNormalizerService {
  normalize(rawAddress: string): string;
  removeAccents(str: string): string;
}

export interface IGeoJsonService {
  isValidCoordinate(lat: number, lng: number): boolean;
  buildFeatureCollection(places: PlaceGeoInput[], metadata?: Record<string, unknown>): GeoJsonFeatureCollection;
  buildRouteFeature(coordinates: [number, number][], properties?: Record<string, unknown>): GeoJsonLineStringFeature;
  parseOsmElement(element: OsmElementRaw): ParsedOsmPlace | null;
}

export interface IOverpassProvider {
  queryPlacesInBBox(bbox: BoundingBox, limit?: number): Promise<OsmElementRaw[]>;
}
