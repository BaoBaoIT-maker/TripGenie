'use client';

import { memo } from 'react';
import { VietMapLoader } from '@/components/map/VietMapLoader';
import type { DiscoveryPlace, MapCoordinate, ItineraryPathSegment } from '@/features/map/types';
import { useItineraryHoverStore } from '../../stores/itinerary-hover-store';

// Module-level no-op callbacks so we don't create new function references on every render
const noop = () => {};
const noopNull = (_: string | null) => {};

interface Props {
  places: DiscoveryPlace[];
  center: MapCoordinate;
  markerLabels: Record<string, string>;
  markerColors?: Record<string, string>;
  pathLine: [number, number][];
  pathSegments?: ItineraryPathSegment[];
  selectedPlaceId?: string | null;
  hoveredPlaceId?: string | null;
  onSelectPlace?: (id: string | null) => void;
  onHoverPlace?: (id: string | null) => void;
}

const ItineraryMap = memo(function ItineraryMap({
  places,
  center,
  markerLabels,
  markerColors,
  pathLine,
  pathSegments,
  selectedPlaceId = null,
  hoveredPlaceId,
  onSelectPlace,
}: Props) {
  const storeHoveredPlaceId = useItineraryHoverStore((s) => s.hoveredPlaceId);
  const effectiveHoveredPlaceId = hoveredPlaceId !== undefined ? hoveredPlaceId : storeHoveredPlaceId;

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-slate-200">
      <VietMapLoader
        places={places}
        center={center}
        radiusKm={20}
        selectedPlaceId={selectedPlaceId}
        hoveredPlaceId={effectiveHoveredPlaceId}
        onSelectPlace={onSelectPlace || noopNull}
        onViewportChange={noop}
        onRequestCurrentLocation={noop}
        locating={false}
        markerLabels={markerLabels}
        markerColors={markerColors}
        pathLine={pathLine}
        pathSegments={pathSegments}
        hidePopupDirections={true}
      />
    </div>
  );
});

export default ItineraryMap;
