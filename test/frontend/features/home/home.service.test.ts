import { describe, expect, it, vi, beforeEach } from "vitest";
import { homeService } from "@/features/home/services/home.service";
import { placeService, BackendTravelAreaItem } from "@/services/place.service";
import { HOME_CONFIG } from "@/features/home/config/home.config";

vi.mock("@/services/place.service", () => ({
  placeService: {
    getTravelAreas: vi.fn(),
    searchPlaces: vi.fn(),
  },
}));

describe("homeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDestinations", () => {
    it("filters only CITY and PROVINCE, sanitizes ids and respects HOME_CONFIG limit", async () => {
      const mockAreas: BackendTravelAreaItem[] = [
        { id: 1, name: "Vietnam", nameVi: "Việt Nam", slug: "vietnam", type: "COUNTRY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
        { id: 2, name: "Da Nang", nameVi: "Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
        { id: 3, name: "Ha Noi", nameVi: "Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
        { id: 4, name: "Quang Nam", nameVi: "Quảng Nam", slug: "quang-nam", type: "PROVINCE", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
        { id: -5, name: "Invalid Neg", nameVi: "Âm", slug: "am", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
      ];

      vi.mocked(placeService.getTravelAreas).mockResolvedValueOnce(mockAreas);

      const destinations = await homeService.getDestinations();
      expect(destinations).toHaveLength(3);
      expect(destinations.map((d) => d.id)).toEqual([2, 3, 4]);
      expect(destinations.length).toBeLessThanOrEqual(HOME_CONFIG.destinations.limit);
    });

    it("does not fabricate destinations when backend returns fewer than limit", async () => {
      const mockAreas: BackendTravelAreaItem[] = [
        { id: 2, name: "Da Nang", nameVi: "Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
      ];

      vi.mocked(placeService.getTravelAreas).mockResolvedValueOnce(mockAreas);

      const destinations = await homeService.getDestinations();
      expect(destinations).toHaveLength(1);
      expect(destinations[0].id).toBe(2);
    });
  });

  describe("getPlaces", () => {
    it("calls searchPlaces with allowMockFallback: false and specified audience", async () => {
      const mockResultPlaces = [
        { id: "p1", name: "Địa điểm 1", slug: "p1", category: "cafe" } as any,
      ];

      vi.mocked(placeService.searchPlaces).mockResolvedValueOnce({
        places: mockResultPlaces,
        total: 1,
        page: 1,
        limit: 4,
        totalPages: 1,
      });

      const places = await homeService.getPlaces("couple");
      expect(placeService.searchPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          suitableFor: "couple",
          sortBy: "rating",
          limit: HOME_CONFIG.places.limit,
        }),
        { allowMockFallback: false }
      );
      expect(places).toEqual(mockResultPlaces);
    });

    it("propagates error when backend fails so caller can show error state", async () => {
      vi.mocked(placeService.searchPlaces).mockRejectedValueOnce(new Error("Backend unreachable"));

      await expect(homeService.getPlaces()).rejects.toThrow("Backend unreachable");
    });
  });
});
