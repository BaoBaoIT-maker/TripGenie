import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { itineraryService } from "@/services/itinerary-planner.service";
import { tripProposalService } from "@/services/trip-companion.service";
import {
  itineraryKeys,
  useMoveDestination,
  useUpdateItineraryMeta,
} from "@/features/planner/hooks/use-itinerary-planner";
import {
  PROPOSALS_QUERY_KEYS,
  useCreateGroupProposal,
  useResolveGroupProposal,
  useToggleProposalVote,
  useTripProposals,
} from "@/features/planner/hooks/use-trip-proposals";
import type {
  GroupProposalItem,
  GroupProposalsListResponse,
  ItineraryDetail,
} from "@/types/itinerary";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/itinerary-planner.service", () => ({
  itineraryService: {
    updateItineraryMeta: vi.fn(),
    updatePartySize: vi.fn(),
    moveDestination: vi.fn(),
    chatCopilot: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message);
    }
    get status() {
      return this.statusCode;
    }
  },
}));

vi.mock("@/services/trip-companion.service", () => ({
  tripProposalService: {
    listProposals: vi.fn(),
    createProposal: vi.fn(),
    toggleVote: vi.fn(),
    resolveProposal: vi.fn(),
    withdrawProposal: vi.fn(),
  },
}));

