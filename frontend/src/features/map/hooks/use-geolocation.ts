"use client";

import { useState, useCallback } from "react";
import type { MapCoordinate } from "../types";
import { DEFAULT_MAP_CENTER } from "../map-config";

export type GeolocationStatus = "idle" | "pending" | "success" | "fallback";

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
    setState((prev) => ({ ...prev, status: "pending" }));

    if (typeof window === "undefined" || !navigator.geolocation) {
      setState({
        status: "fallback",
        coordinate: DEFAULT_MAP_CENTER,
        message: "Trình duyệt không hỗ trợ định vị vị trí. Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.",
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
        if (error.code === error.PERMISSION_DENIED) {
          reason = "Bạn đã từ chối quyền truy cập vị trí.";
        } else if (error.code === error.TIMEOUT) {
          reason = "Quá thời gian chờ lấy vị trí.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          reason = "Vị trí hiện tại không khả dụng.";
        }

        setState({
          status: "fallback",
          coordinate: DEFAULT_MAP_CENTER,
          message: `${reason} Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.`,
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
