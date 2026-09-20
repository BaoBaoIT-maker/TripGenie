import { useQuery } from "@tanstack/react-query";
import { mapDiscoveryService } from "../services/map-discovery.service";
import type { DiscoveryFilters } from "../types";

export const discoveryKeys = {
  all: ["discovery-places"] as const,
  areas: () => [...discoveryKeys.all, "areas"] as const,
  categories: () => [...discoveryKeys.all, "categories"] as const,
  search: (filters: DiscoveryFilters) => [...discoveryKeys.all, "search", filters] as const,
};

// Compatibility
export const placeKeys = {
  all: ["places"] as const,
  list: () => [...placeKeys.all, "list"] as const,
};

export function usePlacesQuery(filters: DiscoveryFilters) {
  return useQuery({
    queryKey: discoveryKeys.search(filters),
    queryFn: () => mapDiscoveryService.searchPlaces(filters),
  });
}

export function useDiscoveryAreasQuery() {
  return useQuery({
    queryKey: discoveryKeys.areas(),
    queryFn: () => mapDiscoveryService.getAreas(),
  });
}

export function useDiscoveryCategoriesQuery() {
  return useQuery({
    queryKey: discoveryKeys.categories(),
    queryFn: () => mapDiscoveryService.getCategories(),
  });
}
