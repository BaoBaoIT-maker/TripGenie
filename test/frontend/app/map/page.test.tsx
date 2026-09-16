import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MapPage from "@/app/map/page";

vi.mock("@/features/map/MapExplorer", () => ({
  MapExplorer: () => <div>Map explorer probe</div>,
}));

describe("MapPage", () => {
  it("renders the nearby map route shell", () => {
    render(<MapPage />);
    expect(screen.getByRole("heading", { name: /Bản đồ địa điểm/i })).toBeInTheDocument();
    expect(screen.getByText("Map explorer probe")).toBeInTheDocument();
  });
});
