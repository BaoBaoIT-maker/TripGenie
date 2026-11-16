import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposalCard } from '@/features/planner/components/companions/ProposalCard';
import { TripProposalsPanel } from '@/features/planner/components/companions/TripProposalsPanel';
import BudgetBreakdownCard from '@/features/planner/components/itinerary/BudgetBreakdownCard';
import { EditDestinationDialog } from '@/features/planner/components/itinerary/EditDestinationDialog';
import { EditItineraryMetaDialog } from '@/features/planner/components/itinerary/EditItineraryMetaDialog';
import { ItineraryHeroHeader } from '@/features/planner/components/itinerary/ItineraryHeroHeader';
import { useTripCompanions } from '@/features/planner/hooks/use-trip-companions';
import {
  useResolveGroupProposal,
  useToggleProposalVote,
  useTripProposals,
  useWithdrawGroupProposal,
} from '@/features/planner/hooks/use-trip-proposals';
import type {
  BudgetBreakdown,
  GroupProposalItem,
  ItineraryActivity,
  ItineraryDay,
  ItineraryDetail,
} from '@/types/itinerary';

vi.mock('@/features/planner/hooks/use-trip-companions', () => ({
  useTripCompanions: vi.fn(),
}));

vi.mock('@/features/planner/hooks/use-trip-proposals', () => ({
  useTripProposals: vi.fn(),
  useToggleProposalVote: vi.fn(),
  useResolveGroupProposal: vi.fn(),
  useWithdrawGroupProposal: vi.fn(),
}));

const MOCK_ACTIVITY: ItineraryActivity = {
  id: 'dest-1',
  placeId: 'place-1',
  placeName: 'Cầu Rồng Đà Nẵng',
  startTime: '09:00',
  endTime: '10:30',
  durationMinutes: 90,
  visitOrder: 1,
  notes: 'Check-in sáng',
  latitude: 16.0611,
  longitude: 108.227,
  address: 'Hải Châu, Đà Nẵng',
  imageUrl: null,
  categoryName: 'Tham quan',
  distanceToNextKm: 2.1,
  estimatedCost: 50000,
};

const MOCK_FOOD_ACTIVITY: ItineraryActivity = {
  ...MOCK_ACTIVITY,
  id: 'dest-food',
  placeId: 'place-food',
  placeName: 'Mì Quảng Bà Mua',
  categoryName: 'Nhà hàng đặc sản',
  estimatedCost: 85000,
};

const MOCK_DAYS: ItineraryDay[] = [
  {
    dayNumber: 1,
    theme: 'Trung tâm thành phố',
    activities: [MOCK_ACTIVITY, MOCK_FOOD_ACTIVITY],
  },
  {
    dayNumber: 2,
    theme: 'Bà Nà Hills',
    activities: [],
  },
];

const MOCK_BREAKDOWN: BudgetBreakdown = {
  transitRoundTrip: 2400000,
  accommodation: 1600000,
  food: 900000,
  tickets: 300000,
  localTransit: 250000,
  totalEstimated: 5450000,
  partySize: 2,
};

const MOCK_ITINERARY: ItineraryDetail = {
  id: 'itinerary-1',
  title: 'Khám phá Đà Nẵng 3N2Đ',
  description: 'Lịch trình thư giãn ven sông Hàn',
  destination: 'Đà Nẵng',
  originCity: 'TP. Hồ Chí Minh',
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  totalDays: 3,
  budgetLevel: 'MEDIUM',
  pace: 'BALANCED',
  partySize: 2,
  status: 'DRAFT',
  isOwner: true,
  canEdit: true,
  canManageMembers: true,
  viewerRole: 'OWNER',
  intercityTransit: null,
  budgetBreakdown: MOCK_BREAKDOWN,
  days: MOCK_DAYS,
};

const MOCK_PROPOSAL: GroupProposalItem = {
  id: 'prop-1',
  tripGroupId: 'group-1',
  placeId: 'place-new',
  destinationId: null,
  dayNumber: 1,
  proposedStartTime: '19:30',
  notes: 'Quán thoáng mát gần cầu',
  status: 'PENDING',
  proposedBy: 'user-2',
  proposer: { userId: 'user-2', fullName: 'Minh Anh', avatarUrl: null },
  place: {
    id: 'place-new',
    name: 'Chợ đêm Helio',
    address: '2 Tháng 9, Hải Châu, Đà Nẵng',
    categoryName: 'Ẩm thực & Giải trí',
    imageUrl: null,
    ratingAvg: 4.5,
  },
  voteCount: 0,
  hasVoted: false,
  voters: [],
  createdAt: '2026-11-11T08:00:00.000Z',
};

