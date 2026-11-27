import type { ExpressionSpecification } from "maplibre-gl";
import type { TranslationKey } from "@/i18n";
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

// Tile Sources & GeoJSON Datasets
export const MAP_TILE_URLS = {
  SATELLITE:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  VIETMAP_BRIGHT_BASE: "https://maps.vietmap.vn/tm/{z}/{x}/{y}@2x.png",
  PROVINCES_GEOJSON: "/data/vietnam_34_tinhthanh.geojson",
} as const;

export const MAP_SOURCE_IDS = {
  BRIGHT: "source-bright",
  SATELLITE: "source-satellite",
  PROVINCES: "vietnam-provinces",
  ROUTE: "tripgenie-route-source",
  ITINERARY_PATH: "tripgenie-itinerary-path",
} as const;

export const MAP_LAYER_IDS = {
  BACKGROUND: "layer-background",
  BRIGHT: "layer-bright",
  SATELLITE: "layer-satellite",
  PROVINCES_FILL: "vietnam-provinces-fill",
  PROVINCES_LINE: "vietnam-provinces-line",
  ROUTE_CASING: "tripgenie-route-casing",
  ROUTE_LINE: "tripgenie-route-line",
  ITINERARY_PATH_CASING: "tripgenie-itinerary-path-line-casing",
  ITINERARY_PATH_LINE: "tripgenie-itinerary-path-line",
} as const;

export const MAP_CAMERA_CONFIG = {
  SELECTED_PLACE_ZOOM: 16,
  MOBILE_SELECTED_ZOOM: 15.5,
  USER_LOCATION_ZOOM: 15.5,
  GEOCODED_PIN_ZOOM: 15.5,
  OVERVIEW_MAX_ZOOM: 14,
  PLACES_FIT_MAX_ZOOM: 15,
  PROVINCE_FIT_MAX_ZOOM: 14,
  DESKTOP_POPUP_OFFSET_Y: 95,
  SEARCH_THIS_AREA_PAN_KM: 1.2,
  POPUP_MAX_WIDTH: "300px",
  POPUP_OFFSET_PX: 22,
  ROUTE_PANEL_MARGIN_PX: 12,
} as const;

const ITINERARY_CASING_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  3.5,
  14,
  4.75,
  17,
  6,
];

const ITINERARY_LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  1.8,
  14,
  2.5,
  17,
  3.25,
];

const ROUTE_CASING_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  5,
  14,
  6.5,
  17,
  8,
];

const ROUTE_LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  3,
  14,
  4.2,
  17,
  5.2,
];

export const MAP_PAINT_CONFIG = {
  BACKGROUND_COLOR: "#F5F9FF",
  BRAND_BLUE: "#0194F3",
  BRAND_BLUE_CASING: "#006BB3",
  WHITE_CASING: "#FFFFFF",
  PROVINCE_MUTED_LINE: "#94A3B8",
  PROVINCE_MUTED_WIDTH: 1.2,
  PROVINCE_MUTED_OPACITY: 0.35,
  PROVINCE_SELECTED_WIDTH: 3,
  ITINERARY_CASING_WIDTH,
  ITINERARY_LINE_WIDTH,
  ITINERARY_LINE_DASHARRAY: [2.2, 1.8] as number[],
  ITINERARY_CASING_OPACITY: 0.85,
  ITINERARY_LINE_OPACITY: 0.9,
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  ROUTE_CASING_OPACITY: 0.85,
  ROUTE_LINE_OPACITY: 0.95,
} as const;

export interface MapLayerOption {
  id: "bright" | "satellite";
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  previewImage: string;
  iconClass: string;
}

export const MAP_LAYER_OPTIONS: readonly MapLayerOption[] = [
  {
    id: "bright",
    labelKey: "map.controls.themeBright",
    titleKey: "map.controls.themeBrightTitle",
    previewImage: "/images/map/layer-bright.png",
    iconClass: "fa-solid fa-map",
  },
  {
    id: "satellite",
    labelKey: "map.controls.themeSatellite",
    titleKey: "map.controls.themeSatelliteTitle",
    previewImage: "/images/map/layer-satellite.jpg",
    iconClass: "fa-solid fa-earth-americas",
  },
] as const;

export const MAP_ROUTE_PADDING_CONFIG = {
  TOP: 80,
  BOTTOM: 80,
  RIGHT: 60,
  LEFT_DEFAULT: 60,
  DESKTOP_MIN_MAP_WIDTH_PX: 768,
  PANEL_CLEARANCE_LEFT_PX: 408,
  PANEL_MAX_WIDTH_RATIO: 0.45,
} as const;

export function computeRouteFitPadding(
  mapWidthPx: number,
  isPanelExpanded: boolean
): { top: number; bottom: number; left: number; right: number } {
  const {
    TOP,
    BOTTOM,
    RIGHT,
    LEFT_DEFAULT,
    DESKTOP_MIN_MAP_WIDTH_PX,
    PANEL_CLEARANCE_LEFT_PX,
    PANEL_MAX_WIDTH_RATIO,
  } = MAP_ROUTE_PADDING_CONFIG;

  const left =
    isPanelExpanded && mapWidthPx >= DESKTOP_MIN_MAP_WIDTH_PX
      ? Math.max(
          LEFT_DEFAULT,
          Math.min(PANEL_CLEARANCE_LEFT_PX, Math.round(mapWidthPx * PANEL_MAX_WIDTH_RATIO))
        )
      : LEFT_DEFAULT;

  return { top: TOP, bottom: BOTTOM, left, right: RIGHT };
}
