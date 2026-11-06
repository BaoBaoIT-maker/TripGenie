import { describe, expect, it, vi, beforeEach } from "vitest";
import { placeService } from "@/services/place.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("placeService.searchPlaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns backend mapped places when API call succeeds", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      items: [
        {
          id: "place-123",
          name: "Bà Nà Hills",
          slug: "ba-na-hills",
          latitude: 15.99,
          longitude: 107.98,
          category: { slug: "diem-tham-quan", nameVi: "Điểm tham quan" },
          coverImage: "https://example.com/bana.jpg",
          rating: 4.8,
          reviewCount: 1500,
        },
      ],
      meta: { totalItems: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const result = await placeService.searchPlaces({ limit: 10 });
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe("Bà Nà Hills");
    expect(result.total).toBe(1);
  });

  it("returns empty places without falling back to mock when backend returns empty items", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0, page: 1, limit: 10, totalPages: 0 },
    });

    const result = await placeService.searchPlaces({ limit: 10 });
    expect(result.places).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("propagates backend error by default instead of fabricating mock places", async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(new Error("Network Error"));

    await expect(placeService.searchPlaces({ limit: 5 })).rejects.toThrow("Network Error");
  });

  it("throws error without mock fallback when allowMockFallback is false", async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(new Error("Database connection down"));

    await expect(
      placeService.searchPlaces({ limit: 5 })
    ).rejects.toThrow("Database connection down");
  });
});
