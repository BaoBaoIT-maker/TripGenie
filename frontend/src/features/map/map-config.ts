import type { MapCoordinate, RadiusKm } from "./types";

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const satisfies readonly RadiusKm[];
export const DEFAULT_MAP_CENTER: MapCoordinate = { latitude: 16.0544, longitude: 108.2022 };
export const DEFAULT_MAP_ZOOM = 13;

export const AREA_CENTERS: Record<string, MapCoordinate> = {
  "da-nang": DEFAULT_MAP_CENTER,
  "hoi-an": { latitude: 15.8801, longitude: 108.338 },
  "tp-ho-chi-minh": { latitude: 10.7769, longitude: 106.7009 },
  "da-lat": { latitude: 11.9404, longitude: 108.4583 },
  "ninh-binh": { latitude: 20.2506, longitude: 105.9745 },
  "phu-quoc": { latitude: 10.227, longitude: 103.967 },
};

// Backwards compatibility
export const CITY_CENTERS: Record<string, MapCoordinate> = {
  "Đà Nẵng": DEFAULT_MAP_CENTER,
  "Hội An": { latitude: 15.8801, longitude: 108.338 },
  "TP. Hồ Chí Minh": { latitude: 10.7769, longitude: 106.7009 },
  "Đà Lạt": { latitude: 11.9404, longitude: 108.4583 },
  "Ninh Bình": { latitude: 20.2506, longitude: 105.9745 },
  "Phú Quốc": { latitude: 10.227, longitude: 103.967 },
};
