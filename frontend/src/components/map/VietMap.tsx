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
import {
  Compass,
  X,
  Loader2,
  ExternalLink,
  ArrowUpDown,
  Search,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
} from "lucide-react";

// Fix Web Worker URL in Next.js / Turbopack
if (typeof window !== "undefined") {
  maplibreConfig.WORKER_URL = "/maplibre-gl-worker.mjs";
}
import { toast } from "sonner";
import type {
  VietMapProps,
  DiscoveryPlace,
  SavedPlace,
  MapCoordinate,
} from "@/features/map/types";
import { DEFAULT_MAP_ZOOM } from "@/features/map/map-config";
import { createPlaceMarkerElement, getMarkerButtonClasses } from "./PlaceMarker";
import { createMapPopupElement } from "./MapPopup";
import { MapControls, type MapStyleTheme } from "./MapControls";
import provincesBoundsData from "@/features/map/vietnam_provinces_bounds.json";
import {
  routingService,
  type RouteVehicleMode,
  type RouteResult,
  type Coordinate,
} from "@/services/routing.service";

export interface RouteStop {
  id: string;
  name: string;
  coordinate: Coordinate;
}

const VIETMAP_API_KEY =
  process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ||
  process.env.NEXT_PUBLIC_VIETMAP_API_KEY ||
  "2666c52efc01d7dc003ee0e7f99832ce958c659a9070a645";

