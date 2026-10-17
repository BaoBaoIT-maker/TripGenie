import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaceCard } from "@/components/place/PlaceCard";
import type { Place } from "@/types/place";

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
  it("does not render bookmark button when onBookmark prop is not provided", () => {
    render(<PlaceCard place={mockPlace} />);
    expect(screen.queryByRole("button", { name: /Lưu địa điểm/i })).not.toBeInTheDocument();
  });

  it("renders bookmark button and triggers callback when onBookmark is provided", () => {
    const handleBookmark = vi.fn();
    render(<PlaceCard place={mockPlace} onBookmark={handleBookmark} isBookmarked={false} />);

    const bookmarkBtn = screen.getByRole("button", { name: /Lưu địa điểm/i });
    expect(bookmarkBtn).toBeInTheDocument();

    fireEvent.click(bookmarkBtn);
    expect(handleBookmark).toHaveBeenCalledTimes(1);
    expect(handleBookmark).toHaveBeenCalledWith(mockPlace);
  });

  it("does not render contribute photo button when onContributePhoto is not provided", () => {
    render(<PlaceCard place={mockPlaceNoImage} />);
    expect(screen.queryByRole("button", { name: /Đóng góp ảnh/i })).not.toBeInTheDocument();
  });

  it("renders contribute photo button and triggers callback when onContributePhoto is provided and no image", () => {
    const handleContribute = vi.fn();
    render(<PlaceCard place={mockPlaceNoImage} onContributePhoto={handleContribute} />);

    const contributeBtn = screen.getByRole("button", { name: /Đóng góp ảnh/i });
    expect(contributeBtn).toBeInTheDocument();

    fireEvent.click(contributeBtn);
    expect(handleContribute).toHaveBeenCalledTimes(1);
    expect(handleContribute).toHaveBeenCalledWith(mockPlaceNoImage);
  });

  it("renders place link to detail page", () => {
    render(<PlaceCard place={mockPlace} />);
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/places/ba-na-hills")).toBe(true);
  });
});
