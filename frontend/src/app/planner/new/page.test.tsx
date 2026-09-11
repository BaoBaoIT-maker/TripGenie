import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewPlannerPage from "./page";
import { plannerService } from "@/services/planner.service";
import { Planner } from "@/types/planner";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("mode=ai"),
}));

vi.mock("@/services/planner.service", () => ({
  plannerService: {
    generateAiPlanner: vi.fn(),
    createPlanner: vi.fn(),
  },
}));

describe("NewPlannerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits AI form, calls service generation and navigates to generated id edit route", async () => {
    const user = userEvent.setup();
    const fakeGenerated: Planner = {
      id: "planner-generated-1",
      title: "Du lịch Sài Gòn",
      destination: "Thành phố Hồ Chí Minh",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      durationDays: 3,
      durationText: "3N2Đ",
      budget: 3000000,
      estimatedTotalCost: 0,
      people: 2,
      style: "Cân bằng & cafe, ăn uống, chill",
      coverImage: "https://example.com/cover.jpg",
      status: "draft",
      days: [],
    };

    vi.mocked(plannerService.generateAiPlanner).mockResolvedValue(fakeGenerated);
    vi.mocked(plannerService.createPlanner).mockResolvedValue(fakeGenerated);

    render(<NewPlannerPage />);

    const submitBtn = screen.getByRole("button", { name: /Tạo lịch trình với AI/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(plannerService.generateAiPlanner).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Du lịch Sài Gòn",
          destination: "Thành phố Hồ Chí Minh",
        })
      );
    });

    expect(plannerService.createPlanner).toHaveBeenCalledWith(
      expect.objectContaining({ id: "planner-generated-1" })
    );

    expect(push).toHaveBeenCalledWith("/planner/planner-generated-1/edit");
  });
});
