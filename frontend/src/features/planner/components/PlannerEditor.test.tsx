import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlannerEditor } from "./PlannerEditor";
import {
  usePlannerQuery,
  useUpdatePlannerMutation,
  useCreatePlannerInvitationMutation,
  useUpdateMockInvitationStatusMutation,
} from "../hooks/use-planner";
import { usePlannerDraftStore } from "../stores/planner-draft-store";
import { Planner } from "@/types/planner";
import { plannerService } from "@/services/planner.service";
import { MOCK_PLACES } from "@/mocks/data/places";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../hooks/use-planner", () => ({
  usePlannerQuery: vi.fn(),
  useUpdatePlannerMutation: vi.fn(),
  useCreatePlannerInvitationMutation: vi.fn(),
  useUpdateMockInvitationStatusMutation: vi.fn(),
}));

vi.mock("@/services/planner.service", () => ({
  plannerService: {
    searchInviteCandidates: vi.fn(),
  },
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

const plannerWithItems: Planner = {
  ...mockPlanner,
  estimatedTotalCost: 300000,
  days: [
    {
      day: 1,
      date: "2026-10-01",
      dayTotalCost: 300000,
      items: [
        {
          id: "item-1",
          placeId: "place-1",
          place: {
            ...MOCK_PLACES[0],
            id: "place-1",
            name: "Cafe Túi Mơ To",
            slug: "cafe-tui-mo-to",
            address: "Hẻm 31 Sào Nam",
          },
          startTime: "08:30",
          endTime: "10:00",
          durationMinutes: 90,
          estimatedCost: 100000,
          note: "Cafe ngắm hoa cúc",
          order: 1,
        },
        {
          id: "item-2",
          placeId: "place-2",
          place: {
            ...MOCK_PLACES[1],
            id: "place-2",
            name: "Dinh 1 Bảo Đại",
            slug: "dinh-1",
            address: "Đà Lạt",
          },
          startTime: "10:30",
          endTime: "12:30",
          durationMinutes: 120,
          estimatedCost: 200000,
          note: "Tham quan dinh",
          order: 2,
        },
      ],
    },
    {
      day: 2,
      date: "2026-10-02",
      dayTotalCost: 0,
      items: [],
    },
  ],
};

describe("PlannerEditor itinerary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerDraftStore.getState().reset();
    vi.mocked(useUpdatePlannerMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePlannerMutation>);
  });

  it("renders itinerary cards with places, times and costs", () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithItems,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    render(<PlannerEditor plannerId="planner-test-1" />);

    expect(screen.getByText("Cafe Túi Mơ To")).toBeInTheDocument();
    expect(screen.getByText("Dinh 1 Bảo Đại")).toBeInTheDocument();
    expect(screen.getByText(/100.000đ/)).toBeInTheDocument();
    expect(screen.getByText(/200.000đ/)).toBeInTheDocument();
  });

  it("shows empty day state when switching to an empty day", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithItems,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const day2Tab = screen.getByRole("tab", { name: /Ngày 2/i });
    await user.click(day2Tab);

    expect(screen.getByText(/Chưa có địa điểm nào trong ngày này/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tìm địa điểm mới/i })).toBeInTheDocument();
  });

  it("edits stop fields and recalculates totals", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithItems,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const editBtns = screen.getAllByRole("button", { name: /Chỉnh sửa điểm dừng/i });
    await user.click(editBtns[0]);

    expect(screen.getByText(/Chỉnh sửa điểm dừng/i)).toBeInTheDocument();
    const costInput = screen.getByLabelText(/Chi phí ước tính/i);
    await user.clear(costInput);
    await user.type(costInput, "250000");

    const saveStopBtn = screen.getByRole("button", { name: /Cập nhật điểm dừng/i });
    await user.click(saveStopBtn);

    const store = usePlannerDraftStore.getState();
    expect(store.draft?.days[0].items[0].estimatedCost).toBe(250000);
    expect(store.draft?.days[0].dayTotalCost).toBe(450000);
    expect(store.draft?.estimatedTotalCost).toBe(450000);
    expect(store.isDirty).toBe(true);
  });

  it("deletes a stop after confirmation dialog", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithItems,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const deleteBtns = screen.getAllByRole("button", { name: /Xóa điểm dừng/i });
    await user.click(deleteBtns[0]);

    expect(screen.getByText(/Xác nhận xóa điểm dừng/i)).toBeInTheDocument();
    const confirmDeleteBtn = screen.getByRole("button", { name: /Xóa/i });
    await user.click(confirmDeleteBtn);

    const store = usePlannerDraftStore.getState();
    expect(store.draft?.days[0].items).toHaveLength(1);
    expect(store.draft?.days[0].items[0].id).toBe("item-2");
    expect(store.draft?.days[0].items[0].order).toBe(1);
    expect(store.draft?.days[0].dayTotalCost).toBe(200000);
    expect(store.isDirty).toBe(true);
  });
});

