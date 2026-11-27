"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  LngLatBounds,
  config as maplibreConfig,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import type {
  VietMapProps,
  DiscoveryPlace,
  MapCoordinate,
} from "@/features/map/types";
import type { BackendTravelAreaItem } from "@/services/place.service";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSavedPlaceIds, useToggleFavorite } from "@/features/collections/hooks/use-collections";
import { SaveToCollectionModal } from "@/features/collections/components/SaveToCollectionModal";
import { DEFAULT_COLLECTION_TITLE } from "@/services/collection.service";
import { AddPlaceToItineraryModal } from "@/features/planner/components/AddPlaceToItineraryModal";
import {
  DEFAULT_MAP_ZOOM,
  DEFAULT_MAP_CENTER,
  MAX_NEARBY_PROXIMITY_KM,
  MAX_ROUTE_FIT_ZOOM,
  DANANG_GSO_PROVINCE_CODE,
  MAP_TILE_URLS,
  MAP_SOURCE_IDS,
  MAP_LAYER_IDS,
  MAP_CAMERA_CONFIG,
  MAP_PAINT_CONFIG,
  computeRouteFitPadding,
} from "@/features/map/map-config";
import { createPlaceMarkerElement, getMarkerButtonClasses } from "./PlaceMarker";
import { createMapPopupElement } from "./MapPopup";
import { MapControls, type MapStyleTheme } from "./MapControls";
import { RouteControlPanel, type RouteStop } from "./RouteControlPanel";
import provincesBoundsData from "@/features/map/vietnam_provinces_bounds.json";
import {
  routingService,
  type RouteVehicleMode,
  type RouteResult,
  type Coordinate,
} from "@/services/routing.service";

// Fix Web Worker URL in Next.js / Turbopack
if (typeof window !== "undefined") {
  maplibreConfig.WORKER_URL = "/maplibre-gl-worker.mjs";
}

export type { RouteStop };

const VIETMAP_API_KEY =
  process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ||
  process.env.NEXT_PUBLIC_VIETMAP_API_KEY ||
  "";

// Multi-layer Map Style:
// 1. Bright / Travel (Official VietMap TM @2x tiles) - Default
// 2. Satellite (Esri World Imagery)
const MULTI_LAYER_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [MAP_SOURCE_IDS.SATELLITE]: {
      type: "raster",
      tiles: [MAP_TILE_URLS.SATELLITE],
      tileSize: 256,
      maxzoom: 19,
    },
    [MAP_SOURCE_IDS.BRIGHT]: {
      type: "raster",
      tiles: [`${MAP_TILE_URLS.VIETMAP_BRIGHT_BASE}?apikey=${VIETMAP_API_KEY}`],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: MAP_LAYER_IDS.BACKGROUND,
      type: "background",
      paint: {
        "background-color": MAP_PAINT_CONFIG.BACKGROUND_COLOR,
      },
    },
    {
      id: MAP_LAYER_IDS.SATELLITE,
      type: "raster",
      source: MAP_SOURCE_IDS.SATELLITE,
      layout: { visibility: "none" },
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: MAP_LAYER_IDS.BRIGHT,
      type: "raster",
      source: MAP_SOURCE_IDS.BRIGHT,
      layout: { visibility: "visible" },
      minzoom: 0,
      maxzoom: 24,
    },
  ],
};

interface ProvinceBoundItem {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
  ma_tinh: string;
  loai: string;
}

const boundsMap = provincesBoundsData as Record<string, ProvinceBoundItem>;

/**
 * Resolves geographic center for a destination dynamically without hard-coding
 * Priority 1: Backend Database Travel Areas (dynamic bounding boxes & transit hubs)
 * Priority 2: Official 34 Provinces GeoJSON boundary dataset
 * Priority 3: System default configuration center
 */
function resolveTargetAreaCenter(
  targetPlace: DiscoveryPlace,
  travelAreas?: BackendTravelAreaItem[],
  selectedProvinceName?: string | null
): Coordinate {
  // 1. Check dynamic travel areas from database
  if (travelAreas && travelAreas.length > 0) {
    const area = travelAreas.find((a) => {
      const matchSlug = targetPlace.areaSlug && a.slug === targetPlace.areaSlug;
      const matchName = targetPlace.areaName && (
        a.name.toLowerCase() === targetPlace.areaName.toLowerCase() ||
        (a.nameVi && a.nameVi.toLowerCase() === targetPlace.areaName.toLowerCase())
      );
      const matchSelected = selectedProvinceName && (
        a.name.toLowerCase() === selectedProvinceName.toLowerCase() ||
        (a.nameVi && a.nameVi.toLowerCase() === selectedProvinceName.toLowerCase())
      );
      return matchSlug || matchName || matchSelected;
    });

    if (area && typeof area.latitude === "number" && typeof area.longitude === "number") {
      return { latitude: area.latitude, longitude: area.longitude };
    }
  }

  // 2. Check boundsMap for general provinces (skipping Da Nang ma_tinh 48 whose islands pull center into ocean)
  const provinceKey = targetPlace.areaName || selectedProvinceName;
  if (provinceKey) {
    const directBound = boundsMap[provinceKey];
    if (directBound && directBound.ma_tinh !== DANANG_GSO_PROVINCE_CODE) {
      return { latitude: directBound.centerLat, longitude: directBound.centerLng };
    }
    const cleanKey = provinceKey.toLowerCase().replace(/^(tỉnh|thành phố|tp\.)\s+/i, "").trim();
    const foundKey = Object.keys(boundsMap).find((k) => {
      const cleanBoundKey = k.toLowerCase().replace(/^(tỉnh|thành phố|tp\.)\s+/i, "").trim();
      return cleanBoundKey === cleanKey || cleanKey.includes(cleanBoundKey) || cleanBoundKey.includes(cleanKey);
    });
    if (foundKey && boundsMap[foundKey].ma_tinh !== DANANG_GSO_PROVINCE_CODE) {
      return { latitude: boundsMap[foundKey].centerLat, longitude: boundsMap[foundKey].centerLng };
    }
  }

  // 3. Fallback to system default map center
  return DEFAULT_MAP_CENTER;
}

