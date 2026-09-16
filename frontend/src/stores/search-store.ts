import { create } from "zustand";
import type { MapViewport } from "@/features/map/types";

interface SearchState {
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  mapViewport: MapViewport | null;
  selectPlace: (placeId: string | null) => void;
  hoverPlace: (placeId: string | null) => void;
  setViewport: (viewport: MapViewport) => void;
  resetMapInteraction: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  selectedPlaceId: null,
  hoveredPlaceId: null,
  mapViewport: null,
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  hoverPlace: (hoveredPlaceId) => set({ hoveredPlaceId }),
  setViewport: (mapViewport) => set({ mapViewport }),
  resetMapInteraction: () => set({ selectedPlaceId: null, hoveredPlaceId: null, mapViewport: null }),
}));
