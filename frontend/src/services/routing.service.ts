import { distance, point } from "@turf/turf";

export type RouteVehicleMode = "motorcycle" | "driving" | "walking";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: GeoJSON.LineString;
  mode: RouteVehicleMode;
  origin: Coordinate;
  destination: Coordinate;
  fallback?: boolean;
}

export interface VehicleModeConfig {
  id: RouteVehicleMode;
  label: string;
  icon: string;
  osrmProfile: string;
  averageSpeedKmH: number;
  googleMapsMode: string;
}

export const VEHICLE_MODES: Record<RouteVehicleMode, VehicleModeConfig> = {
  motorcycle: {
    id: "motorcycle",
    label: "Xe máy",
    icon: "🏍️",
    osrmProfile: "bike", // Tận dụng ngõ hẹp, lối tắt, tránh cao tốc cấm xe máy
    averageSpeedKmH: 35,
    googleMapsMode: "two_wheeler",
  },
  driving: {
    id: "driving",
    label: "Ô tô",
    icon: "🚗",
    osrmProfile: "driving", // Tuân thủ đường 1 chiều, cấm ô tô
    averageSpeedKmH: 30,
    googleMapsMode: "driving",
  },
  walking: {
    id: "walking",
    label: "Đi bộ",
    icon: "🚶",
    osrmProfile: "foot", // Lối đi bộ, công viên, bậc thang
    averageSpeedKmH: 4.5,
    googleMapsMode: "walking",
  },
};

/**
 * Tính khoảng cách đường chim bay tức thì bằng Turf.js (0ms)
 */
export function calculateDirectDistanceKm(coord1: Coordinate, coord2: Coordinate): number {
  if (
    !coord1 ||
    !coord2 ||
    isNaN(coord1.latitude) ||
    isNaN(coord1.longitude) ||
    isNaN(coord2.latitude) ||
    isNaN(coord2.longitude)
  ) {
    return 0;
  }
  const from = point([coord1.longitude, coord1.latitude]);
  const to = point([coord2.longitude, coord2.latitude]);
  return distance(from, to, { units: "kilometers" });
}

/**
 * Định dạng cự ly hiển thị (ví dụ: "850 m" hoặc "3.2 km")
 */
export function formatDistanceKm(value: number): string {
  if (value < 1) {
    return `${Math.round(value * 1000)} m`;
  }
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)} km`;
}

/**
 * Định dạng thời gian di chuyển (ví dụ: "8 phút" hoặc "1 giờ 15 phút")
 */
export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) {
    return `${rounded} phút`;
  }
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  if (remainingMinutes === 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${remainingMinutes} phút`;
}

/**
 * Tính toán thời gian thực tế phù hợp với từng phương tiện tại Việt Nam
 */
export function computeRealisticDurationMinutes(
  distanceKm: number,
  mode: RouteVehicleMode = "motorcycle"
): number {
  if (distanceKm <= 0) return 0;
  switch (mode) {
    case "motorcycle":
      // Vận tốc xe máy tại Việt Nam trong đô thị ~32 km/h
      return (distanceKm / 32) * 60;
    case "driving":
      // Vận tốc ô tô trong đô thị ~24 km/h (đèn đỏ, phân làn, đường 1 chiều)
      return (distanceKm / 24) * 60;
    case "walking":
      // Vận tốc đi bộ ~4.5 km/h
      return (distanceKm / 4.5) * 60;
    default:
      return (distanceKm / 30) * 60;
  }
}

/**
 * Lấy ước tính thời gian cho tất cả phương tiện cùng lúc (để hiển thị dưới icon như Google Maps)
 */
export function getAllModesEstimates(distanceKm: number): Record<
  RouteVehicleMode,
  { distanceKm: number; durationMinutes: number; durationText: string }
> {
  return {
    motorcycle: {
      distanceKm,
      durationMinutes: computeRealisticDurationMinutes(distanceKm, "motorcycle"),
      durationText: formatDurationMinutes(computeRealisticDurationMinutes(distanceKm, "motorcycle")),
    },
    driving: {
      distanceKm,
      durationMinutes: computeRealisticDurationMinutes(distanceKm, "driving"),
      durationText: formatDurationMinutes(computeRealisticDurationMinutes(distanceKm, "driving")),
    },
    walking: {
      distanceKm,
      durationMinutes: computeRealisticDurationMinutes(distanceKm, "walking"),
      durationText: formatDurationMinutes(computeRealisticDurationMinutes(distanceKm, "walking")),
    },
  };
}

/**
 * Ước tính thời gian di chuyển theo khoảng cách và phương tiện
 */
export function estimateDurationMinutes(
  distanceKm: number,
  mode: RouteVehicleMode = "motorcycle"
): number {
  return computeRealisticDurationMinutes(distanceKm, mode);
}

/**
 * Gọi API OSRM để lấy tuyến đường thực tế (GeoJSON) theo phương tiện
 */
export async function fetchRoute(
  origin: Coordinate,
  destination: Coordinate,
  mode: RouteVehicleMode = "motorcycle"
): Promise<RouteResult> {
  const config = VEHICLE_MODES[mode] || VEHICLE_MODES.motorcycle;
  const profile = config.osrmProfile;

  // OSRM format: /route/v1/{profile}/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson
  const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000), // Timeout sau 6 giây
    });

    if (!res.ok) {
      throw new Error(`OSRM responded with status ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No route found from OSRM");
    }

    const primaryRoute = data.routes[0];
    const distanceKm = primaryRoute.distance / 1000;
    // Public OSRM server always returns driving duration, so we calculate exact mode duration
    const durationMinutes = computeRealisticDurationMinutes(distanceKm, mode);

    return {
      distanceKm,
      durationMinutes,
      geometry: primaryRoute.geometry as GeoJSON.LineString,
      mode,
      origin,
      destination,
    };
  } catch (err) {
    console.warn("OSRM routing unavailable or timed out, generating geometric fallback route:", err);

    // Fallback mượt mà: Đường thẳng với ước tính cự ly Turf
    const directKm = calculateDirectDistanceKm(origin, destination);
    const estimatedKm = directKm * 1.25; // tính toán độ cong đường
    const durationMin = computeRealisticDurationMinutes(estimatedKm, mode);

    return {
      distanceKm: estimatedKm,
      durationMinutes: durationMin,
      geometry: {
        type: "LineString",
        coordinates: [
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ],
      },
      mode,
      origin,
      destination,
      fallback: true,
    };
  }
}

/**
 * Tạo URL mở điều hướng trên Google Maps
 * Nếu không truyền origin, Google Maps tự động dùng vị trí hiện tại thật của điện thoại/máy tính
 */
export function getGoogleMapsDirectionsUrl(
  origin: Coordinate | null,
  destination: Coordinate,
  mode: RouteVehicleMode = "motorcycle",
  destinationName?: string
): string {
  const travelMode = VEHICLE_MODES[mode]?.googleMapsMode || "two_wheeler";
  const destQuery = destinationName
    ? encodeURIComponent(`${destinationName}`)
    : `${destination.latitude},${destination.longitude}`;

  if (origin && !isNaN(origin.latitude) && !isNaN(origin.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destQuery}&travelmode=${travelMode}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destQuery}&travelmode=${travelMode}`;
}

export const routingService = {
  calculateDirectDistanceKm,
  formatDistanceKm,
  formatDurationMinutes,
  estimateDurationMinutes,
  computeRealisticDurationMinutes,
  getAllModesEstimates,
  fetchRoute,
  getGoogleMapsDirectionsUrl,
  VEHICLE_MODES,
};
