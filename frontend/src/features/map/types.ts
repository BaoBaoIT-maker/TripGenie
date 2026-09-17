import type { Place, PlaceCategory } from "@/types/place";
export type { Place, PlaceCategory };

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const;
export type MapRadiusKm = (typeof MAP_RADIUS_OPTIONS)[number];

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapFilters extends MapCoordinate {
  maxDistanceKm: MapRadiusKm;
  city: string | "all";
  category: PlaceCategory | "all";
  keyword: string;
}

export interface ParsedMapQuery {
  filters: MapFilters;
  hasExplicitCenter: boolean;
}

export interface NearbyPlace {
  place: Place;
  distanceKm: number;
}

export interface MapViewport extends MapCoordinate {
  zoom: number;
}

export interface VietMapProps {
  places: NearbyPlace[];
  center: MapCoordinate;
  radiusKm: MapRadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onRequestCurrentLocation: () => void;
  locating: boolean;
}
