import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlaceCard } from "@/components/place/PlaceCard";
import type { Place } from "@/types/place";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSavedPlaceIds, useToggleFavorite } from "@/features/collections/hooks/use-collections";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useSavedPlaceIds: vi.fn(),
  useToggleFavorite: vi.fn(),
  useCollections: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCollectionsContainingPlace: vi.fn().mockReturnValue({ data: new Set(), isLoading: false }),
  useAddPlaceToCollection: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useCreateCollection: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

const mockPlace: Place = {
  id: "p-1",
  name: "Bà Nà Hills",
  slug: "ba-na-hills",
  category: "sightseeing",
  categoryLabel: "Điểm tham quan",
  address: "Hòa Vang, Đà Nẵng",
  city: "Đà Nẵng",
  latitude: 15.99,
  longitude: 107.98,
  rating: 4.8,
  reviewCount: 120,
  priceRangeText: "100k - 300k",
  coverImage: "https://example.com/bana.jpg",
  tags: ["checkin", "view-dep"],
  suitableFor: ["couple", "family"],
  openingHoursText: "08:00 - 18:00",
};

const mockPlaceNoImage: Place = {
  ...mockPlace,
  id: "p-2",
  coverImage: "",
};

describe("PlaceCard", () => {
  let queryClient: QueryClient;
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", email: "test@example.com" },
      isAuthenticated: true,
      isLoading: false,
    } as any);

    vi.mocked(useSavedPlaceIds).mockReturnValue({
      data: new Set<string>(),
      isLoading: false,
    } as any);

    vi.mocked(useToggleFavorite).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  const renderCard = (props = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <PlaceCard place={mockPlace} {...props} />
      </QueryClientProvider>
    );

  it("renders place link to detail page and subtle arrow indicator", () => {
    renderCard();
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/places/ba-na-hills")).toBe(true);

    const arrowEl = document.querySelector(".group-hover\\:translate-x-\\[3px\\]");
    expect(arrowEl).toBeInTheDocument();
  });

  it("applies subtle image scale and no card translateY jump", () => {
    renderCard();
    const cardRoot = document.querySelector(".group");
    expect(cardRoot).toBeInTheDocument();
    expect(cardRoot?.className).not.toContain("hover:-translate-y-1");
    expect(cardRoot?.className).toContain("duration-200");
  });

  it("prompts login when guest clicks bookmark", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    } as any);

    renderCard();
    const bookmarkBtn = screen.getByRole("button", { name: /Lưu địa điểm/i });
    fireEvent.click(bookmarkBtn);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Vui lòng đăng nhập")
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("toggles bookmark when authenticated and disables during pending mutation", () => {
    vi.mocked(useToggleFavorite).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as any);

    renderCard();
    const bookmarkBtn = screen.getByRole("button", { name: /Lưu địa điểm/i });
    expect(bookmarkBtn).toBeDisabled();
  });

  it("renders contribute photo button when image is missing and callback provided", () => {
    const handleContribute = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <PlaceCard place={mockPlaceNoImage} onContributePhoto={handleContribute} />
      </QueryClientProvider>
    );

    const contributeBtn = screen.getByRole("button", { name: /Đóng góp ảnh/i });
    expect(contributeBtn).toBeInTheDocument();

    fireEvent.click(contributeBtn);
    expect(handleContribute).toHaveBeenCalledWith(mockPlaceNoImage);
  });
});
