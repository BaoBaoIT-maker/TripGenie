import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import { homeService } from "@/features/home/services/home.service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/home/services/home.service", () => ({
  homeService: {
    getDestinations: vi.fn(),
    getPlaces: vi.fn(),
  },
}));

vi.mock("@/features/home/components/HomePlaceTabs", () => ({
  HomePlaceTabs: () => <div data-testid="home-place-tabs">Tabs Component</div>,
}));

describe("HomePage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hero title, search form, and action links even when area service fails", async () => {
    vi.mocked(homeService.getDestinations).mockRejectedValueOnce(new Error("Area service unavailable"));

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByText(/Khám phá điểm đến, lên lịch trình theo cách của bạn/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Khám phá địa điểm/i })).toBeInTheDocument();

    const aiLinks = screen.getAllByRole("link", { name: /Tạo lịch trình AI/i });
    expect(aiLinks.length).toBeGreaterThan(0);
    expect(aiLinks[0]).toHaveAttribute("href", "/planner/new?mode=ai");

    const manualLink = screen.getByRole("link", { name: /Lập lịch trình thủ công/i });
    expect(manualLink).toHaveAttribute("href", "/planner/new?mode=manual");
  });

  it("renders verified travel destinations when returned by service", async () => {
    vi.mocked(homeService.getDestinations).mockResolvedValueOnce([
      { id: 2, name: "Da Nang", nameVi: "Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
      { id: 3, name: "Ha Noi", nameVi: "Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
    ]);

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole("link", { name: /Đà Nẵng/i })).toHaveAttribute("href", "/explore?areaId=2");
    expect(screen.getByRole("link", { name: /Hà Nội/i })).toHaveAttribute("href", "/explore?areaId=3");
  });

  it("renders 4 canonical experience category cards with explore links", async () => {
    vi.mocked(homeService.getDestinations).mockResolvedValueOnce([]);

    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole("link", { name: /Cà phê & Trà/i })).toHaveAttribute("href", "/explore?category=ca-phe");
    expect(screen.getByRole("link", { name: /Ẩm thực & Quán ăn/i })).toHaveAttribute("href", "/explore?category=am-thuc");
    expect(screen.getByRole("link", { name: /Thiên nhiên & Di tích/i })).toHaveAttribute("href", "/explore?category=tham-quan");
    expect(screen.getByRole("link", { name: /Vui chơi & Về đêm/i })).toHaveAttribute("href", "/explore?category=giai-tri");
  });
});
