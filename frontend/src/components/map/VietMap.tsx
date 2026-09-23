"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  LngLatBounds,
  config as maplibreConfig,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import { Compass, X, Loader2, ExternalLink, ArrowUpDown } from "lucide-react";

// Fix Web Worker URL in Next.js / Turbopack
if (typeof window !== "undefined") {
  maplibreConfig.WORKER_URL = "/maplibre-gl-worker.mjs";
}
import { toast } from "sonner";
import type { VietMapProps, DiscoveryPlace } from "@/features/map/types";
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

const VIETMAP_API_KEY =
  process.env.NEXT_PUBLIC_VIETMAP_TILEMAP_KEY ||
  process.env.NEXT_PUBLIC_VIETMAP_API_KEY ||
  "2666c52efc01d7dc003ee0e7f99832ce958c659a9070a645";

// Multi-layer Map Style (100% official VietMap @2x tiles, no watermarks, no "API key required"):
// 1. Bright / Du lịch (VietMap tm @2x - Vibrant blue seas, cream land, green parks, yellow streets) - Mặc định
// 2. Tối / Giao thông (VietMap dm @2x - High-contrast dark grey theme)
// 3. Vệ tinh (Esri World Imagery - High-res aerial imagery)
const MULTI_LAYER_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "source-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri World Imagery",
      maxzoom: 19,
    },
    "source-dark": {
      type: "raster",
      tiles: [
        VIETMAP_API_KEY
          ? `https://maps.vietmap.vn/api/dm/{z}/{x}/{y}@2x.png?apikey=${VIETMAP_API_KEY}`
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© VietMap",
      maxzoom: 19,
    },
    "source-bright": {
      type: "raster",
      tiles: [
        VIETMAP_API_KEY
          ? `https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=${VIETMAP_API_KEY}`
          : "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© VietMap",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "layer-satellite",
      type: "raster",
      source: "source-satellite",
      layout: { visibility: "none" },
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: "layer-dark",
      type: "raster",
      source: "source-dark",
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
}: VietMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerButtonsMapRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [hasError, setHasError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<MapStyleTheme>("bright");

  const onViewportChangeRef = useRef(onViewportChange);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const initialCenterRef = useRef(center);
  const selectedPlaceIdRef = useRef(selectedPlaceId);

  // Routing State
  const [routeOrigin, setRouteOrigin] = useState<{ name: string; coordinate: Coordinate } | null>(null);
  const [routeDestination, setRouteDestination] = useState<DiscoveryPlace | null>(null);
  const [routeMode, setRouteMode] = useState<RouteVehicleMode>("motorcycle");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const pendingDestinationRef = useRef<DiscoveryPlace | null>(null);
  const routeOriginMarkerRef = useRef<Marker | null>(null);
  const routeDestMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
  }, [selectedPlaceId]);

  // Method to calculate and render route line on map
  const calculateAndDrawRoute = useCallback(
    async (
      origin: { latitude: number; longitude: number },
      dest: DiscoveryPlace,
      mode: RouteVehicleMode,
      originName: string = "Vị trí của bạn"
    ) => {
      setRouteOrigin({ name: originName, coordinate: origin });
      setRouteDestination(dest);
      setRouteLoading(true);

      // Close open popup so it does not obstruct the route visualization
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      try {
        const res = await routingService.fetchRoute(
          origin,
          { latitude: dest.latitude, longitude: dest.longitude },
          mode
        );
        setRouteResult(res);

        if (!mapRef.current) return;
        const map = mapRef.current;

        // Render Start (A) and End (B) pin markers
        if (routeOriginMarkerRef.current) {
          routeOriginMarkerRef.current.remove();
          routeOriginMarkerRef.current = null;
        }
        if (routeDestMarkerRef.current) {
          routeDestMarkerRef.current.remove();
          routeDestMarkerRef.current = null;
        }

        const elA = document.createElement("div");
        elA.className = "flex flex-col items-center -translate-y-1/2 pointer-events-none select-none";
        elA.innerHTML = `
          <div class="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-md mb-0.5 whitespace-nowrap">
            Điểm đi (A)
          </div>
          <div class="w-6 h-6 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-[11px]">
            A
          </div>
        `;
        routeOriginMarkerRef.current = new Marker({ element: elA })
          .setLngLat([origin.longitude, origin.latitude])
          .addTo(map);

        const elB = document.createElement("div");
        elB.className = "flex flex-col items-center -translate-y-1/2 pointer-events-none select-none";
        elB.innerHTML = `
          <div class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold shadow-md mb-0.5 whitespace-nowrap">
            Điểm đến (B)
          </div>
          <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-[11px]">
            B
          </div>
        `;
        routeDestMarkerRef.current = new Marker({ element: elB })
          .setLngLat([dest.longitude, dest.latitude])
          .addTo(map);

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

        // Fit map bounds to encompass the entire route
        const bounds = new LngLatBounds();
        bounds.extend([origin.longitude, origin.latitude]);
        bounds.extend([dest.longitude, dest.latitude]);
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
        console.error("Failed to compute route:", err);
        toast.error("Không thể tải tuyến đường. Vui lòng thử lại sau.");
      } finally {
        setRouteLoading(false);
      }
    },
    []
  );

  // Clear route from map and reset state
  const handleClearRoute = useCallback(() => {
    if (routeOriginMarkerRef.current) {
      routeOriginMarkerRef.current.remove();
      routeOriginMarkerRef.current = null;
    }
    if (routeDestMarkerRef.current) {
      routeDestMarkerRef.current.remove();
      routeDestMarkerRef.current = null;
    }
    setRouteOrigin(null);
    setRouteDestination(null);
    setRouteResult(null);
    pendingDestinationRef.current = null;
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("tripgenie-route-line")) map.removeLayer("tripgenie-route-line");
    if (map.getLayer("tripgenie-route-casing")) map.removeLayer("tripgenie-route-casing");
    if (map.getSource("tripgenie-route-source")) map.removeSource("tripgenie-route-source");
  }, []);

  // Request directions handler
  const handleStartDirections = useCallback(
    (targetPlace: DiscoveryPlace) => {
      if (userLocation) {
        calculateAndDrawRoute(userLocation, targetPlace, routeMode, "Vị trí của bạn");
      } else {
        pendingDestinationRef.current = targetPlace;
        toast.info("Đang lấy vị trí của bạn để tính đường đi...");
        onRequestCurrentLocation();
      }
    },
    [userLocation, routeMode, calculateAndDrawRoute, onRequestCurrentLocation]
  );

  // Switch vehicle mode
  const handleChangeMode = useCallback(
    (newMode: RouteVehicleMode) => {
      setRouteMode(newMode);
      if (routeDestination) {
        const originCoord = routeOrigin?.coordinate || userLocation;
        if (originCoord) {
          calculateAndDrawRoute(
            originCoord,
            routeDestination,
            newMode,
            routeOrigin?.name || "Vị trí của bạn"
          );
        }
      }
    },
    [routeOrigin, userLocation, routeDestination, calculateAndDrawRoute]
  );

  // Swap origin and destination (like Google Maps ⇅ button)
  const handleSwapRoute = useCallback(() => {
    if (!routeDestination) return;
    const currentOrigin =
      routeOrigin || (userLocation ? { name: "Vị trí của bạn", coordinate: userLocation } : null);
    if (!currentOrigin) return;

    const newOrigin = {
      name: routeDestination.name,
      coordinate: { latitude: routeDestination.latitude, longitude: routeDestination.longitude },
    };
    const newDest: DiscoveryPlace = {
      ...routeDestination,
      name: currentOrigin.name,
      latitude: currentOrigin.coordinate.latitude,
      longitude: currentOrigin.coordinate.longitude,
    };

    calculateAndDrawRoute(newOrigin.coordinate, newDest, routeMode, newOrigin.name);
  }, [routeOrigin, routeDestination, userLocation, routeMode, calculateAndDrawRoute]);

  // If waiting for GPS, compute route once userLocation is received
  useEffect(() => {
    if (userLocation && pendingDestinationRef.current) {
      const dest = pendingDestinationRef.current;
      pendingDestinationRef.current = null;
      calculateAndDrawRoute(userLocation, dest, routeMode, "Vị trí của bạn");
    }
  }, [userLocation, routeMode, calculateAndDrawRoute]);

  // Switch raster tile layers when theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const layers = ["layer-bright", "layer-dark", "layer-satellite"] as const;
    const target = `layer-${currentTheme}`;
    for (const l of layers) {
      if (map.getLayer(l)) {
        map.setLayoutProperty(l, "visibility", l === target ? "visible" : "none");
      }
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
          console.warn("Could not load GeoJSON boundary layer:", layerErr);
        }
      });

      map.on("moveend", () => {
        const c = map.getCenter();
        onViewportChangeRef.current({
          latitude: c.lat,
          longitude: c.lng,
          zoom: map.getZoom(),
        });
      });

      map.on("click", (e) => {
        const originalEvent = e.originalEvent as MouseEvent;
        const target = originalEvent?.target as HTMLElement | null;
        if (target && !target.closest(".marker-container") && !target.closest(".maplibregl-popup")) {
          onSelectPlaceRef.current(null);
        }
      });

      map.on("error", (e) => {
        console.warn("VietMap / MapLibre event:", e);
      });

      mapRef.current = map;

      return () => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        if (routeOriginMarkerRef.current) {
          routeOriginMarkerRef.current.remove();
          routeOriginMarkerRef.current = null;
        }
        if (routeDestMarkerRef.current) {
          routeDestMarkerRef.current.remove();
          routeDestMarkerRef.current = null;
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
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement("div");
      el.className = "relative flex items-center justify-center";
      el.innerHTML = `
        <div class="absolute h-8 w-8 rounded-full bg-blue-500/20 animate-ping"></div>
        <div class="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-md"></div>
      `;

      const marker = new Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      userMarkerRef.current = marker;
    }
  }, [userLocation]);

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
      try {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 600 });
      } catch {
        // ignore bounds calculation error
      }
    }
  }, [places, onSelectPlace]);

  // Smooth, instant marker hover and selection update (zero map jerking or displacement)
  useEffect(() => {
    const buttonsMap = markerButtonsMapRef.current;
    buttonsMap.forEach((button, placeId) => {
      const isSelected = placeId === selectedPlaceId;
      const isHovered = placeId === hoveredPlaceId;
      button.className = getMarkerButtonClasses(isSelected, isHovered);
      button.dataset.active = isSelected ? "true" : "false";
    });
  }, [selectedPlaceId, hoveredPlaceId]);

  // Center on selected place & show popup (dismiss when null)
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
      duration: 600,
    });

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    const popupEl = createMapPopupElement(
      targetItem,
      undefined,
      (targetPlace) => handleStartDirections(targetPlace)
    );

    const popup = new Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 20,
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
  }, [selectedPlaceId, places, handleStartDirections]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 p-4 text-center text-sm text-destructive">
          Không thể khởi tạo bản đồ VietMap. Vui lòng kiểm tra kết nối mạng và API Key.
        </div>
      )}

      {/* Floating Route Control Panel (Google Maps Style as in media_1790163535832) */}
      {routeDestination && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-88 md:w-96 z-30 rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header with Title and Close button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
              <Compass className="size-4" />
              <span>Chỉ đường</span>
            </div>
            <button
              type="button"
              onClick={handleClearRoute}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Đóng chỉ đường"
            >
              <X className="size-4" />
            </button>
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

          {/* Origin and Destination rows with vertical connector and Swap button */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 border border-border/50">
            {/* Visual connector */}
            <div className="flex flex-col items-center justify-center py-1 self-stretch">
              <div className="size-2.5 rounded-full border-2 border-emerald-500 bg-white dark:bg-zinc-900" />
              <div className="w-0.5 flex-1 min-h-5 border-l-2 border-dashed border-muted-foreground/40 my-1" />
              <div className="size-2.5 rounded-full bg-rose-500" />
            </div>

            {/* Inputs labels */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1 text-xs border border-border/40 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">A</span>
                <span className="truncate text-foreground font-medium">
                  {routeOrigin?.name || "Vị trí của bạn"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1 text-xs border border-border/40 shadow-2xs">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">B</span>
                <span className="truncate text-foreground font-medium">
                  {routeDestination.name}
                </span>
              </div>
            </div>

            {/* Swap Button (⇅) */}
            <button
              type="button"
              onClick={handleSwapRoute}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors cursor-pointer"
              title="Đổi chiều đi (A ⇄ B)"
            >
              <ArrowUpDown className="size-4" />
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
              href={routingService.getGoogleMapsDirectionsUrl(
                routeOrigin?.coordinate || userLocation || null,
                { latitude: routeDestination.latitude, longitude: routeDestination.longitude },
                routeMode,
                routeDestination.name
              )}
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
      )}

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onRequestCurrentLocation={onRequestCurrentLocation}
        locating={locating}
        currentTheme={currentTheme}
        onChangeTheme={setCurrentTheme}
      />
    </div>
  );
}
