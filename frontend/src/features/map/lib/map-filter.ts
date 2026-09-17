import { distance, point } from "@turf/turf";
import type { Place } from "@/types/place";
import type { MapFilters, NearbyPlace } from "../types";

export function filterNearbyPlaces(places: Place[], filters: MapFilters): NearbyPlace[] {
  const origin = point([filters.longitude, filters.latitude]);
  const keyword = filters.keyword.trim().toLocaleLowerCase("vi");

  return places
    .filter((place) => filters.city === "all" || place.city === filters.city)
    .filter((place) => filters.category === "all" || place.category === filters.category)
    .filter((place) => {
      if (!keyword) return true;
      return [place.name, place.address, place.city, ...place.tags]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(keyword);
    })
    .map((place) => ({
      place,
      distanceKm: distance(origin, point([place.longitude, place.latitude]), { units: "kilometers" }),
    }))
    .filter(({ distanceKm }) => distanceKm <= filters.maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.place.name.localeCompare(b.place.name, "vi"));
}

export function formatDistanceKm(value: number): string {
  return value < 1
    ? `${Math.round(value * 1000)} m`
    : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)} km`;
}
