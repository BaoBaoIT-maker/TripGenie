"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlacesQuery } from "./hooks/use-places";
import { useMapFilters } from "./hooks/use-map-filters";
import { useGeolocation } from "./hooks/use-geolocation";
import { useSearchStore } from "@/stores/search-store";
import { filterNearbyPlaces } from "./lib/map-filter";
import { MapFilters } from "./MapFilters";
import { MapResults } from "./MapResults";
import { VietMapLoader } from "@/components/map/VietMapLoader";

export function MapExplorer() {
  const { filters, hasExplicitCenter, replaceFilters } = useMapFilters();
  const placesQuery = usePlacesQuery();
  const geolocation = useGeolocation();
  const { requestLocation } = geolocation;
  const {
    selectedPlaceId,
    hoveredPlaceId,
    selectPlace,
    hoverPlace,
    setViewport,
  } = useSearchStore();

  const appliedLocationRef = useRef<string | null>(null);

  // Derive nearby filtered places
  const nearbyPlaces = useMemo(
    () => filterNearbyPlaces(placesQuery.data ?? [], filters),
    [filters, placesQuery.data]
  );

  // Request location on first entry if no explicit center is present
  useEffect(() => {
    if (!hasExplicitCenter && geolocation.status === "idle") {
      requestLocation();
    }
  }, [geolocation.status, hasExplicitCenter, requestLocation]);

  // Synchronize geolocation updates into URL filters
  useEffect(() => {
    if (!geolocation.coordinate) return;
    const locationKey = `${geolocation.status}:${geolocation.coordinate.latitude}:${geolocation.coordinate.longitude}`;
    if (appliedLocationRef.current === locationKey) return;

    if (
      geolocation.coordinate &&
      (geolocation.status === "success" || geolocation.status === "fallback")
    ) {
      appliedLocationRef.current = locationKey;
      replaceFilters({
        ...filters,
        ...geolocation.coordinate,
        city: geolocation.status === "success" ? "all" : "TP. Hồ Chí Minh",
      });
    }
  }, [filters, geolocation.coordinate, geolocation.status, replaceFilters]);

  // Clear stale selection if selected place is no longer in results
  useEffect(() => {
    if (
      selectedPlaceId &&
      !nearbyPlaces.some(({ place }) => place.id === selectedPlaceId)
    ) {
      selectPlace(null);
    }
  }, [nearbyPlaces, selectPlace, selectedPlaceId]);

  const handleUseCurrentLocation = () => {
    appliedLocationRef.current = null;
    requestLocation();
  };

  const handleExpandRadius = () => {
    replaceFilters({ ...filters, maxDistanceKm: 10 });
  };

  const handleClearFilters = () => {
    replaceFilters({
      latitude: filters.latitude,
      longitude: filters.longitude,
      maxDistanceKm: 5,
      city: "all",
      category: "all",
      keyword: "",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Geolocation fallback / error notice */}
      {geolocation.status === "fallback" && geolocation.message && (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>{geolocation.message}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            className="shrink-0 gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100"
          >
            <RotateCcw className="size-3.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {/* Filter toolbar */}
      <MapFilters
        filters={filters}
        onChange={replaceFilters}
        onUseCurrentLocation={handleUseCurrentLocation}
        locating={geolocation.status === "pending"}
      />

      {/* Interactive map */}
      <VietMapLoader
        places={nearbyPlaces}
        center={{ latitude: filters.latitude, longitude: filters.longitude }}
        radiusKm={filters.maxDistanceKm}
        selectedPlaceId={selectedPlaceId}
        hoveredPlaceId={hoveredPlaceId}
        onSelectPlace={selectPlace}
        onViewportChange={setViewport}
        onRequestCurrentLocation={handleUseCurrentLocation}
        locating={geolocation.status === "pending"}
      />

      {/* Results or Loading / Error state */}
      {placesQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : placesQuery.isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-destructive">
            Đã xảy ra lỗi khi tải danh sách địa điểm.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => placesQuery.refetch()}
            className="mt-4"
          >
            Tải lại
          </Button>
        </div>
      ) : (
        <MapResults
          places={nearbyPlaces}
          radiusKm={filters.maxDistanceKm}
          selectedPlaceId={selectedPlaceId}
          hoveredPlaceId={hoveredPlaceId}
          onSelectPlace={selectPlace}
          onHoverPlace={hoverPlace}
          onExpandRadius={handleExpandRadius}
          onClearFilters={handleClearFilters}
        />
      )}
    </div>
  );
}
