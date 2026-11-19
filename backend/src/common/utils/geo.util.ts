export interface GeoCoord {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_KM = 6371;
export const METERS_PER_KM = 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Great-circle Haversine distance between two coordinates in kilometers.
 */
export function computeHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Great-circle Haversine distance between two GeoCoord points in meters.
 */
export function haversineMeters(a: GeoCoord, b: GeoCoord): number {
  return (
    computeHaversineDistance(a.lat, a.lng, b.lat, b.lng) * METERS_PER_KM
  );
}

/**
 * Computes the geographic centroid of a non-empty list of coordinates.
 */
export function computeCentroid(coords: readonly GeoCoord[]): GeoCoord | null {
  if (coords.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const c of coords) {
    sumLat += c.lat;
    sumLng += c.lng;
  }
  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  };
}
