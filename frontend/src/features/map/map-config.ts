import type { MapCoordinate, MapRadiusKm } from "./types";

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const satisfies readonly MapRadiusKm[];
export const DEFAULT_MAP_CENTER: MapCoordinate = { latitude: 10.7769, longitude: 106.7009 };
export const DEFAULT_MAP_ZOOM = 12;

export const CITY_CENTERS: Record<string, MapCoordinate> = {
  "TP. Hồ Chí Minh": DEFAULT_MAP_CENTER,
  "Đà Lạt": { latitude: 11.9404, longitude: 108.4583 },
  "Ninh Bình": { latitude: 20.2506, longitude: 105.9745 },
  "Phú Quốc": { latitude: 10.227, longitude: 103.967 },
};
