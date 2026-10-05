import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManualPlannerForm } from "@/features/planner/components/ManualPlannerForm";
import { useCreateManualPlannerMutation } from "@/features/planner/hooks/use-planner";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/planner/hooks/use-planner", () => ({
  useCreateManualPlannerMutation: vi.fn(),
}));

const coverOptions = ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb"];
const mutateAsync = vi.fn();

describe("ManualPlannerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateManualPlannerMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualPlannerMutation>);
  });

  it("renders only approved manual fields and the three-step guide", () => {
    render(<ManualPlannerForm coverOptions={coverOptions} />);
    expect(screen.getByLabelText(/Tên chuyến đi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mô tả/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Điểm đến/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngày bắt đầu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngày kết thúc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Số người/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngân sách/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chọn ảnh bìa/i })).toBeInTheDocument();
    expect(screen.getByText("1. Tạo chuyến đi")).toBeInTheDocument();
    expect(screen.getByText("2. Chọn địa điểm")).toBeInTheDocument();
    expect(screen.getByText("3. Sắp xếp lịch trình")).toBeInTheDocument();
    expect(screen.queryByText(/Điểm muốn ghé|Sở thích|Nhịp độ|Phương tiện|Yêu cầu thêm/i)).not.toBeInTheDocument();
  });

  it("shows inline validation and does not submit invalid dates", async () => {
    const user = userEvent.setup();
    render(<ManualPlannerForm coverOptions={coverOptions} />);
    await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Chuyến đi của tui");
    await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
    await user.clear(screen.getByLabelText(/Ngày bắt đầu/i));
    await user.type(screen.getByLabelText(/Ngày bắt đầu/i), "2026-10-03");
    await user.clear(screen.getByLabelText(/Ngày kết thúc/i));
    await user.type(screen.getByLabelText(/Ngày kết thúc/i), "2026-10-01");
    await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));
    expect(await screen.findByText(/Ngày kết thúc phải sau/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("creates a manual planner and opens its editor", async () => {
    mutateAsync.mockResolvedValue({ id: "manual-plan-created" });
    const user = userEvent.setup();
    render(<ManualPlannerForm coverOptions={coverOptions} />);
    await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Chuyến đi của tui");
    await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
    await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      title: "Chuyến đi của tui",
      destination: "Đà Lạt",
    })));
    expect(push).toHaveBeenCalledWith("/planner/manual-plan-created/edit");
  });

  it("retains values and allows retry when creation fails", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("storage unavailable"));
    const user = userEvent.setup();
    render(<ManualPlannerForm coverOptions={coverOptions} />);
    await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Vẫn giữ tên này");
    await user.type(screen.getByLabelText(/Điểm đến/i), "Ninh Bình");
    await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/Tên chuyến đi/i)).toHaveValue("Vẫn giữ tên này");
    expect(screen.getByLabelText(/Điểm đến/i)).toHaveValue("Ninh Bình");
    expect(screen.getByRole("button", { name: /Tạo chuyến đi trống/i })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});
