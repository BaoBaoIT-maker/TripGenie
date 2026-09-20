"use client";

import { useState, useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlacesQuery,
  useDiscoveryAreasQuery,
  useDiscoveryCategoriesQuery,
} from "./hooks/use-places";
import { useMapFilters } from "./hooks/use-map-filters";
import { useGeolocation } from "./hooks/use-geolocation";
import { useSearchStore } from "@/stores/search-store";
import { MapFilters } from "./MapFilters";
import { MapResults } from "./MapResults";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { MapMobileViewToggle } from "./components/MapMobileViewToggle";
import { MapPlaceDetailDialog } from "./MapPlaceDetailDialog";

export function MapExplorer() {
  const { filters, replaceFilters } = useMapFilters();
  const placesQuery = usePlacesQuery(filters);
  const areasQuery = useDiscoveryAreasQuery();
  const categoriesQuery = useDiscoveryCategoriesQuery();

  const geolocation = useGeolocation();
  const { requestLocation } = geolocation;

  const {
    selectedPlaceId,
    hoveredPlaceId,
    selectPlace,
    hoverPlace,
    setViewport,
  } = useSearchStore();

  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);

  // Synchronize geolocation updates into URL filters only when geolocation succeeds
  useEffect(() => {
    if (geolocation.status === "success" && geolocation.coordinate) {
      replaceFilters({
        ...filters,
        areaSlug: "quanh-toi",
        latitude: geolocation.coordinate.latitude,
        longitude: geolocation.coordinate.longitude,
        page: 1,
      });
    }
  }, [geolocation.status, geolocation.coordinate]);

  const handleUseCurrentLocation = () => {
    requestLocation();
  };

  const handleExpandRadius = () => {
    replaceFilters({ ...filters, radiusKm: 10, page: 1 });
  };

  const handleClearFilters = () => {
    replaceFilters({
      mode: "keyword",
      areaSlug: "da-nang",
      keyword: "",
      categorySlug: "all",
      radiusKm: 5,
      latitude: filters.latitude,
      longitude: filters.longitude,
      openNow: false,
      priceLevels: [],
      minRating: null,
      sortBy: "distance",
      page: 1,
    });
  };

  const handlePageChange = (page: number) => {
    replaceFilters({ ...filters, page });
  };

  const places = placesQuery.data?.items ?? [];
  const total = placesQuery.data?.total ?? 0;
  const totalPages = placesQuery.data?.totalPages ?? 0;
  const currentPage = placesQuery.data?.page ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Geolocation error notice */}
      {geolocation.status === "error" && geolocation.message && (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 sm:flex-row sm:items-center dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
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
        areas={areasQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
        onChange={replaceFilters}
        onUseCurrentLocation={handleUseCurrentLocation}
        locating={geolocation.status === "pending"}
      />

      {/* Split screen: 48% Left Results List, 52% Right Sticky Map */}
      <div className="lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:gap-6 items-start">
        {/* Results Pane */}
        <div className={`${mobileView === "map" ? "hidden lg:block" : "block"} flex flex-col gap-4`}>
          {placesQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48 rounded" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ) : placesQuery.isError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center bg-card">
              <p className="text-sm text-destructive font-medium">
                Đã xảy ra lỗi khi tải danh sách địa điểm mẫu.
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
              places={places}
              total={total}
              currentPage={currentPage}
              totalPages={totalPages}
              radiusKm={filters.radiusKm}
              selectedPlaceId={selectedPlaceId}
              hoveredPlaceId={hoveredPlaceId}
              onSelectPlace={selectPlace}
              onHoverPlace={hoverPlace}
              onExpandRadius={handleExpandRadius}
              onClearFilters={handleClearFilters}
              onPageChange={handlePageChange}
              onOpenDetail={(placeId) => setDetailPlaceId(placeId)}
            />
          )}
        </div>

        {/* Sticky Map Pane */}
        <div
          className={`${
            mobileView === "list" ? "hidden lg:block" : "block"
          } lg:sticky lg:top-24 lg:h-[calc(100vh-140px)] min-h-[480px] rounded-2xl overflow-hidden shadow-xs border`}
        >
          <VietMapLoader
            places={places}
            center={{ latitude: filters.latitude, longitude: filters.longitude }}
            radiusKm={filters.radiusKm}
            selectedPlaceId={selectedPlaceId}
            hoveredPlaceId={hoveredPlaceId}
            onSelectPlace={selectPlace}
            onViewportChange={setViewport}
            onRequestCurrentLocation={handleUseCurrentLocation}
            locating={geolocation.status === "pending"}
          />
        </div>
      </div>

      {/* Floating View Toggle for Mobile */}
      <MapMobileViewToggle
        currentView={mobileView}
        onToggle={() => setMobileView(mobileView === "list" ? "map" : "list")}
      />

      {/* Detail Dialog */}
      <MapPlaceDetailDialog
        placeId={detailPlaceId}
        open={Boolean(detailPlaceId)}
        onOpenChange={(open) => {
          if (!open) setDetailPlaceId(null);
        }}
      />
    </div>
  );
}