export default function VietMap({
  places,
  center,
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onViewportChange,
  onRequestCurrentLocation,
  locating,
  selectedProvinceName,
  userLocation,
  geocodedPin,
  onMapClickDropPin,
  routeToPinRequest,
  onSearchThisArea,
  onPinDragEnd,
  markerLabels,
  markerColors,
  pathLine,
  pathSegments,
  hidePopupDirections = false,
  travelAreas,
}: VietMapProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerButtonsMapRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const geocodedMarkerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const isProgrammaticPopupCloseRef = useRef(false);
  const currentPopupPlaceIdRef = useRef<string | null>(null);
  const previousViewportRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<MapStyleTheme>("bright");

  const onViewportChangeRef = useRef(onViewportChange);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const onMapClickDropPinRef = useRef(onMapClickDropPin);
  const onPinDragEndRef = useRef(onPinDragEnd);
  const onSearchThisAreaRef = useRef(onSearchThisArea);
  const initialCenterRef = useRef(center);
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  const lastSearchCenterRef = useRef(center);
  const lastFittedPlacesKeyRef = useRef<string>("");
  const isUserInteractingRef = useRef(false);
  const lastCenteredPlaceIdRef = useRef<string | null>(null);

  // Multi-Stop Routing State (Unified A -> B -> C...)
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeMode, setRouteMode] = useState<RouteVehicleMode>("motorcycle");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isRoutePanelCollapsed, setIsRoutePanelCollapsed] = useState(false);
  const isRoutePanelCollapsedRef = useRef(isRoutePanelCollapsed);
  const routeStopMarkersRef = useRef<Marker[]>([]);
  const pendingDestinationRef = useRef<DiscoveryPlace | null>(null);

  useEffect(() => {
    isRoutePanelCollapsedRef.current = isRoutePanelCollapsed;
  }, [isRoutePanelCollapsed]);

  // Synced Collections & Add-to-Itinerary Modals
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { data: savedIdsSet } = useSavedPlaceIds({ enabled: isAuthenticated });
  const [placeForSaveModal, setPlaceForSaveModal] = useState<DiscoveryPlace | null>(null);
  const [placeForItineraryModal, setPlaceForItineraryModal] = useState<DiscoveryPlace | null>(null);
  const lastToggledPlaceRef = useRef<DiscoveryPlace | null>(null);

  const toggleMutation = useToggleFavorite({
    onSaved: (data) => {
      const toggledPlace = lastToggledPlaceRef.current;
      if (!toggledPlace) return;
      if (data.isSaved) {
        toast.success(
          t("map.toasts.savedToCollection", {
            name: toggledPlace.name,
            collection: DEFAULT_COLLECTION_TITLE,
          }),
          {
            action: {
              label: t("map.toasts.changeCollection"),
              onClick: () => setPlaceForSaveModal(toggledPlace),
            },
          }
        );
      } else {
        toast.info(t("map.toasts.unsavedPlace", { name: toggledPlace.name }));
      }
    },
  });

  // "Search This Area" Pill State
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [pendingSearchCenter, setPendingSearchCenter] = useState<MapCoordinate | null>(null);

  // Handle Locate User action: fly to user location if available, otherwise request permission
  const handleRequestLocation = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: MAP_CAMERA_CONFIG.USER_LOCATION_ZOOM,
        duration: 800,
      });
      toast.success(t("map.toasts.flyingToLocation"));
    }
    if (onRequestCurrentLocation) {
      onRequestCurrentLocation();
    }
  }, [userLocation, onRequestCurrentLocation, t]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    onMapClickDropPinRef.current = onMapClickDropPin;
  }, [onMapClickDropPin]);

  useEffect(() => {
    onPinDragEndRef.current = onPinDragEnd;
  }, [onPinDragEnd]);

  useEffect(() => {
    onSearchThisAreaRef.current = onSearchThisArea;
  }, [onSearchThisArea]);

  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
  }, [selectedPlaceId]);

  // When center prop updates, dismiss "Search This Area" button
  useEffect(() => {
    lastSearchCenterRef.current = center;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSearchThisArea(false);
  }, [center]);

  // Toggle Save Place Handler (Synced with PostgreSQL Collections)
  const handleToggleSave = useCallback(
    (place: DiscoveryPlace) => {
      if (!isAuthenticated) {
        toast.info(t("map.toasts.loginToSave"));
        router.push(`/login?next=${encodeURIComponent("/explore")}`);
        return;
      }
      if (toggleMutation.isPending) return;
      lastToggledPlaceRef.current = place;
      toggleMutation.mutate({ placeId: place.id });
    },
    [isAuthenticated, router, toggleMutation, t]
  );

  // Add Place to Existing Itinerary Handler
  const handleAddToItinerary = useCallback(
    (place: DiscoveryPlace) => {
      if (!isAuthenticated) {
        toast.info(t("map.toasts.loginToAddItinerary"));
        router.push(`/login?next=${encodeURIComponent("/explore")}`);
        return;
      }
      setPlaceForItineraryModal(place);
    },
    [isAuthenticated, router, t]
  );

  // Compute and Draw Multi-Stop Route Line on Map
  const drawRoute = useCallback(
    async (stops: RouteStop[], mode: RouteVehicleMode) => {
      if (stops.length < 2) {
        setRouteResult(null);
        return;
      }

      setRouteLoading(true);

      try {
        const coords = stops.map((s) => s.coordinate);
        const res = await routingService.fetchMultiStopRoute(coords, mode);
        setRouteResult(res);

        if (!mapRef.current) return;
        const map = mapRef.current;

        // Render Stop Markers (A, B, C...)
        routeStopMarkersRef.current.forEach((m) => m.remove());
        routeStopMarkersRef.current = [];

        stops.forEach((stop, index) => {
          const letter = String.fromCharCode(65 + index);
          const isOrigin = index === 0;
          const isDest = index === stops.length - 1;
          const colorBg = isOrigin
            ? "bg-emerald-600"
            : isDest
            ? "bg-rose-600"
            : "bg-[#0194F3]";
          const label = isOrigin
            ? t("map.routing.originMarker", { letter })
            : isDest
            ? t("map.routing.destMarker", { letter })
            : t("map.routing.stopMarker", { index, letter });

          const el = document.createElement("div");
          el.className = "flex flex-col items-center -translate-y-1/2 cursor-pointer select-none group";
          el.innerHTML = `
            <div class="px-1.5 py-0.5 rounded ${colorBg} text-white text-[10px] font-bold shadow-md mb-0.5 whitespace-nowrap group-hover:scale-105 transition-transform">
              ${label}
            </div>
            <div class="w-6 h-6 rounded-full ${colorBg} border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-[11px] group-hover:scale-110 transition-transform">
              ${letter}
            </div>
          `;

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (stop.id && !routingService.isSyntheticRouteOriginId(stop.id)) {
              onSelectPlaceRef.current(stop.id);
            }
          });

          const marker = new Marker({ element: el })
            .setLngLat([stop.coordinate.longitude, stop.coordinate.latitude])
            .addTo(map);

          routeStopMarkersRef.current.push(marker);
        });

        // Add or update route GeoJSON source
        const sourceId = MAP_SOURCE_IDS.ROUTE;
        const casingLayerId = MAP_LAYER_IDS.ROUTE_CASING;
        const lineLayerId = MAP_LAYER_IDS.ROUTE_LINE;

        const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          properties: {},
          geometry: res.geometry,
        };

        const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;
        if (existingSource) {
          existingSource.setData(routeGeoJson);
        } else {
          map.addSource(sourceId, {
            type: "geojson",
            data: routeGeoJson,
          });
        }

        // Route line high-contrast casing (zoom-responsive)
        if (!map.getLayer(casingLayerId)) {
          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": MAP_PAINT_CONFIG.BRAND_BLUE_CASING,
              "line-width": MAP_PAINT_CONFIG.ROUTE_CASING_WIDTH,
              "line-opacity": MAP_PAINT_CONFIG.ROUTE_CASING_OPACITY,
            },
          });
        }

        // Route main brand line (zoom-responsive)
        if (!map.getLayer(lineLayerId)) {
          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": MAP_PAINT_CONFIG.BRAND_BLUE,
              "line-width": MAP_PAINT_CONFIG.ROUTE_LINE_WIDTH,
              "line-opacity": MAP_PAINT_CONFIG.ROUTE_LINE_OPACITY,
            },
          });
        }

        // Fit map bounds to encompass the entire multi-stop route
        const bounds = new LngLatBounds();
        stops.forEach((s) => bounds.extend([s.coordinate.longitude, s.coordinate.latitude]));
        if (res.geometry.coordinates && res.geometry.coordinates.length > 0) {
          res.geometry.coordinates.forEach((coord) => {
            bounds.extend(coord as [number, number]);
          });
        }

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const isDegenerate = !ne || !sw || (ne.lng === sw.lng && ne.lat === sw.lat);

        if (isDegenerate) {
          map.flyTo({
            center: [stops[0].coordinate.longitude, stops[0].coordinate.latitude],
            zoom: 15,
            duration: 800,
          });
        } else {
          map.fitBounds(bounds, {
            padding: computeRouteFitPadding(
              containerRef.current?.clientWidth ?? 0,
              !isRoutePanelCollapsedRef.current
            ),
            maxZoom: MAX_ROUTE_FIT_ZOOM,
            duration: 800,
          });
        }
      } catch (err) {
        console.error("Failed to compute multi-stop route:", err);
        toast.error(t("map.toasts.routeLoadError"));
      } finally {
        setRouteLoading(false);
      }
    },
    [t]
  );

  // Clear route from map and reset state
  const handleClearRoute = useCallback(() => {
    routeStopMarkersRef.current.forEach((m) => m.remove());
    routeStopMarkersRef.current = [];
    setRouteStops([]);
    setRouteResult(null);
    setIsRoutePanelCollapsed(false);
    pendingDestinationRef.current = null;
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer(MAP_LAYER_IDS.ROUTE_LINE)) map.removeLayer(MAP_LAYER_IDS.ROUTE_LINE);
    if (map.getLayer(MAP_LAYER_IDS.ROUTE_CASING)) map.removeLayer(MAP_LAYER_IDS.ROUTE_CASING);
    if (map.getSource(MAP_SOURCE_IDS.ROUTE)) map.removeSource(MAP_SOURCE_IDS.ROUTE);
  }, []);

  // Close place popup cleanly when switching to or mutating active routing
  const dismissPopupForRouting = useCallback(() => {
    if (popupRef.current) {
      isProgrammaticPopupCloseRef.current = true;
      popupRef.current.remove();
      popupRef.current = null;
      isProgrammaticPopupCloseRef.current = false;
    }
    currentPopupPlaceIdRef.current = null;
    previousViewportRef.current = null;
    onSelectPlaceRef.current(null);
  }, []);

  // Request directions handler (initiates 2-stop route from nearby GPS or area center)
  const pendingUserOriginRequestRef = useRef(false);

  const handleStartDirections = useCallback(
    (targetPlace: DiscoveryPlace) => {
      dismissPopupForRouting();
      const provCenter = resolveTargetAreaCenter(
        targetPlace,
        travelAreas,
        selectedProvinceName
      );
      const provName = targetPlace.areaName || selectedProvinceName || t("map.cityFallback");

      const newStops = routingService.buildInitialRouteStops({
        targetStop: {
          id: targetPlace.id,
          name: targetPlace.name,
          coordinate: { latitude: targetPlace.latitude, longitude: targetPlace.longitude },
        },
        userLocation,
        areaCenter: provCenter,
        areaName: provName,
        maxNearbyKm: MAX_NEARBY_PROXIMITY_KM,
      });
      setRouteStops(newStops);
    },
    [dismissPopupForRouting, userLocation, selectedProvinceName, travelAreas, t]
  );

  // Hide underlying place markers for active route stops so markers never collide or peek underneath
  useEffect(() => {
    const routePlaceIds = new Set(routeStops.map((s) => s.id));
    markerButtonsMapRef.current.forEach((button, placeId) => {
      const container = button.closest<HTMLDivElement>(".marker-container");
      if (container) {
        container.style.display = routePlaceIds.has(placeId) ? "none" : "";
      }
    });
  }, [routeStops]);

  // Upgrade fallback origin to actual user location when nearby (< 20km) OR when user explicitly clicked "Từ vị trí của tôi"
  useEffect(() => {
    if (!userLocation) return;
    const forceUserOrigin = pendingUserOriginRequestRef.current;
    pendingUserOriginRequestRef.current = false;

    setRouteStops((prev) => {
      const { stops: updated, applied } = routingService.applyUserLocationToRoute(
        prev,
        userLocation,
        { force: forceUserOrigin, maxNearbyKm: MAX_NEARBY_PROXIMITY_KM }
      );
      if (applied) {
        toast.info(
          forceUserOrigin
            ? t("map.toasts.originSetToMyLocation")
            : t("map.toasts.routeAutoUpdatedFromLocation")
        );
        return updated;
      }
      return prev;
    });
  }, [userLocation, t]);

  // Explicitly use user's live GPS as the route origin regardless of 20km threshold
  const handleUseMyLocationAsOrigin = useCallback(() => {
    if (userLocation) {
      setRouteStops((prev) => {
        const { stops: updated } = routingService.applyUserLocationToRoute(
          prev,
          userLocation,
          { force: true }
        );
        return updated;
      });
      toast.success(t("map.toasts.originSetToMyLocation"));
      return;
    }

    pendingUserOriginRequestRef.current = true;
    onRequestCurrentLocation?.();
    toast.info(t("map.toasts.fetchingGpsForOrigin"));
  }, [userLocation, onRequestCurrentLocation, t]);

  // Set selected place as the starting origin (Point A)
  const handleSetOrigin = useCallback(
    (place: DiscoveryPlace) => {
      dismissPopupForRouting();
      const newOrigin: RouteStop = {
        id: place.id,
        name: place.name,
        coordinate: { latitude: place.latitude, longitude: place.longitude },
      };
      setRouteStops((prev) => routingService.setOriginInRoute(prev, newOrigin));
      toast.success(t("map.toasts.originSetToPlace", { name: place.name }));
    },
    [dismissPopupForRouting, t]
  );

  // Add a stop to the existing route — pure state update, drawRoute triggered by reactive effect
  const handleAddStopToRoute = useCallback(
    (place: DiscoveryPlace) => {
      if (!place) return;
      dismissPopupForRouting();
      setRouteStops((prev) =>
        routingService.addStopToRoute(prev, {
          id: place.id,
          name: place.name,
          coordinate: { latitude: place.latitude, longitude: place.longitude },
        })
      );
      toast.success(t("map.toasts.stopAdded", { name: place.name }));
    },
    [dismissPopupForRouting, t]
  );

  // Remove a stop by index — pure state update, reactive effect handles re-draw / clear
  const handleRemoveStop = useCallback(
    (index: number) => {
      setRouteStops((prev) => routingService.removeStopFromRoute(prev, index));
    },
    []
  );

  // Remove a stop by place ID (from popup) — pure state update
  const handleRemoveStopById = useCallback(
    (placeId: string) => {
      dismissPopupForRouting();
      setRouteStops((prev) => routingService.removeStopFromRoute(prev, placeId));
      toast.info(t("map.toasts.stopRemoved"));
    },
    [dismissPopupForRouting, t]
  );

    // Move a stop up or down — pure state update
  const handleMoveStop = useCallback(
    (index: number, direction: "up" | "down") => {
      setRouteStops((prev) => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        const updated = [...prev];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        return updated;
      });
    },
    []
  );

    // Swap / Invert all stops order — pure state update
  const handleSwapRoute = useCallback(() => {
    setRouteStops((prev) => {
      if (prev.length < 2) return prev;
      return [...prev].reverse();
    });
  }, []);

    // Switch vehicle mode — reactive effect redraws automatically
  const handleChangeMode = useCallback(
    (newMode: RouteVehicleMode) => {
      setRouteMode(newMode);
    },
    []
  );

  // Reactive: re-draw route whenever routeStops or routeMode changes.
  // All mutation handlers are pure state updates — no drawRoute inside updaters.
  useEffect(() => {
    if (routeStops.length >= 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      drawRoute(routeStops, routeMode);
    } else if (routeStops.length === 0) {
      const map = mapRef.current;
      if (map) {
        if (map.getLayer(MAP_LAYER_IDS.ROUTE_LINE)) map.removeLayer(MAP_LAYER_IDS.ROUTE_LINE);
        if (map.getLayer(MAP_LAYER_IDS.ROUTE_CASING)) map.removeLayer(MAP_LAYER_IDS.ROUTE_CASING);
        if (map.getSource(MAP_SOURCE_IDS.ROUTE)) map.removeSource(MAP_SOURCE_IDS.ROUTE);
      }
      routeStopMarkersRef.current.forEach((m) => m.remove());
      routeStopMarkersRef.current = [];
      setRouteResult(null);
    }
  }, [routeStops, routeMode, drawRoute]);

    // If user requests routing directly to a pinned location
  useEffect(() => {
    if (routeToPinRequest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleStartDirections({
        id: "pinned-pin",
        slug: "pinned-pin",
        name: routeToPinRequest.name,
        latitude: routeToPinRequest.latitude,
        longitude: routeToPinRequest.longitude,
        category: "custom",
        categoryLabel: t("map.pinnedLocation"),
        areaSlug: "",
        areaName: selectedProvinceName || "",
        address: routeToPinRequest.name,
        rating: null,
        reviewCount: 0,
        priceLevel: null,
        isOpenNow: null,
        primaryImage: null,
        images: [],
        phone: null,
        website: null,
        openingHours: null,
        tags: [],
      });
    }
  }, [routeToPinRequest, handleStartDirections, selectedProvinceName, t]);

  // Switch raster tile layers when theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const isSatellite = currentTheme === "satellite";

    if (map.getLayer(MAP_LAYER_IDS.BRIGHT)) {
      map.setLayoutProperty(MAP_LAYER_IDS.BRIGHT, "visibility", isSatellite ? "none" : "visible");
    }
    if (map.getLayer(MAP_LAYER_IDS.SATELLITE)) {
      map.setLayoutProperty(MAP_LAYER_IDS.SATELLITE, "visibility", isSatellite ? "visible" : "none");
    }
  }, [currentTheme, mapLoaded]);

  // Map initialization
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const initialZoom = selectedPlaceIdRef.current
        ? MAP_CAMERA_CONFIG.SELECTED_PLACE_ZOOM
        : DEFAULT_MAP_ZOOM;
      const map = new MapLibreMap({
        container: containerRef.current,
        style: MULTI_LAYER_MAP_STYLE,
        center: [initialCenterRef.current.longitude, initialCenterRef.current.latitude],
        zoom: initialZoom,
      });

      map.on("load", () => {
        setMapLoaded(true);
        setHasError(false);
        map.resize();

        // Load 34 Provinces GeoJSON boundary overlay
        try {
          if (!map.getSource(MAP_SOURCE_IDS.PROVINCES)) {
            map.addSource(MAP_SOURCE_IDS.PROVINCES, {
              type: "geojson",
              data: MAP_TILE_URLS.PROVINCES_GEOJSON,
            });

            // Fill layer for province highlight
            map.addLayer({
              id: MAP_LAYER_IDS.PROVINCES_FILL,
              type: "fill",
              source: MAP_SOURCE_IDS.PROVINCES,
              paint: {
                "fill-color": MAP_PAINT_CONFIG.BRAND_BLUE,
                "fill-opacity": 0.0,
              },
            });

            // Stroke line layer for provincial borders
            map.addLayer({
              id: MAP_LAYER_IDS.PROVINCES_LINE,
              type: "line",
              source: MAP_SOURCE_IDS.PROVINCES,
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": MAP_PAINT_CONFIG.PROVINCE_MUTED_LINE,
                "line-width": MAP_PAINT_CONFIG.PROVINCE_MUTED_WIDTH,
                "line-opacity": MAP_PAINT_CONFIG.PROVINCE_MUTED_OPACITY,
              },
            });
          }
        } catch (layerErr) {
          console.warn("Could not load GeoJSON layers:", layerErr);
        }
      });

      // User manual gesture detection: freeze automated camera recentering
      map.on("dragstart", () => {
        isUserInteractingRef.current = true;
      });
      map.on("zoomstart", (e) => {
        if (e && e.originalEvent) {
          isUserInteractingRef.current = true;
        }
      });
      map.on("touchstart", () => {
        isUserInteractingRef.current = true;
      });
      map.on("movestart", (e) => {
        if (e && e.originalEvent) {
          isUserInteractingRef.current = true;
        }
      });

      // Listen to Pan/Move to show "Search This Area" if user pans far
      map.on("moveend", () => {
        const c = map.getCenter();
        onViewportChangeRef.current({
          latitude: c.lat,
          longitude: c.lng,
          zoom: map.getZoom(),
        });

        if (lastSearchCenterRef.current) {
          const distFromLast = routingService.calculateDirectDistanceKm(
            lastSearchCenterRef.current,
            { latitude: c.lat, longitude: c.lng }
          );
          if (distFromLast > MAP_CAMERA_CONFIG.SEARCH_THIS_AREA_PAN_KM) {
            setShowSearchThisArea((prev) => (prev ? prev : true));
            setPendingSearchCenter((prev) => {
              if (
                prev &&
                Math.abs(prev.latitude - c.lat) < 0.0001 &&
                Math.abs(prev.longitude - c.lng) < 0.0001
              ) {
                return prev;
              }
              return { latitude: c.lat, longitude: c.lng };
            });
          } else {
            setShowSearchThisArea((prev) => (prev ? false : prev));
          }
        }
      });

      // Map Click Handler: Drop Pin or Deselect
      map.on("click", (e) => {
        const originalEvent = e.originalEvent as MouseEvent;
        const target = originalEvent?.target as HTMLElement | null;
        if (target && !target.closest(".marker-container") && !target.closest(".maplibregl-popup")) {
          const wasPlaceSelected = Boolean(selectedPlaceIdRef.current);
          onSelectPlaceRef.current(null);
          if (!wasPlaceSelected && onMapClickDropPinRef.current) {
            onMapClickDropPinRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }
        }
      });

      map.on("error", (e: { error?: { message?: string }; message?: string }) => {
        const msg = e?.error?.message || e?.message;
        if (msg) {
          console.warn("VietMap / MapLibre error:", msg);
        }
      });

      mapRef.current = map;

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapRef.current) {
            mapRef.current.resize();
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver?.disconnect();
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        routeStopMarkersRef.current.forEach((m) => m.remove());
        routeStopMarkersRef.current = [];
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        if (geocodedMarkerRef.current) {
          geocodedMarkerRef.current.remove();
          geocodedMarkerRef.current = null;
        }
        if (popupRef.current) {
          isProgrammaticPopupCloseRef.current = true;
          popupRef.current.remove();
          popupRef.current = null;
          isProgrammaticPopupCloseRef.current = false;
        }
        map.remove();
        mapRef.current = null;
        setMapLoaded(false);
      };
    } catch (err) {
      console.error("Failed to initialize VietMap:", err);
      setTimeout(() => setHasError(true), 0);
    }
  }, [retryNonce]);

  // Update Highlight and FitBounds when selectedProvinceName changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Keep province interior completely transparent
    if (map.getLayer(MAP_LAYER_IDS.PROVINCES_FILL)) {
      map.setPaintProperty(MAP_LAYER_IDS.PROVINCES_FILL, "fill-opacity", 0.0);
    }

    // Highlight selected province border with brand blue
    if (map.getLayer(MAP_LAYER_IDS.PROVINCES_LINE)) {
      if (selectedProvinceName) {
        map.setPaintProperty(MAP_LAYER_IDS.PROVINCES_LINE, "line-color", [
          "case",
          ["==", ["get", "ten_tinh"], selectedProvinceName],
          MAP_PAINT_CONFIG.BRAND_BLUE,
          MAP_PAINT_CONFIG.PROVINCE_MUTED_LINE,
        ]);
        map.setPaintProperty(MAP_LAYER_IDS.PROVINCES_LINE, "line-width", [
          "case",
          ["==", ["get", "ten_tinh"], selectedProvinceName],
          MAP_PAINT_CONFIG.PROVINCE_SELECTED_WIDTH,
          1.0,
        ]);
        map.setPaintProperty(MAP_LAYER_IDS.PROVINCES_LINE, "line-opacity", [
          "case",
          ["==", ["get", "ten_tinh"], selectedProvinceName],
          1.0,
          0.3,
        ]);
      } else {
        map.setPaintProperty(
          MAP_LAYER_IDS.PROVINCES_LINE,
          "line-color",
          MAP_PAINT_CONFIG.PROVINCE_MUTED_LINE
        );
        map.setPaintProperty(
          MAP_LAYER_IDS.PROVINCES_LINE,
          "line-width",
          MAP_PAINT_CONFIG.PROVINCE_MUTED_WIDTH
        );
        map.setPaintProperty(
          MAP_LAYER_IDS.PROVINCES_LINE,
          "line-opacity",
          MAP_PAINT_CONFIG.PROVINCE_MUTED_OPACITY
        );
      }
    }

    if (selectedProvinceName && boundsMap[selectedProvinceName] && !selectedPlaceId) {
      const b = boundsMap[selectedProvinceName];
      if (places.length === 0) {
        map.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 40, maxZoom: MAP_CAMERA_CONFIG.PROVINCE_FIT_MAX_ZOOM, duration: 800 }
        );
      }
    }
  }, [selectedProvinceName, mapLoaded, places.length, selectedPlaceId]);

  // Update User Location Marker (GPS) - Static soft halo (no endless animation loops)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement("div");
      el.className = "relative flex items-center justify-center cursor-pointer";
      el.innerHTML = `
        <div class="absolute h-7 w-7 rounded-full bg-[#0194F3]/20 border border-[#0194F3]/30"></div>
        <div class="relative h-4 w-4 rounded-full border-2 border-white bg-[#0194F3] shadow-md"></div>
      `;

      const marker = new Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  // Display Draggable Geocoded Pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geocodedMarkerRef.current) {
      geocodedMarkerRef.current.remove();
      geocodedMarkerRef.current = null;
    }

    if (geocodedPin && typeof geocodedPin.lat === "number" && typeof geocodedPin.lng === "number") {
      const el = document.createElement("div");
      el.className = "relative flex flex-col items-center -translate-y-full cursor-grab active:cursor-grabbing select-none group z-50 pointer-events-auto";
      el.innerHTML = `
        <div class="px-2.5 py-1 rounded-full bg-white border border-[#D5E2F0] text-[#10243A] text-[11px] font-bold shadow-lg mb-1.5 whitespace-nowrap flex items-center gap-1.5 transition-transform group-hover:scale-105">
          <span class="size-2 rounded-full bg-rose-500 shrink-0"></span>
          <span class="max-w-[200px] truncate">${geocodedPin.displayName || t("map.pinnedLocation")}</span>
        </div>
        <div class="relative filter drop-shadow-md group-hover:scale-110 active:scale-125 transition-transform duration-150">
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 44 17 44C17 44 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#EA4335"/>
            <path d="M17 1C8.16344 1 1 8.16344 1 17C1 28.5 15.5 41.5 17 42.8C18.5 41.5 33 28.5 33 17C33 8.16344 25.8366 1 17 1Z" stroke="#B31412" stroke-width="1.2"/>
            <circle cx="17" cy="17" r="7" fill="#7B1113"/>
            <circle cx="17" cy="17" r="5" fill="#FFFFFF"/>
          </svg>
        </div>
        <div class="w-4 h-1.5 rounded-full bg-black/25 blur-[1.5px] -mt-0.5 pointer-events-none"></div>
      `;

      // Enable native draggable marker!
      const marker = new Marker({ element: el, draggable: true })
        .setLngLat([geocodedPin.lng, geocodedPin.lat])
        .addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        if (onPinDragEndRef.current) {
          onPinDragEndRef.current({ lat: pos.lat, lng: pos.lng });
        }
      });

      geocodedMarkerRef.current = marker;

      // Smoothly fly map to pinned position
      map.flyTo({
        center: [geocodedPin.lng, geocodedPin.lat],
        zoom: MAP_CAMERA_CONFIG.GEOCODED_PIN_ZOOM,
        duration: 900,
      });
    }
  }, [geocodedPin, t]);

  // Create / Rebuild places markers when `places` list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerButtonsMapRef.current.clear();

    const newMarkers: Marker[] = [];

    places.forEach((item) => {
      const place = "place" in item ? (item.place as DiscoveryPlace) : item;
      const customColor = markerColors?.[place.id];
      const { container, button } = createPlaceMarkerElement(item, {
        selected: false,
        hovered: false,
        label: markerLabels?.[place.id],
        customColor,
        locale,
        onSelect: () => {
          lastCenteredPlaceIdRef.current = null;
          isUserInteractingRef.current = false;
          onSelectPlaceRef.current(place.id);
        },
      });

      markerButtonsMapRef.current.set(place.id, button);

      if (routeStops.some((s) => s.id === place.id)) {
        container.style.display = "none";
      }

      const marker = new Marker({ element: container })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;

    // Auto fit bounds ONCE when places list actually changes (only if no specific place is selected)
    const placesKey = places.map((item) => {
      const p = "place" in item ? item.place : item;
      return p.id;
    }).join(",");

    if (places.length > 0 && !selectedPlaceIdRef.current && placesKey !== lastFittedPlacesKeyRef.current) {
      lastFittedPlacesKeyRef.current = placesKey;
      const firstPlace = "place" in places[0] ? (places[0].place as DiscoveryPlace) : places[0];
      const bounds = new LngLatBounds(
        [firstPlace.longitude, firstPlace.latitude],
        [firstPlace.longitude, firstPlace.latitude]
      );
      places.forEach((item) => {
        const p = "place" in item ? (item.place as DiscoveryPlace) : item;
        bounds.extend([p.longitude, p.latitude]);
      });
      if (geocodedPin && typeof geocodedPin.lat === "number" && typeof geocodedPin.lng === "number") {
        bounds.extend([geocodedPin.lng, geocodedPin.lat]);
      }
      try {
        map.fitBounds(bounds, {
          padding: 60,
          maxZoom: MAP_CAMERA_CONFIG.PLACES_FIT_MAX_ZOOM,
          duration: 600,
        });
      } catch {
        // ignore bounds calculation error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, geocodedPin, markerLabels, markerColors]);


  // Smooth, instant marker hover and selection update
  useEffect(() => {
    const buttonsMap = markerButtonsMapRef.current;
    buttonsMap.forEach((button, placeId) => {
      const isSelected = placeId === selectedPlaceId;
      const isHovered = placeId === hoveredPlaceId;
      button.className = getMarkerButtonClasses(isSelected, isHovered, button.dataset.categoryBg);
      button.dataset.active = isSelected ? "true" : "false";

      // Preserve custom color styling (e.g. per-day signature colors)
      if (button.dataset.customColor) {
        button.style.backgroundColor = button.dataset.customColor;
        button.style.borderColor = "#ffffff";
        button.style.color = "#ffffff";
      }

      // Suppress the hover tooltip when selected so it never conflicts with the popup
      const container = button.closest(".marker-container");
      if (container) {
        const tooltip = container.querySelector<HTMLDivElement>(":scope > div");
        if (tooltip) {
          tooltip.style.display = isSelected ? "none" : "";
        }
      }
    });
  }, [selectedPlaceId, hoveredPlaceId]);

  // Draw / update the itinerary polyline (sleek dashed zoom-responsive multi-day segments)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const SOURCE_ID = MAP_SOURCE_IDS.ITINERARY_PATH;
    const LAYER_ID = MAP_LAYER_IDS.ITINERARY_PATH_LINE;
    const CASING_LAYER_ID = MAP_LAYER_IDS.ITINERARY_PATH_CASING;

    let features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    if (pathSegments && pathSegments.length > 0) {
      features = pathSegments
        .filter((seg) => seg.coordinates && seg.coordinates.length >= 2)
        .map((seg) => ({
          type: "Feature",
          properties: {
            dayNumber: seg.dayNumber,
            color: seg.color || MAP_PAINT_CONFIG.BRAND_BLUE,
          },
          geometry: {
            type: "LineString",
            coordinates: seg.coordinates,
          },
        }));
    } else if (pathLine && pathLine.length >= 2) {
      features = [
        {
          type: "Feature",
          properties: {
            dayNumber: 1,
            color: MAP_PAINT_CONFIG.BRAND_BLUE,
          },
          geometry: {
            type: "LineString",
            coordinates: pathLine,
          },
        },
      ];
    }

    const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: "FeatureCollection",
      features,
    };

    try {
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(geojson);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
        // Crisp white casing underneath dashed stop connector
        map.addLayer({
          id: CASING_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": MAP_PAINT_CONFIG.WHITE_CASING,
            "line-width": MAP_PAINT_CONFIG.ITINERARY_CASING_WIDTH,
            "line-opacity": MAP_PAINT_CONFIG.ITINERARY_CASING_OPACITY,
          },
        });
        // Sleek zoom-responsive dashed connector per day
        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["coalesce", ["get", "color"], MAP_PAINT_CONFIG.BRAND_BLUE],
            "line-width": MAP_PAINT_CONFIG.ITINERARY_LINE_WIDTH,
            "line-dasharray": MAP_PAINT_CONFIG.ITINERARY_LINE_DASHARRAY,
            "line-opacity": MAP_PAINT_CONFIG.ITINERARY_LINE_OPACITY,
          },
        });
      }
    } catch (e) {
      console.warn("[ItineraryPath] failed to update polyline:", e);
    }
  }, [pathSegments, pathLine, mapLoaded]);

  // Center on selected place & show popup (with Quick Save & Multi-stop Add options)

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!selectedPlaceId) {
      lastCenteredPlaceIdRef.current = null;
      isUserInteractingRef.current = false;
      const wasSelected = Boolean(currentPopupPlaceIdRef.current || previousViewportRef.current);
      currentPopupPlaceIdRef.current = null;
      if (popupRef.current) {
        isProgrammaticPopupCloseRef.current = true;
        popupRef.current.remove();
        popupRef.current = null;
        isProgrammaticPopupCloseRef.current = false;
      }

      // Smoothly zoom out back to overview when closing popup (unless active routing owns camera)
      if (wasSelected && routeStops.length < 2) {
        if (previousViewportRef.current) {
          map.flyTo({
            center: previousViewportRef.current.center,
            zoom: previousViewportRef.current.zoom,
            duration: 500,
            essential: true,
          });
          previousViewportRef.current = null;
        } else if (places.length > 0) {
          const firstPlace = "place" in places[0] ? (places[0].place as DiscoveryPlace) : places[0];
          const bounds = new LngLatBounds(
            [firstPlace.longitude, firstPlace.latitude],
            [firstPlace.longitude, firstPlace.latitude]
          );
          places.forEach((item) => {
            const p = "place" in item ? (item.place as DiscoveryPlace) : item;
            bounds.extend([p.longitude, p.latitude]);
          });
          try {
            map.fitBounds(bounds, {
              padding: 60,
              maxZoom: MAP_CAMERA_CONFIG.OVERVIEW_MAX_ZOOM,
              duration: 500,
            });
          } catch {
            map.flyTo({
              center: [center.longitude, center.latitude],
              zoom: DEFAULT_MAP_ZOOM,
              duration: 500,
            });
          }
        }
      }
      return;
    }

    const targetItem = places.find((item) => {
      const p = "place" in item ? (item.place as DiscoveryPlace) : item;
      return p.id === selectedPlaceId || ("slug" in p && p.slug === selectedPlaceId);
    });
    if (!targetItem) return;
    const targetPlace = "place" in targetItem ? (targetItem.place as DiscoveryPlace) : targetItem;
    if (!targetPlace || typeof targetPlace.latitude !== "number" || typeof targetPlace.longitude !== "number") return;

    const routeStopIndex = routeStops.findIndex((s) => s.id === targetPlace.id);

    // If popup is ALREADY showing for this exact place, refresh action buttons in-place and keep it firmly open!
    if (currentPopupPlaceIdRef.current === targetPlace.id && popupRef.current && popupRef.current.isOpen()) {
      const isSaved = isAuthenticated ? (savedIdsSet?.has(targetPlace.id) ?? false) : false;
      const popupEl = createMapPopupElement(
        targetItem,
        (placeId) => {
          router.push(`/places/${targetPlace.slug || placeId}`);
        },
        hidePopupDirections ? undefined : (targetPlace) => handleStartDirections(targetPlace),
        {
          locale,
          isRoutingActive: hidePopupDirections ? false : routeStops.length >= 2,
          routeStopIndex,
          isSaved,
          onToggleSave: handleToggleSave,
          onAddToItinerary: hidePopupDirections ? undefined : handleAddToItinerary,
          onAddStopToRoute: hidePopupDirections ? undefined : handleAddStopToRoute,
          onRemoveStopFromRoute: hidePopupDirections ? undefined : handleRemoveStopById,
          onSetOrigin: hidePopupDirections ? undefined : handleSetOrigin,
        }
      );
      popupRef.current.setDOMContent(popupEl);
      return;
    }

    // Save previous overview viewport before zooming into selected place
    const currentZoom = map.getZoom();
    if (currentZoom < MAP_CAMERA_CONFIG.MOBILE_SELECTED_ZOOM && !previousViewportRef.current) {
      const c = map.getCenter();
      previousViewportRef.current = {
        center: [c.lng, c.lat],
        zoom: currentZoom,
      };
    }

    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

    // Quick camera move to selected place ONLY upon a new intentional selection
    const isNewSelection = selectedPlaceId !== lastCenteredPlaceIdRef.current;
    if (isNewSelection) {
      // User explicitly changed place -> unlock user interaction lock and center immediately
      isUserInteractingRef.current = false;
      lastCenteredPlaceIdRef.current = targetPlace.id;

      if (routeStops.length < 2) {
        if (isMobile) {
          // On mobile: quick, snappy easeTo directly to target place
          map.easeTo({
            center: [targetPlace.longitude, targetPlace.latitude],
            zoom: MAP_CAMERA_CONFIG.MOBILE_SELECTED_ZOOM,
            duration: 200,
            essential: true,
          });
        } else {
          map.flyTo({
            center: [targetPlace.longitude, targetPlace.latitude],
            zoom: MAP_CAMERA_CONFIG.SELECTED_PLACE_ZOOM,
            offset: [0, MAP_CAMERA_CONFIG.DESKTOP_POPUP_OFFSET_Y],
            duration: 350,
            essential: true,
          });
        }
      }
    }

    if (popupRef.current) {
      isProgrammaticPopupCloseRef.current = true;
      popupRef.current.remove();
      popupRef.current = null;
      currentPopupPlaceIdRef.current = null;
      isProgrammaticPopupCloseRef.current = false;
    }

    // On mobile (< 1024px), the bottom carousel card acts as the interactive preview.
    // Suppress the heavy DOM popup balloon to keep the map clean and prevent UI collisions.
    if (isMobile) {
      currentPopupPlaceIdRef.current = targetPlace.id;
      return;
    }

    const isSaved = isAuthenticated ? (savedIdsSet?.has(targetPlace.id) ?? false) : false;

    const popupEl = createMapPopupElement(
      targetItem,
      (placeId) => {
        router.push(`/places/${targetPlace.slug || placeId}`);
      },
      hidePopupDirections ? undefined : (targetPlace) => handleStartDirections(targetPlace),
      {
        locale,
        isRoutingActive: hidePopupDirections ? false : routeStops.length >= 2,
        routeStopIndex,
        isSaved,
        onToggleSave: handleToggleSave,
        onAddToItinerary: hidePopupDirections ? undefined : handleAddToItinerary,
        onAddStopToRoute: hidePopupDirections ? undefined : handleAddStopToRoute,
        onRemoveStopFromRoute: hidePopupDirections ? undefined : handleRemoveStopById,
        onSetOrigin: hidePopupDirections ? undefined : handleSetOrigin,
      }
    );

    const popup = new Popup({
      closeButton: true,
      closeOnClick: false,
      offset: MAP_CAMERA_CONFIG.POPUP_OFFSET_PX,
      maxWidth: MAP_CAMERA_CONFIG.POPUP_MAX_WIDTH,
    })
      .setLngLat([targetPlace.longitude, targetPlace.latitude])
      .setDOMContent(popupEl)
      .addTo(map);

    currentPopupPlaceIdRef.current = targetPlace.id;

    popup.on("close", () => {
      if (isProgrammaticPopupCloseRef.current) return;
      if (selectedPlaceIdRef.current === targetPlace.id || selectedPlaceIdRef.current === targetPlace.slug) {
        onSelectPlaceRef.current(null);
      }
    });

    popupRef.current = popup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPlaceId,
    places,
    mapLoaded,
    locale,
    isAuthenticated,
    savedIdsSet,
    routeStops,
    isRoutePanelCollapsed,
    handleStartDirections,
    handleAddToItinerary,
    handleAddStopToRoute,
    handleRemoveStopById,
    handleSetOrigin,
    handleToggleSave,
    hidePopupDirections,
    router,
  ]);

  return (
    <div className="relative h-full w-full bg-[#F5F9FF] overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {hasError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F5F9FF]/95 p-6 text-center">
          <div className="max-w-xs space-y-3 rounded-2xl border border-[#D5E2F0] bg-white p-5 shadow-lg">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <i className="fa-solid fa-triangle-exclamation text-base" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#10243A]">{t("map.initError")}</p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setRetryNonce((n) => n + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] px-4 py-2 text-xs font-bold text-white shadow-[0_2px_8px_rgba(1,148,243,0.3)] transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true" />
              <span>{t("map.retry")}</span>
            </button>
          </div>
        </div>
      )}

      {/* "Search This Area" Pill */}
      {showSearchThisArea && routeStops.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            type="button"
            onClick={() => {
              if (pendingSearchCenter && onSearchThisAreaRef.current) {
                onSearchThisAreaRef.current(pendingSearchCenter);
                lastSearchCenterRef.current = pendingSearchCenter;
                setShowSearchThisArea(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] text-xs font-bold shadow-lg border border-[#D0E7FF] transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <i className="fa-solid fa-magnifying-glass text-xs text-[#0194F3]" aria-hidden="true" />
            <span>{t("map.searchThisArea")}</span>
          </button>
        </div>
      )}

      {/* Floating Multi-Stop Route Control Panel */}
      <RouteControlPanel
        routeStops={routeStops}
        routeMode={routeMode}
        routeResult={routeResult}
        routeLoading={routeLoading}
        locating={locating}
        locale={locale}
        isCollapsed={isRoutePanelCollapsed}
        mapContainerRef={containerRef}
        onToggleCollapse={setIsRoutePanelCollapsed}
        onChangeMode={handleChangeMode}
        onMoveStop={handleMoveStop}
        onRemoveStop={handleRemoveStop}
        onUseMyLocationAsOrigin={handleUseMyLocationAsOrigin}
        onSwapRoute={handleSwapRoute}
        onClearRoute={handleClearRoute}
      />

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onRequestCurrentLocation={onRequestCurrentLocation ? handleRequestLocation : undefined}
        locating={locating}
        currentTheme={currentTheme}
        onChangeTheme={setCurrentTheme}
      />

      {placeForSaveModal && (
        <SaveToCollectionModal
          isOpen={Boolean(placeForSaveModal)}
          onClose={() => setPlaceForSaveModal(null)}
          place={placeForSaveModal}
        />
      )}

      <AddPlaceToItineraryModal
        isOpen={Boolean(placeForItineraryModal)}
        onClose={() => setPlaceForItineraryModal(null)}
        place={placeForItineraryModal}
      />
    </div>
  );
}
