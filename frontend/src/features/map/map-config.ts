import type { MapCoordinate, RadiusKm } from "./types";

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const satisfies readonly RadiusKm[];
export const DEFAULT_MAP_CENTER: MapCoordinate = { latitude: 16.0544, longitude: 108.2022 };
export const DEFAULT_MAP_ZOOM = 13;

// Domain Constants for Navigation, Directions & Map Framing
export const MAX_NEARBY_PROXIMITY_KM = 20; // Maximum distance to consider user's device GPS local to the destination province
export const MIN_ROUTE_DISTANCE_KM = 0.5; // Threshold distance below which fallback origin is offset to prevent identical A-B points
export const ROUTE_ORIGIN_FALLBACK_OFFSET_DEG = 0.015; // Latitude offset (~1.65km) to generate a realistic local origin
export const MAX_ROUTE_FIT_ZOOM = 16; // Maximum camera zoom clamp for route framing to prevent canvas blackouts
export const DANANG_GSO_PROVINCE_CODE = "48"; // GSO code for Da Nang whose maritime islands skew arithmetic bounding box centroid

// Route Stop Identity Constants (No magic strings)
export const ROUTE_STOP_ID_USER_LOCATION = "user-location";
export const ROUTE_STOP_ID_AREA_CENTER = "area-center-origin";
export const USER_LOCATION_STOP_LABEL = "Vị trí của bạn";