const ITINERARY_ID = "itin-1";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makeProposal(overrides: Partial<GroupProposalItem> = {}): GroupProposalItem {
  return {
    id: "prop-1",
    tripGroupId: "group-1",
    placeId: "place-new",
    destinationId: "dest-1",
    dayNumber: 1,
    proposedStartTime: null,
    notes: "Quán mới view đẹp hơn",
    status: "PENDING",
    proposedBy: "user-2",
    proposer: { userId: "user-2", fullName: "Minh Thư", avatarUrl: null },
    place: {
      id: "place-new",
      name: "Sơn Trà Marina",
      address: "Hồ Xanh, Sơn Trà",
      categoryName: "Cà phê",
      imageUrl: null,
      ratingAvg: 4.8,
    },
    voteCount: 1,
    hasVoted: false,
    voters: [{ userId: "user-2", fullName: "Minh Thư", avatarUrl: null }],
    createdAt: "2026-11-11T09:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 2 Hooks: Trip Proposals & Itinerary Meta/Move", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("useTripProposals stays disabled for non-members and fetches for members", async () => {
    const guestHook = renderHook(() => useTripProposals(ITINERARY_ID, false), {
      wrapper: createWrapper(queryClient),
    });
    expect(guestHook.result.current.fetchStatus).toBe("idle");
    expect(tripProposalService.listProposals).not.toHaveBeenCalled();

    vi.mocked(tripProposalService.listProposals).mockResolvedValueOnce({
      proposals: [makeProposal()],
    });

    const memberHook = renderHook(() => useTripProposals(ITINERARY_ID, true), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(memberHook.result.current.isSuccess).toBe(true));
    expect(memberHook.result.current.data?.proposals).toHaveLength(1);
  });

  it("useToggleProposalVote applies 0ms optimistic vote and rolls back cleanly on server failure", async () => {
    const listKey = PROPOSALS_QUERY_KEYS.list(ITINERARY_ID);
    const initialProposal = makeProposal({ voteCount: 1, hasVoted: false });
    queryClient.setQueryData<GroupProposalsListResponse>(listKey, {
      proposals: [initialProposal],
    });

    let rejectVote!: (err: Error) => void;
    vi.mocked(tripProposalService.toggleVote).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectVote = reject;
        })
    );

    const currentUser = { userId: "user-1", fullName: "Tuấn Anh", avatarUrl: null };
    const { result } = renderHook(() => useToggleProposalVote(ITINERARY_ID, currentUser), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate("prop-1");
    });

    // Immediate optimistic update before server resolves
    await waitFor(() => {
      const cached = queryClient.getQueryData<GroupProposalsListResponse>(listKey);
      expect(cached?.proposals[0].hasVoted).toBe(true);
      expect(cached?.proposals[0].voteCount).toBe(2);
      expect(cached?.proposals[0].voters).toHaveLength(2);
    });

    // Server error -> rollback to original snapshot
    await act(async () => {
      rejectVote(new Error("Mạng gián đoạn"));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const rolledBack = queryClient.getQueryData<GroupProposalsListResponse>(listKey);
    expect(rolledBack?.proposals[0].hasVoted).toBe(false);
    expect(rolledBack?.proposals[0].voteCount).toBe(1);
    expect(rolledBack?.proposals[0].voters).toHaveLength(1);
  });

  it("useResolveGroupProposal updates itinerary detail cache and marks rival swap proposals REJECTED", async () => {
    const listKey = PROPOSALS_QUERY_KEYS.list(ITINERARY_ID);
    const winner = makeProposal({ id: "prop-win", destinationId: "dest-1" });
    const rival = makeProposal({
      id: "prop-rival",
      placeId: "place-other",
      destinationId: "dest-1",
    });
    const otherSlot = makeProposal({
      id: "prop-other-slot",
      placeId: "place-2",
      destinationId: "dest-2",
    });

    queryClient.setQueryData<GroupProposalsListResponse>(listKey, {
      proposals: [winner, rival, otherSlot],
    });

    const updatedItinerary = {
      id: ITINERARY_ID,
      title: "Đà Nẵng mới",
      days: [],
    } as unknown as ItineraryDetail;

    vi.mocked(tripProposalService.resolveProposal).mockResolvedValueOnce({
      proposal: { ...winner, status: "APPROVED" },
      itinerary: updatedItinerary,
    });

    const { result } = renderHook(() => useResolveGroupProposal(ITINERARY_ID), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ proposalId: "prop-win", action: "APPROVE" });
    });

    const cachedList = queryClient.getQueryData<GroupProposalsListResponse>(listKey);
    expect(cachedList?.proposals.find((p) => p.id === "prop-win")?.status).toBe("APPROVED");
    expect(cachedList?.proposals.find((p) => p.id === "prop-rival")?.status).toBe("REJECTED");
    expect(cachedList?.proposals.find((p) => p.id === "prop-other-slot")?.status).toBe("PENDING");
    expect(queryClient.getQueryData(itineraryKeys.detail(ITINERARY_ID))).toEqual(updatedItinerary);
  });

  it("useCreateGroupProposal, useUpdateItineraryMeta, and useMoveDestination update caches cleanly", async () => {
    const created = makeProposal({ id: "prop-new" });
    vi.mocked(tripProposalService.createProposal).mockResolvedValueOnce(created);

    const createHook = renderHook(() => useCreateGroupProposal(ITINERARY_ID), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await createHook.result.current.mutateAsync({ placeId: "place-new", dayNumber: 1 });
    });
    expect(
      queryClient.getQueryData<GroupProposalsListResponse>(
        PROPOSALS_QUERY_KEYS.list(ITINERARY_ID)
      )?.proposals[0].id
    ).toBe("prop-new");

    const updatedMeta = { id: ITINERARY_ID, title: "Đà Nẵng Chill", days: [] } as unknown as ItineraryDetail;
    vi.mocked(itineraryService.updateItineraryMeta).mockResolvedValueOnce(updatedMeta);
    const metaHook = renderHook(() => useUpdateItineraryMeta(ITINERARY_ID), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await metaHook.result.current.mutateAsync({ title: "Đà Nẵng Chill" });
    });
    expect(itineraryService.updateItineraryMeta).toHaveBeenCalledWith(ITINERARY_ID, {
      title: "Đà Nẵng Chill",
    });
    expect(queryClient.getQueryData(itineraryKeys.detail(ITINERARY_ID))).toEqual(updatedMeta);

    const movedDetail = { id: ITINERARY_ID, title: "Đã đẩy điểm", days: [] } as unknown as ItineraryDetail;
    vi.mocked(itineraryService.moveDestination).mockResolvedValueOnce(movedDetail);
    const moveHook = renderHook(() => useMoveDestination(ITINERARY_ID), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await moveHook.result.current.mutateAsync({ destinationId: "dest-1", direction: "DOWN" });
    });
    expect(itineraryService.moveDestination).toHaveBeenCalledWith(
      ITINERARY_ID,
      "dest-1",
      "DOWN"
    );
    expect(queryClient.getQueryData(itineraryKeys.detail(ITINERARY_ID))).toEqual(movedDetail);
  });
});
