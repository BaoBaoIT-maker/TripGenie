import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewPlannerPage from "@/app/planner/new/page";
import { plannerService } from "@/services/planner.service";
import { useCreateManualPlannerMutation } from "@/features/planner/hooks/use-planner";
import { Planner } from "@/types/planner";

let currentMode = "ai";
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(`mode=${currentMode}`),
}));

vi.mock("@/services/planner.service", () => ({
  plannerService: {
    generateAiPlanner: vi.fn(),
    createPlanner: vi.fn(),
  },
}));

vi.mock("@/features/planner/hooks/use-planner", () => ({
  useCreateManualPlannerMutation: vi.fn(),
}));

describe("NewPlannerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMode = "ai";
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

  it("renders the reduced manual flow and never invokes AI generation", async () => {
    currentMode = "manual";
    const mutateAsync = vi.fn().mockResolvedValue({ id: "manual-plan-page" });
    vi.mocked(useCreateManualPlannerMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualPlannerMutation>);
    const user = userEvent.setup();
    render(<NewPlannerPage />);

    expect(screen.getByRole("heading", { name: /Tạo chuyến đi thủ công/i })).toBeInTheDocument();
    expect(screen.getByText(/Khởi tạo chuyến đi trước/i)).toBeInTheDocument();
    expect(screen.queryByText(/Điểm muốn ghé|Sở thích|Nhịp độ|Phương tiện|Yêu cầu thêm/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Tự đi Đà Lạt");
    await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
    await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(plannerService.generateAiPlanner).not.toHaveBeenCalled();
    expect(plannerService.createPlanner).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/planner/manual-plan-page/edit");
  });
});