describe('Phase 3 Group Workspace Flows', () => {
  const voteMutate = vi.fn();
  const resolveMutateAsync = vi.fn().mockResolvedValue({});
  const withdrawMutateAsync = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTripCompanions).mockReturnValue({
      data: {
        members: [
          { userId: 'user-1', fullName: 'Trưởng đoàn', avatarUrl: null, role: 'OWNER' },
          { userId: 'user-2', fullName: 'Minh Anh', avatarUrl: null, role: 'VIEWER' },
        ],
        pendingInvitations: [],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTripCompanions>);

    vi.mocked(useTripProposals).mockReturnValue({
      data: { proposals: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTripProposals>);

    vi.mocked(useToggleProposalVote).mockReturnValue({
      mutate: voteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useToggleProposalVote>);

    vi.mocked(useResolveGroupProposal).mockReturnValue({
      mutateAsync: resolveMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useResolveGroupProposal>);

    vi.mocked(useWithdrawGroupProposal).mockReturnValue({
      mutateAsync: withdrawMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useWithdrawGroupProposal>);
  });

  it('allows owner/editor to approve proposal immediately even with zero votes (advisory voting)', async () => {
    const user = userEvent.setup();
    const onToggleVote = vi.fn();
    const onResolve = vi.fn();
    const onWithdraw = vi.fn();

    render(
      <ProposalCard
        proposal={MOCK_PROPOSAL}
        memberCount={4}
        canEdit={true}
        currentUserId="user-2"
        onToggleVote={onToggleVote}
        onResolve={onResolve}
        onWithdraw={onWithdraw}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /Chốt vào lịch trình/i });
    expect(approveBtn).toBeEnabled();
    await user.click(approveBtn);
    expect(onResolve).toHaveBeenCalledWith('prop-1', 'APPROVE');

    await user.click(screen.getByRole('button', { name: /Từ chối/i }));
    expect(onResolve).toHaveBeenCalledWith('prop-1', 'REJECT');

    await user.click(screen.getByRole('button', { name: /Đồng ý/i }));
    expect(onToggleVote).toHaveBeenCalledWith('prop-1');

    await user.click(screen.getByRole('button', { name: /Rút đề xuất/i }));
    expect(onWithdraw).toHaveBeenCalledWith('prop-1');
  });

  it('renders empty and error states in TripProposalsPanel and triggers create proposal CTA', async () => {
    const user = userEvent.setup();
    const onOpenCreateProposal = vi.fn();
    const refetch = vi.fn();

    const { rerender } = render(
      <TripProposalsPanel
        itineraryId="itinerary-1"
        days={MOCK_DAYS}
        canEdit={true}
        isMemberOrOwner={true}
        currentUser={{ id: 'user-1', fullName: 'Trưởng đoàn', avatarUrl: null }}
        onOpenCreateProposal={onOpenCreateProposal}
      />
    );

    await user.click(screen.getByRole('button', { name: /Tạo đề xuất đầu tiên/i }));
    expect(onOpenCreateProposal).toHaveBeenCalledTimes(1);

    vi.mocked(useTripProposals).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch,
    } as unknown as ReturnType<typeof useTripProposals>);

    rerender(
      <TripProposalsPanel
        itineraryId="itinerary-1"
        days={MOCK_DAYS}
        canEdit={true}
        isMemberOrOwner={true}
        currentUser={{ id: 'user-1', fullName: 'Trưởng đoàn', avatarUrl: null }}
        onOpenCreateProposal={onOpenCreateProposal}
      />
    );

    expect(screen.getByText(/Không thể tải danh sách bình chọn/i)).toBeInTheDocument();
  });

  it('hides group tabs for public guests and triggers sync-member partySize banner for owners', async () => {
    const user = userEvent.setup();
    const onUpdatePartySize = vi.fn();

    const { rerender } = render(
      <ItineraryHeroHeader
        data={{ ...MOCK_ITINERARY, isOwner: false, canEdit: false, viewerRole: null }}
        activeCoverPhoto="https://example.com/cover.jpg"
        totalDays={3}
        totalNights={2}
        isOwner={false}
        canEdit={false}
        isMemberOrOwner={false}
        memberCount={1}
        members={[]}
        pendingProposalsCount={0}
        activeTab="itinerary"
        onSelectTab={vi.fn()}
        onBack={vi.fn()}
        onOpenCoverModal={vi.fn()}
        onOpenEditMetaModal={vi.fn()}
        onOpenCompanionsModal={vi.fn()}
        onOpenPrintModal={vi.fn()}
        onShare={vi.fn()}
        onClone={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        onUpdatePartySize={onUpdatePartySize}
      />
    );

    expect(screen.getByRole('tab', { name: /Lịch trình/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chi phí/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Bình chọn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Đoàn & Hướng dẫn/i })).not.toBeInTheDocument();

    rerender(
      <ItineraryHeroHeader
        data={MOCK_ITINERARY}
        activeCoverPhoto="https://example.com/cover.jpg"
        totalDays={3}
        totalNights={2}
        isOwner={true}
        canEdit={true}
        isMemberOrOwner={true}
        memberCount={4}
        members={[]}
        pendingProposalsCount={2}
        activeTab="itinerary"
        onSelectTab={vi.fn()}
        onBack={vi.fn()}
        onOpenCoverModal={vi.fn()}
        onOpenEditMetaModal={vi.fn()}
        onOpenCompanionsModal={vi.fn()}
        onOpenPrintModal={vi.fn()}
        onShare={vi.fn()}
        onClone={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        onUpdatePartySize={onUpdatePartySize}
      />
    );

    expect(screen.getByRole('tab', { name: /Bình chọn/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Đồng bộ sang 4 người/i }));
    expect(onUpdatePartySize).toHaveBeenCalledWith(4);
  });

  it('expands BudgetBreakdownCard traceability stops, jumps to stop, and steps partySize', async () => {
    const user = userEvent.setup();
    const onJumpToStop = vi.fn();
    const onUpdatePartySize = vi.fn();

    render(
      <BudgetBreakdownCard
        breakdown={MOCK_BREAKDOWN}
        days={MOCK_DAYS}
        transitModeName="Máy bay"
        totalDays={3}
        isOwner={true}
        onUpdatePartySize={onUpdatePartySize}
        onJumpToStop={onJumpToStop}
      />
    );

    await user.click(screen.getByRole('button', { name: /Tăng số người/i }));
    expect(onUpdatePartySize).toHaveBeenCalledWith(3);

    const accordionBtns = screen.getAllByRole('button', { name: /Xem 1 điểm tính phí/i });
    await user.click(accordionBtns[0]);

    await user.click(screen.getByRole('button', { name: /Mì Quảng Bà Mua/i }));
    expect(onJumpToStop).toHaveBeenCalledWith('place-food');
  });

  it('validates EditDestinationDialog time order and submits valid payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EditDestinationDialog
        open={true}
        onClose={onClose}
        activity={MOCK_ACTIVITY}
        days={MOCK_DAYS}
        onSubmit={onSubmit}
      />
    );

    const startInput = screen.getByLabelText(/Giờ bắt đầu/i);
    const endInput = screen.getByLabelText(/Giờ kết thúc/i);
    fireEvent.change(startInput, { target: { value: '14:00' } });
    fireEvent.change(endInput, { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));

    expect(await screen.findByText(/Giờ kết thúc phải sau giờ bắt đầu/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(endInput, { target: { value: '15:30' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('dest-1', {
        dayNumber: 1,
        startTime: '14:00',
        endTime: '15:30',
        notes: 'Check-in sáng',
      });
    });
  });

  it('validates EditItineraryMetaDialog title and submits updated metadata', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditItineraryMetaDialog
        open={true}
        onClose={vi.fn()}
        title="Tiêu đề cũ"
        description="Mô tả cũ"
        onSubmit={onSubmit}
      />
    );

    const titleInput = screen.getByLabelText(/Tên lịch trình/i);
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.submit(titleInput.closest('form')!);

    expect(await screen.findByText(/Tên lịch trình không được để trống/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(titleInput, { target: { value: '  Đà Nẵng Nhóm Bạn 4N3Đ  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Đà Nẵng Nhóm Bạn 4N3Đ',
        description: 'Mô tả cũ',
      });
    });
  });
});
