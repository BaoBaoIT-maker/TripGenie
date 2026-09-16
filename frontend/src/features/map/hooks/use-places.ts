import { useQuery } from "@tanstack/react-query";
import { placeService } from "@/services/place.service";

export const placeKeys = {
  all: ["places"] as const,
  list: () => [...placeKeys.all, "list"] as const,
};

export function usePlacesQuery() {
  return useQuery({
    queryKey: placeKeys.list(),
    queryFn: () => placeService.getPlaces(),
  });
}