const plannerWithCompanions: Planner = {
  ...mockPlanner,
  members: [
    {
      userId: "user-current",
      displayName: "Trọng Phúc",
      email: "phuc@example.com",
      role: "owner",
    },
    {
      userId: "user-lan",
      displayName: "Lan Nguyễn",
      email: "lan@example.com",
      role: "editor",
    },
  ],
  invitations: [
    {
      id: "inv-1",
      plannerId: "planner-test-1",
      invitee: {
        userId: "user-minh",
        displayName: "Minh Trần",
        email: "minh@example.com",
        role: "viewer",
      },
      permission: "viewer",
      status: "pending",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ],
};

describe("PlannerEditor invitation", () => {
  const createInviteMutate = vi.fn();
  const updateStatusMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerDraftStore.getState().reset();

    vi.mocked(useUpdatePlannerMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePlannerMutation>);

    vi.mocked(useCreatePlannerInvitationMutation).mockReturnValue({
      mutateAsync: createInviteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePlannerInvitationMutation>);

    vi.mocked(useUpdateMockInvitationStatusMutation).mockReturnValue({
      mutateAsync: updateStatusMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateMockInvitationStatusMutation>);
  });

  it("renders owner, members, and pending invitations", () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithCompanions,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    render(<PlannerEditor plannerId="planner-test-1" />);

    expect(screen.getByText("Lan Nguyễn")).toBeInTheDocument();
    expect(screen.getByText("Minh Trần")).toBeInTheDocument();
    expect(screen.getByText(/Đang chờ phản hồi/i)).toBeInTheDocument();
  });

  it("opens invitation dialog, searches candidates and detects conflict", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithCompanions,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    vi.mocked(plannerService.searchInviteCandidates).mockResolvedValue([
      {
        id: "user-lan",
        displayName: "Lan Nguyễn",
        email: "lan@example.com",
      },
      {
        id: "user-quynh",
        displayName: "Quỳnh Như",
        email: "quynh@example.com",
      },
    ]);

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    const openInviteBtn = screen.getByRole("button", { name: /Mời bạn cùng đi/i });
    await user.click(openInviteBtn);

    expect(screen.getByText(/Mời bạn đồng hành/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc email/i);
    await user.type(searchInput, "quynh");

    await waitFor(() => {
      expect(screen.getByText("Quỳnh Như")).toBeInTheDocument();
    });
  });

  it("submits invitation for valid candidate", async () => {
    vi.mocked(usePlannerQuery).mockReturnValue({
      data: plannerWithCompanions,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlannerQuery>);

    vi.mocked(plannerService.searchInviteCandidates).mockResolvedValue([
      {
        id: "user-quynh",
        displayName: "Quỳnh Như",
        email: "quynh@example.com",
      },
    ]);

    createInviteMutate.mockResolvedValueOnce({
      id: "inv-new",
      plannerId: "planner-test-1",
      invitee: {
        userId: "user-quynh",
        displayName: "Quỳnh Như",
        email: "quynh@example.com",
        role: "editor",
      },
      permission: "editor",
      status: "pending",
      createdAt: "2026-10-01T00:00:00Z",
    });

    const user = userEvent.setup();
    render(<PlannerEditor plannerId="planner-test-1" />);

    await user.click(screen.getByRole("button", { name: /Mời bạn cùng đi/i }));

    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc email/i);
    await user.type(searchInput, "quynh");

    await waitFor(() => {
      expect(screen.getByText("Quỳnh Như")).toBeInTheDocument();
    });

    // Select candidate
    await user.click(screen.getByText("Quỳnh Như"));

    // Send invite
    const sendBtn = screen.getByRole("button", { name: /Gửi lời mời/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(createInviteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          plannerId: "planner-test-1",
          input: expect.objectContaining({ userId: "user-quynh" }),
        })
      );
    });
  });
});
