import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeSearchForm } from "@/features/home/components/HomeSearchForm";
import type { BackendTravelAreaItem } from "@/services/place.service";

const mockAreas: BackendTravelAreaItem[] = [
  { id: 2, name: "Da Nang", nameVi: "Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
  { id: 3, name: "Ha Noi", nameVi: "Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null } },
];

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("HomeSearchForm", () => {
  it("renders search inputs and secondary action links", () => {
    render(<HomeSearchForm areas={mockAreas} />);

    expect(screen.getByLabelText(/Bạn muốn khám phá gì/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Khám phá địa điểm/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo lịch trình AI/i })).toHaveAttribute("href", "/planner/new?mode=ai");
    expect(screen.getByRole("link", { name: /Khám phá trên bản đồ/i })).toHaveAttribute("href", "/explore?view=split");
  });

  it("submits keyword and navigates to correct explore URL", () => {
    render(<HomeSearchForm areas={mockAreas} />);

    const keywordInput = screen.getByLabelText(/Bạn muốn khám phá gì/i);
    fireEvent.change(keywordInput, { target: { value: "Bánh xèo" } });

    const submitBtn = screen.getByRole("button", { name: /Khám phá địa điểm/i });
    fireEvent.click(submitBtn);

    expect(mockPush).toHaveBeenCalledWith("/explore?keyword=B%C3%A1nh+x%C3%A8o");
  });

  it("submits areaId when selected and keyword together", async () => {
    mockPush.mockClear();
    render(<HomeSearchForm areas={mockAreas} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Điểm đến/i }));
    await user.click(await screen.findByRole("option", { name: "Đà Nẵng" }));

    const keywordInput = screen.getByLabelText(/Bạn muốn khám phá gì/i);
    fireEvent.change(keywordInput, { target: { value: "Cafe" } });

    fireEvent.submit(keywordInput.closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/explore?keyword=Cafe&areaId=2");
  });
});
