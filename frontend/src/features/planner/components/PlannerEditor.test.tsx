import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlannerEditor } from "./PlannerEditor";
import { usePlannerQuery, useUpdatePlannerMutation } from "../hooks/use-planner";
import { usePlannerDraftStore } from "../stores/planner-draft-store";
import { Planner } from "@/types/planner";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../hooks/use-planner", () => ({
  usePlannerQuery: vi.fn(),
  useUpdatePlannerMutation: vi.fn(),
}));

const mockPlanner: Planner = {
  id: "planner-test-1",
  title: "Chuyến đi mẫu",
  description: "Mô tả mẫu",
  destination: "Đà Lạt",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  durationDays: 2,
  durationText: "2N1Đ",
  budget: 5000000,
  estimatedTotalCost: 300000,
  people: 2,
  style: "Khám phá",
  coverImage: "https://example.com/cover.jpg",
  status: "draft",
  days: [
    {
      day: 1,
      date: "2026-10-01",
      items: [],
      dayTotalCost: 0,
    },
  ],
  members: [
    {
      userId: "user-current",
      displayName: "Trọng Phúc",
      email: "phuc@example.com",
      role: "owner",
    },
  ],
  invitations: [],
};

describe("PlannerEditor editor lifecycle", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerDraftStore.getState().reset();

    vi.mocked(useUpdatePlannerMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePlannerMutation>);
  });

  it("shows loading state when query is loading", () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    render(<PlannerEditor plannerId="planner-test-1" />);
    expect(screen.getByText(/Đang tải thông tin chuyến đi/i)).toBeInTheDocument();
  });

  it("shows not found state when planner does not exist", () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    render(<PlannerEditor plannerId="planner-not-exist" />);
    expect(screen.getByText(/Không tìm thấy lịch trình/i)).toBeInTheDocument();
  });

  it("shows error state with retry button on query error", async () => {
    const refetch = vi.fn();
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    expect(screen.getByText(/Lỗi khi tải lịch trình/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Thử lại/i });
    await user.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it("loads planner into draft, disables save button when clean, and enables when dirty", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: mockPlanner,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    // Save button should be disabled when clean
    const saveBtn = screen.getByRole("button", { name: /Lưu chuyến đi/i });
    expect(saveBtn).toBeDisabled();

    // Modify title
    const titleInput = screen.getByLabelText(/Tên chuyến đi/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Tên chuyến đi đã sửa");

    // Save button should now be enabled
    expect(saveBtn).toBeEnabled();
    expect(usePlannerDraftStore.getState().isDirty).toBe(true);
  });

  it("retains draft on save failure", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: mockPlanner,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    mutateAsync.mockRejectedValueOnce(new Error("Network save failure"));

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const titleInput = screen.getByLabelText(/Tên chuyến đi/i);
    await user.type(titleInput, " cập nhật");

    const saveBtn = screen.getByRole("button", { name: /Lưu chuyến đi/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });

    // Draft should retain changes and remain dirty
    expect(usePlannerDraftStore.getState().isDirty).toBe(true);
    expect(usePlannerDraftStore.getState().draft?.title).toContain("cập nhật");
  });

  it("clears dirty state on save success", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: mockPlanner,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const savedPlanner = {
      ...mockPlanner,
      title: "Chuyến đi đã lưu thành công",
    };
    mutateAsync.mockResolvedValueOnce(savedPlanner);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const titleInput = screen.getByLabelText(/Tên chuyến đi/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Chuyến đi đã lưu thành công");

    const saveBtn = screen.getByRole("button", { name: /Lưu chuyến đi/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(usePlannerDraftStore.getState().isDirty).toBe(false);
    });
  });

  it("navigates directly to preview when clean, and prompts when dirty", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: mockPlanner,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    // When clean: clicking preview navigates directly
    const previewBtn = screen.getByRole("button", { name: /Xem trước/i });
    await user.click(previewBtn);
    expect(push).toHaveBeenCalledWith("/planner/planner-test-1");

    // Make it dirty
    const titleInput = screen.getByLabelText(/Tên chuyến đi/i);
    await user.type(titleInput, " thêm bớt");

    // Click preview while dirty -> shows unsaved changes prompt dialog
    await user.click(previewBtn);
    expect(screen.getByText(/Bạn có thay đổi chưa lưu/i)).toBeInTheDocument();
  });
});
