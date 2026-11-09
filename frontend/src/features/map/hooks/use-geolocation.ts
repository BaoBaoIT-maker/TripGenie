"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { MapCoordinate } from "../types";

export type GeolocationStatus = "idle" | "pending" | "success" | "error";

export interface GeolocationState {
  status: GeolocationStatus;
  coordinate: MapCoordinate | null;
  message: string | null;
}

const STORAGE_KEY_LOCATION = "tripgenie:last_location";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedLocation(): MapCoordinate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      typeof parsed.timestamp === "number"
    ) {
      if (Date.now() - parsed.timestamp < MAX_CACHE_AGE_MS) {
        return {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        };
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>(() => {
    const cached = getCachedLocation();
    return {
      status: cached ? "success" : "idle",
      coordinate: cached,
      message: null,
    };
  });

  const requestLocation = useCallback((showToast: boolean = true) => {
    setState((prev) => ({ ...prev, status: "pending", message: null }));

    if (typeof window === "undefined" || !navigator.geolocation) {
      const msg = "Trình duyệt của bạn không hỗ trợ định vị vị trí.";
      if (showToast) toast.error(msg);
      setState({
        status: "error",
        coordinate: null,
        message: msg,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coord = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setState({
          status: "success",
          coordinate: coord,
          message: null,
        });

        // Persist to localStorage so F5 immediately has distance reference
        try {
          localStorage.setItem(
            STORAGE_KEY_LOCATION,
            JSON.stringify({ ...coord, timestamp: Date.now() })
          );
        } catch {
          // Ignore quota errors
        }

        if (showToast) {
          toast.success("Đã xác định vị trí hiện tại của bạn!");
        }
      },
      (error) => {
        let reason = "Không thể lấy vị trí hiện tại.";
        const isPermissionDenied =
          error.code === 1 ||
          (typeof GeolocationPositionError !== "undefined" &&
            error.code === GeolocationPositionError.PERMISSION_DENIED);
        const isTimeout =
          error.code === 3 ||
          (typeof GeolocationPositionError !== "undefined" &&
            error.code === GeolocationPositionError.TIMEOUT);
        const isUnavailable =
          error.code === 2 ||
          (typeof GeolocationPositionError !== "undefined" &&
            error.code === GeolocationPositionError.POSITION_UNAVAILABLE);

        if (isPermissionDenied) {
          reason =
            "Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép quyền định vị trong cài đặt trình duyệt để tìm địa điểm gần bạn.";
        } else if (isTimeout) {
          reason = "Quá thời gian chờ lấy vị trí từ thiết bị. Vui lòng thử lại.";
        } else if (isUnavailable) {
          reason = "Vị trí GPS hiện tại không khả dụng trên thiết bị.";
        }

        if (showToast) {
          toast.error(reason);
        }
        setState((prev) => ({
          status: prev.coordinate ? "success" : "error",
          coordinate: prev.coordinate,
          message: reason,
        }));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000,
      }
    );
  }, []);

  // Seamless background check: If browser permission is already granted, refresh location silently
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permissionStatus) => {
        if (permissionStatus.state === "granted") {
          requestLocation(false);
        }
      })
      .catch(() => {
        // Ignore permission query errors on unsupported browsers
      });
  }, [requestLocation]);

  return {
    ...state,
    locating: state.status === "pending",
    requestLocation,
  };
}
