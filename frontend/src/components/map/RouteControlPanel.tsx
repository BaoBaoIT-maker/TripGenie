"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type AppLocale } from "@/i18n";
import {
  MAP_CAMERA_CONFIG,
  ROUTE_STOP_ID_USER_LOCATION,
} from "@/features/map/map-config";
import {
  routingService,
  type Coordinate,
  type RouteResult,
  type RouteVehicleMode,
} from "@/services/routing.service";

export interface RouteStop {
  id: string;
  name: string;
  coordinate: Coordinate;
}

export interface RouteControlPanelProps {
  routeStops: RouteStop[];
  routeMode: RouteVehicleMode;
  routeResult: RouteResult | null;
  routeLoading: boolean;
  locating?: boolean;
  locale: AppLocale;
  isCollapsed: boolean;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  onToggleCollapse: (collapsed: boolean) => void;
  onChangeMode: (mode: RouteVehicleMode) => void;
  onMoveStop: (index: number, direction: "up" | "down") => void;
  onRemoveStop: (index: number) => void;
  onUseMyLocationAsOrigin: () => void;
  onSwapRoute: () => void;
  onClearRoute: () => void;
}

const VEHICLE_MODE_KEYS = ["motorcycle", "driving", "walking"] as const;

export function RouteControlPanel({
  routeStops,
  routeMode,
  routeResult,
  routeLoading,
  locating = false,
  locale,
  isCollapsed,
  mapContainerRef,
  onToggleCollapse,
  onChangeMode,
  onMoveStop,
  onRemoveStop,
  onUseMyLocationAsOrigin,
  onSwapRoute,
  onClearRoute,
}: RouteControlPanelProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panelX: number;
    panelY: number;
  }>({
    pointerX: 0,
    pointerY: 0,
    panelX: MAP_CAMERA_CONFIG.ROUTE_PANEL_MARGIN_PX,
    panelY: MAP_CAMERA_CONFIG.ROUTE_PANEL_MARGIN_PX,
  });

  useEffect(() => {
    const margin = MAP_CAMERA_CONFIG.ROUTE_PANEL_MARGIN_PX;

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.pointerX;
      const dy = e.clientY - dragStartRef.current.pointerY;

      let nextX = Math.max(margin, dragStartRef.current.panelX + dx);
      let nextY = Math.max(margin, dragStartRef.current.panelY + dy);

      const containerEl = mapContainerRef.current;
      const panelEl = panelRef.current;
      if (containerEl && panelEl) {
        const maxX = containerEl.clientWidth - panelEl.offsetWidth - margin;
        const maxY = containerEl.clientHeight - panelEl.offsetHeight - margin;
        if (maxX > margin) nextX = Math.min(nextX, maxX);
        if (maxY > margin) nextY = Math.min(nextY, maxY);
      }

      setPanelPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [mapContainerRef]);

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDraggingRef.current = true;
    const margin = MAP_CAMERA_CONFIG.ROUTE_PANEL_MARGIN_PX;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      panelX: panelPos ? panelPos.x : margin,
      panelY: panelPos ? panelPos.y : margin,
    };
  };

  if (routeStops.length < 2) return null;

  const positionStyle = panelPos
    ? { top: `${panelPos.y}px`, left: `${panelPos.x}px` }
    : undefined;

  if (isCollapsed) {
    return (
      <div
        ref={panelRef}
        style={positionStyle}
        onPointerDown={startDrag}
        className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full border border-[#D5E2F0] bg-white py-1.5 px-3 shadow-2xl text-xs font-semibold text-[#10243A] cursor-grab active:cursor-grabbing select-none touch-none"
        title={t("map.routing.dragTitle")}
      >
        <i className="fa-solid fa-grip-vertical text-xs text-slate-400" aria-hidden="true" />
        <div className="flex items-center gap-1.5 text-[#0194F3] font-bold">
          <i className="fa-solid fa-route text-xs" aria-hidden="true" />
          <span>{t("map.routing.titleCount", { count: routeStops.length })}</span>
        </div>
        {routeResult && (
          <span className="text-[#475569] text-[11px] font-medium tabular-nums hidden sm:inline">
            {routingService.formatDistanceKm(routeResult.distanceKm, locale)} • ~
            {routingService.formatDurationMinutes(routeResult.durationMinutes, locale)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggleCollapse(false)}
          className="px-2.5 py-1 rounded-full bg-[#F0F7FF] hover:bg-[#E8F4FD] border border-[#D0E7FF] text-[#0194F3] text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
          title={t("map.routing.expandTitle")}
        >
          <span>{t("map.routing.details")}</span>
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClearRoute}
          className="p-1.5 rounded-full text-slate-500 hover:bg-[#F0F7FF] hover:text-[#0194F3] transition-colors cursor-pointer"
          aria-label={t("map.routing.closeTitle")}
          title={t("map.routing.closeTitle")}
        >
          <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const allModes = routeResult
    ? routingService.getAllModesEstimates(routeResult.distanceKm, locale)
    : null;

  return (
    <div
      ref={panelRef}
      style={positionStyle}
      className="absolute top-3 left-3 right-3 sm:right-auto sm:w-88 md:w-96 z-30 rounded-2xl border border-[#D5E2F0] bg-white p-3.5 shadow-2xl text-[#10243A] space-y-3"
    >
      {/* Drag Header */}
      <div
        className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none touch-none pb-1 border-b border-[#F1F5F9]"
        title={t("map.routing.dragHeaderTitle")}
        onPointerDown={startDrag}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-[#0194F3] uppercase tracking-wider">
          <i className="fa-solid fa-grip-vertical text-xs text-slate-400" aria-hidden="true" />
          <i className="fa-solid fa-route text-xs text-[#0194F3]" aria-hidden="true" />
          <span>{t("map.routing.titleCount", { count: routeStops.length })}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleCollapse(true)}
            className="size-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-[#F0F7FF] hover:text-[#0194F3] transition-colors cursor-pointer"
            aria-label={t("map.routing.collapseTitle")}
            title={t("map.routing.collapseTitle")}
          >
            <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClearRoute}
            className="size-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-[#F0F7FF] hover:text-[#0194F3] transition-colors cursor-pointer"
            aria-label={t("map.routing.closeTitle")}
            title={t("map.routing.closeTitle")}
          >
            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Vehicle Mode Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F8FAFC] p-1 border border-[#E2E8F0]">
        {VEHICLE_MODE_KEYS.map((modeKey) => {
          const config = routingService.VEHICLE_MODES[modeKey];
          const isActive = routeMode === modeKey;
          const est = allModes ? allModes[modeKey] : null;
          return (
            <button
              key={modeKey}
              type="button"
              onClick={() => onChangeMode(modeKey)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? "bg-[#F0F7FF] border-[#D0E7FF] text-[#0194F3] font-bold shadow-2xs"
                  : "border-transparent text-[#475569] hover:bg-[#F0F7FF] hover:text-[#0194F3]"
              }`}
            >
              <i className={`${config.iconClass} text-sm`} aria-hidden="true" />
              <span className="text-[11px] font-semibold mt-1">
                {t(`map.routing.vehicles.${modeKey}`)}
              </span>
              <span
                className={`text-[10px] mt-0.5 tabular-nums ${
                  isActive ? "text-[#0194F3] font-bold" : "text-slate-500"
                }`}
              >
                {routeLoading ? "..." : est ? est.durationText : "--"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ordered Waypoints List (A, B, C...) */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
        {routeStops.map((stop, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isOrigin = idx === 0;
          const isDest = idx === routeStops.length - 1;
          const badgeBg = isOrigin
            ? "bg-emerald-600"
            : isDest
            ? "bg-rose-600"
            : "bg-[#0194F3]";
          const displayStopName =
            stop.id === ROUTE_STOP_ID_USER_LOCATION ? t("map.routing.myLocation") : stop.name;

          return (
            <div
              key={`${stop.id}-${idx}`}
              className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-2.5 py-2 border border-[#E2E8F0] text-xs"
            >
              <span
                className={`size-5 rounded-full ${badgeBg} text-white text-[10px] font-extrabold shrink-0 flex items-center justify-center`}
              >
                {letter}
              </span>
              <span className="flex-1 truncate font-semibold text-[#10243A]">
                {displayStopName}
              </span>

              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => onMoveStop(idx, "up")}
                  className="size-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-[#F0F7FF] hover:text-[#0194F3] transition-colors cursor-pointer"
                  aria-label={t("map.routing.moveUp")}
                  title={t("map.routing.moveUp")}
                >
                  <i className="fa-solid fa-chevron-up text-[10px]" aria-hidden="true" />
                </button>
              )}

              {idx < routeStops.length - 1 && (
                <button
                  type="button"
                  onClick={() => onMoveStop(idx, "down")}
                  className="size-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-[#F0F7FF] hover:text-[#0194F3] transition-colors cursor-pointer"
                  aria-label={t("map.routing.moveDown")}
                  title={t("map.routing.moveDown")}
                >
                  <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onRemoveStop(idx)}
                className="size-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                aria-label={t("map.routing.removeStop")}
                title={t("map.routing.removeStop")}
              >
                <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Actions: From My Location & Reverse */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        {routeStops[0]?.id === ROUTE_STOP_ID_USER_LOCATION ? (
          <span className="inline-flex items-center gap-1.5 text-[#0194F3] font-semibold truncate">
            <i className="fa-solid fa-location-crosshairs text-xs shrink-0" aria-hidden="true" />
            <span className="truncate">{t("map.routing.usingMyLocation")}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onUseMyLocationAsOrigin}
            disabled={Boolean(locating)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E8F4FD] text-[#0194F3] font-semibold border border-[#D0E7FF] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3]"
            title={t("map.routing.fromMyLocationTitle")}
          >
            {locating ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs shrink-0" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-location-crosshairs text-xs shrink-0" aria-hidden="true" />
            )}
            <span>{locating ? t("map.routing.locating") : t("map.routing.fromMyLocation")}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSwapRoute}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] font-semibold border border-[#E2E8F0] hover:border-[#D0E7FF] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3]"
          title={t("map.routing.swapRouteTitle")}
        >
          <i className="fa-solid fa-arrow-right-arrow-left text-xs shrink-0" aria-hidden="true" />
          <span>{t("map.routing.swapRoute")}</span>
        </button>
      </div>

      {/* Distance, ETA & Google Maps Turn-by-Turn Link */}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F0F7FF] border border-[#D0E7FF] px-3 py-2 text-xs">
        {routeLoading ? (
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <i className="fa-solid fa-circle-notch fa-spin text-xs text-[#0194F3]" aria-hidden="true" />
            <span className="text-[11px]">{t("map.routing.drawingRoute")}</span>
          </div>
        ) : routeResult ? (
          <div className="flex items-center gap-1.5 tabular-nums">
            <span className="font-bold text-[#10243A] text-sm">
              {routingService.formatDistanceKm(routeResult.distanceKm, locale)}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-emerald-700">
              ~{routingService.formatDurationMinutes(routeResult.durationMinutes, locale)}
            </span>
          </div>
        ) : (
          <span className="text-slate-600 font-medium">{t("map.routing.noData")}</span>
        )}

        <a
          href={routingService.getGoogleMapsMultiStopUrl(routeStops, routeMode)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-[#0194F3] hover:text-[#0084DE] hover:underline text-xs whitespace-nowrap"
          title={t("map.routing.openGoogleMapsTitle")}
        >
          <span>{t("map.routing.openGoogleMaps")}</span>
          <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
