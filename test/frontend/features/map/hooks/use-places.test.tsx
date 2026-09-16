import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePlacesQuery, placeKeys } from "@/features/map/hooks/use-places";
import { placeService } from "@/services/place.service";
import { MOCK_PLACES } from "@/mocks/data/places";

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

vi.mock("@/services/place.service", () => ({
  placeService: { getPlaces: vi.fn() },
}));

describe("usePlacesQuery", () => {
  it("defines cache keys properly", () => {
    expect(placeKeys.all).toEqual(["places"]);
    expect(placeKeys.list()).toEqual(["places", "list"]);
  });

  it("loads places through placeService", async () => {
    vi.mocked(placeService.getPlaces).mockResolvedValue([MOCK_PLACES[0]]);
    const { result } = renderHook(() => usePlacesQuery(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([MOCK_PLACES[0]]);
    expect(placeService.getPlaces).toHaveBeenCalledWith();
  });
});
