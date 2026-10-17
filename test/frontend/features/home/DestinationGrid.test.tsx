import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DestinationGrid } from "@/features/home/components/DestinationGrid";
import type { BackendTravelAreaItem } from "@/services/place.service";

const mockAreas: BackendTravelAreaItem[] = [
  { id: 2, name: "Da Nang", nameVi: "Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
  { id: 3, name: "Ha Noi", nameVi: "Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
];

describe("DestinationGrid", () => {
  it("renders destination cards with correct link href", () => {
    render(<DestinationGrid areas={mockAreas} />);

    const daNangLink = screen.getByRole("link", { name: /Đà Nẵng/i });
    expect(daNangLink).toHaveAttribute("href", "/explore?areaId=2");

    const haNoiLink = screen.getByRole("link", { name: /Hà Nội/i });
    expect(haNoiLink).toHaveAttribute("href", "/explore?areaId=3");
  });

  it("renders empty state notice when areas list is empty", () => {
    render(<DestinationGrid areas={[]} />);

    expect(screen.getByText(/Chưa có thông tin điểm đến/i)).toBeInTheDocument();
  });
});
