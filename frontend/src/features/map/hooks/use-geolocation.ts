"use client";

import { useState, useCallback } from "react";
import type { MapCoordinate } from "../types";

export type GeolocationStatus = "idle" | "pending" | "success" | "error";

export interface GeolocationState {
  status: GeolocationStatus;
  coordinate: MapCoordinate | null;
  message: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    status: "idle",
    coordinate: null,
    message: null,
  });

  const requestLocation = useCallback(() => {
    setState((prev) => ({ ...prev, status: "pending", message: null }));

    if (typeof window === "undefined" || !navigator.geolocation) {
      setState({
        status: "error",
        coordinate: null,
        message: "Trình duyệt của bạn không hỗ trợ định vị vị trí.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "success",
          coordinate: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          message: null,
        });
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
          reason = "Bạn đã từ chối quyền truy cập vị trí. Hãy bật định vị trên trình duyệt để tìm địa điểm quanh bạn.";
        } else if (isTimeout) {
          reason = "Quá thời gian chờ lấy vị trí từ thiết bị.";
        } else if (isUnavailable) {
          reason = "Vị trí GPS hiện tại không khả dụng.";
        }

        setState({
          status: "error",
          coordinate: null,
          message: reason,
        });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 8000,
      }
    );
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
