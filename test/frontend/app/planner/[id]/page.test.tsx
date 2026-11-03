import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerPreview } from "@/features/planner/components/PlannerPreview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { plannerService } from "@/services/planner.service";
import { MOCK_PLANNERS } from "@/mocks/data/planners";
import React from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="mock-image" />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("PlannerPreview", () => {
  it("renders planner preview data and edit CTA without local editor buttons", async () => {
    const mockPlanner = {
      ...MOCK_PLANNERS[0],
      id: "planner-test-preview",
      title: "Preview Test Trip",
    };
    vi.spyOn(plannerService, "getPlannerById").mockResolvedValueOnce(mockPlanner);

    renderWithClient(<PlannerPreview plannerId="planner-test-preview" />);

    expect(
      await screen.findByRole("heading", { name: "Preview Test Trip" })
    ).toBeInTheDocument();

    // Check "Chỉnh sửa chuyến đi" CTA button exists with correct link
    const editLink = screen.getByRole("link", { name: /Chỉnh sửa chuyến đi/i });
    expect(editLink).toHaveAttribute("href", "/planner/planner-test-preview/edit");

    // Check "Chia sẻ" button exists
    expect(screen.getByRole("button", { name: /Chia sẻ/i })).toBeInTheDocument();

    // Check fake save button does NOT exist
    expect(screen.queryByRole("button", { name: /Lưu lịch trình/i })).not.toBeInTheDocument();

    // Check no drag handle or delete stop buttons in preview
    expect(screen.queryByLabelText(/Kéo để đổi thứ tự/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Xóa điểm này/i)).not.toBeInTheDocument();
  });

  it("renders empty state when planner is not found", async () => {
    vi.spyOn(plannerService, "getPlannerById").mockResolvedValueOnce(null);

    renderWithClient(<PlannerPreview plannerId="planner-non-existent" />);

    expect(
      await screen.findByText("Không tìm thấy lịch trình")
    ).toBeInTheDocument();
  });
});
