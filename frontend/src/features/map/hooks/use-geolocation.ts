"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
      const msg = "Trình duyệt của bạn không hỗ trợ định vị vị trí.";
      toast.error(msg);
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
        toast.success("Đã xác định vị trí hiện tại của bạn!");
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
          reason = "Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép quyền định vị trong cài đặt trình duyệt để tìm địa điểm gần bạn.";
        } else if (isTimeout) {
          reason = "Quá thời gian chờ lấy vị trí từ thiết bị. Vui lòng thử lại.";
        } else if (isUnavailable) {
          reason = "Vị trí GPS hiện tại không khả dụng trên thiết bị.";
        }

        toast.error(reason);
        setState({
          status: "error",
          coordinate: null,
          message: reason,
        });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000,
      }
    );
  }, []);

  return {
    ...state,
    locating: state.status === "pending",
    requestLocation,
  };
}
