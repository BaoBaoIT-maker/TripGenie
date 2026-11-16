import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DestinationsSection } from "@/features/landing/components/DestinationsSection";
import { SEASONAL_DESTINATIONS } from "@/features/landing/config/seasonal-destinations.config";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DestinationsSection — Google Arts & Culture Center Stage Deck", () => {
  it("renders section heading and 34 provinces link correctly without AI-slop eyebrow", () => {
    render(<DestinationsSection />);

    // Đã loại bỏ hoàn toàn nhãn rác "Khám Phá Mùa Đẹp Nhất"
    expect(
      screen.queryByText(/Khám Phá Mùa Đẹp Nhất/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Những điểm đến đáng trải nghiệm/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Xem bản đồ 34 tỉnh thành/i)
    ).toBeInTheDocument();
  });

  it("renders all 5 curated seasonal cards with authentic Vietnam data and weather condition", () => {
    render(<DestinationsSection />);

    for (const item of SEASONAL_DESTINATIONS) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.subtitle)).toBeInTheDocument();
      expect(screen.getByText(item.weatherTemp)).toBeInTheDocument();
      expect(screen.getByText(item.weatherCondition)).toBeInTheDocument();
    }
  });

  it("ensures each card is a direct link pointing to explore query", () => {
    render(<DestinationsSection />);

    for (const item of SEASONAL_DESTINATIONS) {
      const cardTitle = screen.getByText(item.title);
      const link = cardTitle.closest("a");
      expect(link).toHaveAttribute("href", item.targetUrl);
    }
  });

  it("renders mobile indicator buttons corresponding to all seasonal cards", () => {
    render(<DestinationsSection />);

    for (const item of SEASONAL_DESTINATIONS) {
      expect(
        screen.getByLabelText(new RegExp(`Xem thẻ mùa ${item.title}`, "i"))
      ).toBeInTheDocument();
    }
  });

  it("ensures no cluttering floating arrow buttons obstruct the deck", () => {
    render(<DestinationsSection />);

    expect(
      screen.queryByRole("button", { name: /Lùi lại mùa trước/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Xem mùa tiếp theo/i })
    ).not.toBeInTheDocument();
  });
});
