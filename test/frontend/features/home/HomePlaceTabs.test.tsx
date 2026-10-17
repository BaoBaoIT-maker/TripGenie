import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePlaceTabs } from "@/features/home/components/HomePlaceTabs";
import { homeService } from "@/features/home/services/home.service";
import type { Place } from "@/types/place";

vi.mock("@/features/home/services/home.service", () => ({
  homeService: {
    getPlaces: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const mockPlaces: Place[] = [
  {
    id: "p1",
    name: "Cà phê Biển",
    slug: "ca-phe-bien",
    category: "cafe",
    categoryLabel: "Quán Cafe",
    address: "Đà Nẵng",
    city: "Đà Nẵng",
    rating: 4.8,
    reviewCount: 40,
    coverImage: "https://example.com/img.jpg",
    tags: ["cafe", "view-bien"],
    suitableFor: ["couple", "friends"],
  },
];

describe("HomePlaceTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches featured places initially and renders them", async () => {
    vi.mocked(homeService.getPlaces).mockResolvedValueOnce(mockPlaces);
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HomePlaceTabs />
      </QueryClientProvider>
    );

    expect(screen.getByRole("tab", { name: /Nổi bật/i })).toHaveAttribute("aria-selected", "true");

    await waitFor(() => {
      expect(screen.getByText("Cà phê Biển")).toBeInTheDocument();
    });

    expect(homeService.getPlaces).toHaveBeenCalledWith(undefined, 4);
  });

  it("switches tab and fetches places with audience filter", async () => {
    vi.mocked(homeService.getPlaces).mockResolvedValue(mockPlaces);
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HomePlaceTabs />
      </QueryClientProvider>
    );

    const coupleTab = screen.getByRole("tab", { name: /Cặp đôi/i });
    fireEvent.click(coupleTab);

    expect(coupleTab).toHaveAttribute("aria-selected", "true");

    await waitFor(() => {
      expect(homeService.getPlaces).toHaveBeenCalledWith("couple", 4);
    });
  });

  it("renders error state with retry button when service fails", async () => {
    vi.mocked(homeService.getPlaces).mockRejectedValueOnce(new Error("Network failed"));
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HomePlaceTabs />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu địa điểm/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it("renders empty state when places array is empty", async () => {
    vi.mocked(homeService.getPlaces).mockResolvedValueOnce([]);
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HomePlaceTabs />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Chưa có địa điểm phù hợp/i })).toBeInTheDocument();
    });
  });
});
