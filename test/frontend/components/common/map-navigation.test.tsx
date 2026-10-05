import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/common/Navbar";
import { BottomNav } from "@/components/common/BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
}));

describe("Map Navigation", () => {
  it("links to the active map route from the desktop navigation", () => {
    render(<Navbar />);
    const link = screen.getByRole("link", { name: /Bản đồ/i });
    expect(link).toHaveAttribute("href", "/map");
    expect(link).toHaveClass("bg-secondary");
  });

  it("keeps five mobile items and replaces saved items with map", () => {
    render(<BottomNav />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Bản đồ/i })).toHaveAttribute("href", "/map");
    expect(screen.queryByRole("link", { name: /Đã lưu/i })).not.toBeInTheDocument();
  });
});
