import { create } from 'zustand';

interface ItineraryHoverState {
  hoveredPlaceId: string | null;
  setHoveredPlaceId: (placeId: string | null) => void;
}

/**
 * Isolated hover store so hovering timeline cards only notifies the map marker layer
 * without re-rendering ItineraryView, Timeline, or BudgetBreakdownCard.
 */
export const useItineraryHoverStore = create<ItineraryHoverState>((set) => ({
  hoveredPlaceId: null,
  setHoveredPlaceId: (hoveredPlaceId) =>
    set((state) => (state.hoveredPlaceId === hoveredPlaceId ? state : { hoveredPlaceId })),
}));
