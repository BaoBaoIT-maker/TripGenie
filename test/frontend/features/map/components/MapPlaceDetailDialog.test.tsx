import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapPlaceDetailDialog } from "@/features/map/MapPlaceDetailDialog";
import { mapDiscoveryService } from "@/features/map/services/map-discovery.service";

const mockPlaceDetail = {
  id: "dn-cafe-1",
  slug: "goc-an-yen-cafe",
  name: "Góc An Yên Cafe & Bistro",
  category: "ca-phe",
  categoryLabel: "Cà phê",
  areaSlug: "da-nang",
  areaName: "Đà Nẵng",
  address: "32 Bạch Đằng, Quận Hải Châu, Đà Nẵng",
  latitude: 16.0682,
  longitude: 108.2241,
  rating: 4.8,
  reviewCount: 312,
  priceLevel: 2,
  isOpenNow: true,
  primaryImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
  images: [],
  phone: "0236 3888 999",
  website: "https://facebook.com/gocanyen",
  openingHours: "07:00 - 22:30 hàng ngày",
  tags: ["View sông Hàn", "Yên tĩnh"],
  sources: [{ provider: "OpenStreetMap" }],
};

vi.mock("@/features/map/services/map-discovery.service", () => ({
  mapDiscoveryService: {
    getPlaceById: vi.fn(),
  },
}));

describe("MapPlaceDetailDialog", () => {
  it("loads and displays place details with demo labels and contact buttons", async () => {
    vi.mocked(mapDiscoveryService.getPlaceById).mockResolvedValue(mockPlaceDetail);

    render(
      <MapPlaceDetailDialog
        placeId="dn-cafe-1"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Góc An Yên Cafe & Bistro")).toBeInTheDocument();
    });

    expect(screen.getByText("Dữ liệu mẫu")).toBeInTheDocument();
    expect(screen.getByText("32 Bạch Đằng, Quận Hải Châu, Đà Nẵng")).toBeInTheDocument();
    expect(screen.getByText(/07:00 - 22:30/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gọi 0236 3888 999/i })).toHaveAttribute("href", "tel:0236 3888 999");
    expect(screen.getByRole("link", { name: /trang web/i })).toHaveAttribute("href", "https://facebook.com/gocanyen");
    expect(screen.getByText("OpenStreetMap")).toBeInTheDocument();
  });

  it("handles favorite toggle and planner preview CTA without persistent mutations", async () => {
    vi.mocked(mapDiscoveryService.getPlaceById).mockResolvedValue(mockPlaceDetail);
    const user = userEvent.setup();

    render(
      <MapPlaceDetailDialog
        placeId="dn-cafe-1"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Góc An Yên Cafe & Bistro")).toBeInTheDocument();
    });

    // Test favorite heart
    const favBtn = screen.getByRole("button", { name: /lưu vào danh sách yêu thích/i });
    await user.click(favBtn);
    expect(screen.getByText(/đã lưu vào danh sách yêu thích \(bản demo\)/i)).toBeInTheDocument();

    // Test planner CTA
    const plannerBtn = screen.getByRole("button", { name: /\+ thêm vào lịch trình du lịch/i });
    await user.click(plannerBtn);
    expect(screen.getByText(/chế độ xem trước \(bản demo\)/i)).toBeInTheDocument();
  });
});