// Multi-layer Map Style (100% official VietMap @2x tiles, no watermarks, no "API key required"):
// 1. Bright / Du lịch (VietMap official @2x tiles — verified 200 image/png) - Mặc định
// 2. Tối / Giao thông (Esri World Dark Gray Canvas — verified 200 image/jpeg + labels)
// 3. Vệ tinh (Esri World Imagery — verified 200 image/jpeg)
const MULTI_LAYER_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "source-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    "source-bright": {
      type: "raster",
      tiles: [
        `https://maps.vietmap.vn/tm/{z}/{x}/{y}@2x.png?apikey=${VIETMAP_API_KEY}`,
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "layer-background",
      type: "background",
      paint: {
        "background-color": "#18181b",
      },
    },
    {
      id: "layer-satellite",
      type: "raster",
      source: "source-satellite",
      layout: { visibility: "none" },
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: "layer-bright",
      type: "raster",
      source: "source-bright",
      layout: { visibility: "visible" },
      minzoom: 0,
      maxzoom: 19,
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
const SAVED_PLACES_STORAGE_KEY = "tripgenie_saved_places";

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
}: VietMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerButtonsMapRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const geocodedMarkerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [hasError, setHasError] = useState(false);
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

  // Multi-Stop Routing State (Unified A -> B -> C...)
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeMode, setRouteMode] = useState<RouteVehicleMode>("motorcycle");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isRoutePanelCollapsed, setIsRoutePanelCollapsed] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingPanelRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number }>({
    mouseX: 0,
    mouseY: 0,
    panelX: 12,
    panelY: 12,
  });
  const routeStopMarkersRef = useRef<Marker[]>([]);
  const pendingDestinationRef = useRef<DiscoveryPlace | null>(null);

  // Saved Places State (Permanent markers ❤️)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const savedMarkersRef = useRef<Marker[]>([]);

  // "Search This Area" Pill State
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [pendingSearchCenter, setPendingSearchCenter] = useState<MapCoordinate | null>(null);

  // Handle Locate User action: fly to user location if available, otherwise request permission
  const handleRequestLocation = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15.5,
        duration: 800,
      });
      toast.success("Đang di chuyển đến vị trí của bạn!");
    }
    if (onRequestCurrentLocation) {
      onRequestCurrentLocation();
    }
  }, [userLocation, onRequestCurrentLocation]);

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

  // Global mousemove and mouseup listeners to drag the route panel freely
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPanelRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const nextX = Math.max(8, dragStartRef.current.panelX + dx);
      const nextY = Math.max(8, dragStartRef.current.panelY + dy);
      setPanelPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingPanelRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // When center prop updates, dismiss "Search This Area" button
  useEffect(() => {
    lastSearchCenterRef.current = center;
    setShowSearchThisArea(false);
  }, [center]);

  // Save savedPlaces to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(savedPlaces));
      } catch (err) {
        console.warn("Failed to persist saved places to localStorage:", err);
      }
    }
  }, [savedPlaces]);


  // Toggle Save Place Handler
  const handleToggleSave = useCallback((place: DiscoveryPlace) => {
    setSavedPlaces((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      if (exists) {
        toast.info(`Đã bỏ lưu "${place.name}"`);
        return prev.filter((p) => p.id !== place.id);
      }
      toast.success(`Đã lưu "${place.name}" vào mục Yêu thích ❤️`);
      return [
        ...prev,
        {
          id: place.id,
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          category: "favorite",
          savedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

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
            : "bg-sky-600";
          const label = isOrigin
            ? `Điểm đi (${letter})`
            : isDest
            ? `Điểm đến (${letter})`
            : `Chặng ${index} (${letter})`;

          const el = document.createElement("div");
          el.className = "flex flex-col items-center -translate-y-1/2 pointer-events-none select-none";
          el.innerHTML = `
            <div class="px-1.5 py-0.5 rounded ${colorBg} text-white text-[10px] font-bold shadow-md mb-0.5 whitespace-nowrap">
              ${label}
            </div>
            <div class="w-6 h-6 rounded-full ${colorBg} border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-[11px]">
              ${letter}
            </div>
          `;

          const marker = new Marker({ element: el })
            .setLngLat([stop.coordinate.longitude, stop.coordinate.latitude])
            .addTo(map);

          routeStopMarkersRef.current.push(marker);
        });

        // Add or update route GeoJSON source
        const sourceId = "tripgenie-route-source";
        const casingLayerId = "tripgenie-route-casing";
        const lineLayerId = "tripgenie-route-line";

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

          // Route line dark casing
          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#1e3a8a",
              "line-width": 7.5,
              "line-opacity": 0.85,
            },
          });

          // Route main vibrant line
          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#2563eb",
              "line-width": 4.5,
              "line-opacity": 0.95,
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
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 90, left: 70, right: 70 },
          duration: 800,
        });
      } catch (err) {
        console.error("Failed to compute multi-stop route:", err);
        toast.error("Không thể tải tuyến đường. Vui lòng thử lại sau.");
      } finally {
        setRouteLoading(false);
      }
    },
    []
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
    if (map.getLayer("tripgenie-route-line")) map.removeLayer("tripgenie-route-line");
    if (map.getLayer("tripgenie-route-casing")) map.removeLayer("tripgenie-route-casing");
    if (map.getSource("tripgenie-route-source")) map.removeSource("tripgenie-route-source");
  }, []);

  // Request directions handler (initiates or replaces destination)
  const handleStartDirections = useCallback(
    (targetPlace: DiscoveryPlace) => {
      if (!userLocation && onRequestCurrentLocation) {
        onRequestCurrentLocation();
      }

      const originCoord = userLocation || { latitude: 16.0544, longitude: 108.2022 };
      const stopA: RouteStop = {
        id: "user-origin",
        name: userLocation ? "Vị trí của bạn" : "Trung tâm thành phố",
        coordinate: originCoord,
      };
      const stopB: RouteStop = {
        id: targetPlace.id,
        name: targetPlace.name,
        coordinate: { latitude: targetPlace.latitude, longitude: targetPlace.longitude },
      };

      const newStops = [stopA, stopB];
      setRouteStops(newStops);
      drawRoute(newStops, routeMode);
    },
    [userLocation, onRequestCurrentLocation, routeMode, drawRoute]
  );

  // Auto-upgrade fallback origin ("Trung tâm thành phố") to actual user location once granted
  useEffect(() => {
    if (!userLocation) return;
    setRouteStops((prev) => {
      if (prev.length < 2) return prev;
      if (prev[0].id === "user-origin" && prev[0].name === "Trung tâm thành phố") {
        const updated = [...prev];
        updated[0] = {
          id: "user-origin",
          name: "Vị trí của bạn",
          coordinate: userLocation,
        };
        toast.info("Đã tự động định vị và cập nhật lộ trình từ vị trí của bạn!");
        return updated;
      }
      return prev;
    });
  }, [userLocation]);

  // Set selected place as the starting origin (Point A)
  const handleSetOrigin = useCallback(
    (place: DiscoveryPlace) => {
      const newOrigin: RouteStop = {
        id: place.id,
        name: place.name,
        coordinate: { latitude: place.latitude, longitude: place.longitude },
      };
      setRouteStops((prev) => {
        if (prev.length === 0) return [newOrigin];
        const updated = [...prev];
        updated[0] = newOrigin;
        return updated;
      });
      toast.success(`Đã đặt "${place.name}" làm điểm xuất phát!`);
    },
    []
  );

    // Add a stop to the existing route — pure state update, drawRoute triggered by reactive effect
  const handleAddStopToRoute = useCallback(
    (place: DiscoveryPlace) => {
      if (!place) return;
      setRouteStops((prev) => {
        if (prev.length === 0) return prev; // no route started yet
        return [
          ...prev,
          {
            id: place.id,
            name: place.name,
            coordinate: { latitude: place.latitude, longitude: place.longitude },
          },
        ];
      });
      toast.success(`Đã thêm "${place.name}" vào chặng dừng!`);
    },
    []
  );

    // Remove a stop — pure state update, reactive effect handles re-draw / clear
  const handleRemoveStop = useCallback(
    (index: number) => {
      setRouteStops((prev) => {
        if (prev.length <= 2) return []; // reactive effect clears layers on []
        return prev.filter((_, idx) => idx !== index);
      });
    },
    []
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
      drawRoute(routeStops, routeMode);
    } else if (routeStops.length === 0) {
      const map = mapRef.current;
      if (map) {
        if (map.getLayer("tripgenie-route-line")) map.removeLayer("tripgenie-route-line");
        if (map.getLayer("tripgenie-route-casing")) map.removeLayer("tripgenie-route-casing");
        if (map.getSource("tripgenie-route-source")) map.removeSource("tripgenie-route-source");
      }
      routeStopMarkersRef.current.forEach((m) => m.remove());
      routeStopMarkersRef.current = [];
      setRouteResult(null);
    }
  }, [routeStops, routeMode, drawRoute]);

    // If user requests routing directly to a pinned location
  useEffect(() => {
    if (routeToPinRequest) {
      handleStartDirections({
        id: "pinned-pin",
        slug: "pinned-pin",
        name: routeToPinRequest.name,
        latitude: routeToPinRequest.latitude,
        longitude: routeToPinRequest.longitude,
        category: "custom",
        categoryLabel: "Vị trí đã ghim",
        areaSlug: "danang",
        areaName: "Đà Nẵng",
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
  }, [routeToPinRequest, handleStartDirections]);

  // Switch raster tile layers when theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const isSatellite = currentTheme === "satellite";

    if (map.getLayer("layer-bright")) {
      map.setLayoutProperty("layer-bright", "visibility", isSatellite ? "none" : "visible");
    }
    if (map.getLayer("layer-satellite")) {
      map.setLayoutProperty("layer-satellite", "visibility", isSatellite ? "visible" : "none");
    }
  }, [currentTheme, mapLoaded]);

  // Map initialization
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const map = new MapLibreMap({
        container: containerRef.current,
        style: MULTI_LAYER_MAP_STYLE,
        center: [initialCenterRef.current.longitude, initialCenterRef.current.latitude],
        zoom: DEFAULT_MAP_ZOOM,
      });

      map.on("load", () => {
        setMapLoaded(true);

        // Load 34 Provinces GeoJSON boundary overlay
        try {
          if (!map.getSource("vietnam-provinces")) {
            map.addSource("vietnam-provinces", {
              type: "geojson",
              data: "/data/vietnam_34_tinhthanh.geojson",
            });

            // Fill layer for province highlight
            map.addLayer({
              id: "vietnam-provinces-fill",
              type: "fill",
              source: "vietnam-provinces",
              paint: {
                "fill-color": "#3b82f6",
                "fill-opacity": 0.0,
              },
            });

            // Stroke line layer for provincial borders
            map.addLayer({
              id: "vietnam-provinces-line",
              type: "line",
              source: "vietnam-provinces",
              paint: {
                "line-color": "#2563eb",
                "line-width": 1.5,
                "line-opacity": 0.5,
              },
            });
          }
        } catch (layerErr) {
          console.warn("Could not load GeoJSON layers:", layerErr);
        }
      });

      // Listen to Pan/Move to show "Search This Area" if user pans far (> 1.2km)
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
          if (distFromLast > 1.2) {
            setShowSearchThisArea(true);
            setPendingSearchCenter({ latitude: c.lat, longitude: c.lng });
          } else {
            setShowSearchThisArea(false);
          }
        }
      });

      // Map Click Handler: Drop Pin or Deselect
      map.on("click", (e) => {

        const originalEvent = e.originalEvent as MouseEvent;
        const target = originalEvent?.target as HTMLElement | null;
        if (target && !target.closest(".marker-container") && !target.closest(".maplibregl-popup")) {
          onSelectPlaceRef.current(null);
          if (onMapClickDropPinRef.current) {
            onMapClickDropPinRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }
        }
      });

      map.on("error", (e) => {
        const msg = (e as any)?.error?.message || (e as any)?.message;
        if (msg) {
          console.warn("VietMap / MapLibre error:", msg);
        }
      });

      mapRef.current = map;

      return () => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        savedMarkersRef.current.forEach((m) => m.remove());
        savedMarkersRef.current = [];
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
          popupRef.current.remove();
          popupRef.current = null;
        }
        map.remove();
        mapRef.current = null;
        setMapLoaded(false);
      };
    } catch (err) {
      console.error("Failed to initialize VietMap:", err);
      setTimeout(() => setHasError(true), 0);
    }
  }, []);

  // Update Highlight and FitBounds when selectedProvinceName changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer("vietnam-provinces-fill")) {
      map.setPaintProperty("vietnam-provinces-fill", "fill-opacity", [
        "case",
        ["==", ["get", "ten_tinh"], selectedProvinceName || ""],
        0.18,
        0.0,
      ]);
    }

    if (selectedProvinceName && boundsMap[selectedProvinceName]) {
      const b = boundsMap[selectedProvinceName];
      if (places.length === 0) {
        map.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 40, maxZoom: 14, duration: 800 }
        );
      }
    }
  }, [selectedProvinceName, mapLoaded, places.length]);

  // Update User Location Marker (GPS)
  // Update User Location Marker (GPS) and center map
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
        <div class="absolute h-8 w-8 rounded-full bg-blue-500/25 animate-ping"></div>
        <div class="h-4.5 w-4.5 rounded-full border-2 border-white bg-blue-600 shadow-lg"></div>
      `;

      const marker = new Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;

      // Smoothly fly map to user's location
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15.5,
        duration: 800,
      });
    }
  }, [userLocation]);

  // Display Draggable Geocoded Pin (Google Maps Draggable Marker)
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
        <div class="px-2.5 py-1 rounded-full bg-background/95 border border-border/80 text-foreground text-[11px] font-bold shadow-lg mb-1.5 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md transition-transform group-hover:scale-105">
          <span class="size-1.5 rounded-full bg-rose-500 animate-ping"></span>
          <span class="max-w-[200px] truncate">${geocodedPin.displayName || "Vị trí đã ghim"}</span>
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
        zoom: 15.5,
        duration: 900,
      });
    }
  }, [geocodedPin]);

  // Render Saved Places Layer (Permanent ❤️ Markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    savedMarkersRef.current.forEach((m) => m.remove());
    savedMarkersRef.current = [];

    savedPlaces.forEach((saved) => {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center cursor-pointer select-none group z-30";
      el.innerHTML = `
        <div class="size-6 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] group-hover:scale-125 transition-transform">
          ❤️
        </div>
      `;

      const marker = new Marker({ element: el })
        .setLngLat([saved.longitude, saved.latitude])
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        map.flyTo({ center: [saved.longitude, saved.latitude], zoom: 15.5, duration: 500 });
      });

      savedMarkersRef.current.push(marker);
    });
  }, [savedPlaces]);

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
      const { container, button } = createPlaceMarkerElement(item, {
        selected: false,
        hovered: false,
        onSelect: () => {
          onSelectPlace(place.id);
        },
      });

      markerButtonsMapRef.current.set(place.id, button);

      const marker = new Marker({ element: container })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;

    // Auto fit bounds ONCE when places change (never on hover!)
    if (places.length > 0) {
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
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
      } catch {
        // ignore bounds calculation error
      }
    }
  }, [places, onSelectPlace, geocodedPin]);

  // Smooth, instant marker hover and selection update
  useEffect(() => {
    const buttonsMap = markerButtonsMapRef.current;
    buttonsMap.forEach((button, placeId) => {
      const isSelected = placeId === selectedPlaceId;
      const isHovered = placeId === hoveredPlaceId;
      button.className = getMarkerButtonClasses(isSelected, isHovered, button.dataset.categoryBg);
      button.dataset.active = isSelected ? "true" : "false";
    });
  }, [selectedPlaceId, hoveredPlaceId]);

  // Center on selected place & show popup (with Quick Save & Multi-stop Add options)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedPlaceId) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }

    const targetItem = places.find((item) => {
      const p = "place" in item ? (item.place as DiscoveryPlace) : item;
      return p.id === selectedPlaceId;
    });
    if (!targetItem) return;
    const targetPlace = "place" in targetItem ? (targetItem.place as DiscoveryPlace) : targetItem;

    map.flyTo({
      center: [targetPlace.longitude, targetPlace.latitude],
      zoom: Math.max(map.getZoom(), 15),
      offset: routeStops.length >= 2 && !isRoutePanelCollapsed ? [130, 0] : [0, 0],
      duration: 600,
    });

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    const isSaved = savedPlaces.some((p) => p.id === targetPlace.id);

    const popupEl = createMapPopupElement(
      targetItem,
      (placeId) => {
        router.push(`/places/${targetPlace.slug || placeId}`);
      },
      (targetPlace) => handleStartDirections(targetPlace),
      {
        isRoutingActive: routeStops.length >= 2,
        isSaved,
        onToggleSave: handleToggleSave,
        onAddStopToRoute: handleAddStopToRoute,
        onSetOrigin: handleSetOrigin,
      }
    );

    const popup = new Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 20,
      maxWidth: "320px",
    })
      .setLngLat([targetPlace.longitude, targetPlace.latitude])
      .setDOMContent(popupEl)
      .addTo(map);

    popup.on("close", () => {
      if (selectedPlaceIdRef.current === targetPlace.id) {
        onSelectPlaceRef.current(null);
      }
    });

    popupRef.current = popup;
  }, [
    selectedPlaceId,
    places,
    savedPlaces,
    routeStops.length,
    isRoutePanelCollapsed,
    handleStartDirections,
    handleAddStopToRoute,
    handleSetOrigin,
    handleToggleSave,
  ]);

  return (
    <div
      className={`relative h-full w-full bg-zinc-950 overflow-hidden ${
        currentTheme === "dark" ? "theme-dark-map" : ""
      }`}
    >
      {currentTheme === "dark" && (
        <style>{`
          .theme-dark-map .maplibregl-canvas {
            filter: invert(92%) hue-rotate(180deg) brightness(88%) contrast(105%) !important;
          }
        `}</style>
      )}
      <div ref={containerRef} className="h-full w-full" />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 p-4 text-center text-sm text-destructive">
          Không thể khởi tạo bản đồ VietMap. Vui lòng kiểm tra kết nối mạng và API Key.
        </div>
      )}

      {/* "Search This Area" Pill (Google Maps Style) */}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/95 hover:bg-background text-foreground text-xs font-bold shadow-xl border border-border/80 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-primary/20"
          >
            <Search className="size-3.5 text-primary" />
            <span>Tìm kiếm khu vực này</span>
          </button>
        </div>
      )}

      {/* Floating Multi-Stop Route Control Panel (Google Maps Style) */}
      {routeStops.length >= 2 &&
        (isRoutePanelCollapsed ? (
          // Compact Collapsed Pill Bar (Draggable)
          <div
            style={panelPos ? { top: `${panelPos.y}px`, left: `${panelPos.x}px` } : undefined}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              isDraggingPanelRef.current = true;
              const curX = panelPos ? panelPos.x : 12;
              const curY = panelPos ? panelPos.y : 12;
              dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: curX, panelY: curY };
            }}
            className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full border border-border/80 bg-background/95 py-1.5 px-3 shadow-2xl backdrop-blur-md text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 cursor-grab active:cursor-grabbing select-none"
            title="Kéo thả để di chuyển vị trí"
          >
            <GripHorizontal className="size-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <Compass className="size-4" />
              <span>Chỉ đường ({routeStops.length} chặng)</span>
            </div>
            {routeResult && (
              <span className="text-muted-foreground text-[11px] font-medium hidden sm:inline">
                {routingService.formatDistanceKm(routeResult.distanceKm)} • ~{routingService.formatDurationMinutes(routeResult.durationMinutes)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsRoutePanelCollapsed(false)}
              className="px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Mở rộng bảng chỉ đường"
            >
              <span>Chi tiết</span>
              <ChevronDown className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleClearRoute}
              className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Đóng chỉ đường"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          // Full Expanded Route Control Panel (Draggable)
          <div
            style={panelPos ? { top: `${panelPos.y}px`, left: `${panelPos.x}px` } : undefined}
            className="absolute top-3 left-3 right-3 sm:right-auto sm:w-88 md:w-96 z-30 rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Header with Drag Handle, Title, Collapse button, and Close button */}
            <div
              className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none pb-1"
              title="Nhấn giữ và kéo để di chuyển bảng chỉ đường"
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                isDraggingPanelRef.current = true;
                const curX = panelPos ? panelPos.x : 12;
                const curY = panelPos ? panelPos.y : 12;
                dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: curX, panelY: curY };
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                <GripHorizontal className="size-4 text-muted-foreground" />
                <Compass className="size-4" />
                <span>Chỉ đường ({routeStops.length} chặng)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsRoutePanelCollapsed(true)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Thu gọn bảng (Xem trọn vẹn bản đồ)"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClearRoute}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Đóng chỉ đường"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

          {/* Vehicle Mode Tabs with live ETA under each icon */}
          {(() => {
            const allModes = routeResult
              ? routingService.getAllModesEstimates(routeResult.distanceKm)
              : null;
            return (
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1.5 border border-border/60">
                {(["motorcycle", "driving", "walking"] as const).map((m) => {
                  const config = routingService.VEHICLE_MODES[m];
                  const isActive = routeMode === m;
                  const est = allModes ? allModes[m] : null;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleChangeMode(m)}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "bg-background text-foreground shadow-sm font-semibold border border-border/80"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <span className="text-base">{config.icon}</span>
                      <span className="text-[11px] font-medium mt-0.5">{config.label}</span>
                      <span
                        className={`text-[10px] mt-0.5 ${
                          isActive ? "text-primary font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {routeLoading ? "..." : est ? est.durationText : "--"}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Stops List (A, B, C...) with reorder and delete actions */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {routeStops.map((stop, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isOrigin = idx === 0;
              const isDest = idx === routeStops.length - 1;
              const letterColor = isOrigin
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : isDest
                ? "text-rose-600 dark:text-rose-400 font-extrabold"
                : "text-sky-600 dark:text-sky-400 font-extrabold";

              return (
                <div
                  key={stop.id + idx}
                  className="flex items-center gap-1.5 rounded-xl bg-muted/40 p-2 border border-border/50 text-xs"
                >
                  <span className={`w-5 text-center text-xs ${letterColor}`}>{letter}</span>
                  <span className="flex-1 truncate font-medium text-foreground">
                    {stop.name}
                  </span>

                  {/* Move Up */}
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMoveStop(idx, "up")}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Chuyển lên trước"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                  )}

                  {/* Move Down */}
                  {idx < routeStops.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMoveStop(idx, "down")}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Chuyển xuống sau"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  )}

                  {/* Remove Stop */}
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(idx)}
                    className="p-1 rounded hover:bg-rose-100 hover:text-rose-600 text-muted-foreground transition-colors cursor-pointer"
                    title="Xóa chặng này"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Action Buttons: Add Stop tip & Swap all stops */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px]">
            <span className="text-muted-foreground italic truncate">
              💡 Bấm vào quán trên bản đồ để thêm chặng
            </span>
            <button
              type="button"
              onClick={handleSwapRoute}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-semibold border border-border/40 transition-colors cursor-pointer whitespace-nowrap"
              title="Đổi chiều lộ trình (Đảo ngược tất cả các chặng)"
            >
              <ArrowUpDown className="size-3" />
              <span>Đổi chiều</span>
            </button>
          </div>

          {/* Distance, ETA and Google Maps Navigation link */}
          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
            {routeLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-0.5">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span className="text-[11px]">Đang vẽ tuyến đường...</span>
              </div>
            ) : routeResult ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground text-sm">
                  {routingService.formatDistanceKm(routeResult.distanceKm)}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ~{routingService.formatDurationMinutes(routeResult.durationMinutes)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Chưa có dữ liệu</span>
            )}

            <a
              href={routingService.getGoogleMapsMultiStopUrl(routeStops, routeMode)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
              title="Mở ứng dụng Google Maps để dẫn đường bằng giọng nói"
            >
              <span>Mở Google Maps</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      ))}

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onRequestCurrentLocation={handleRequestLocation}
        locating={locating}
        currentTheme={currentTheme}
        onChangeTheme={setCurrentTheme}
      />
    </div>
  );
}
