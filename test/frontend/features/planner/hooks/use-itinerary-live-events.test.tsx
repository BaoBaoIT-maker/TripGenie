import type { ReactNode } from 'react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useItineraryLiveEvents } from '@/features/planner/hooks/use-itinerary-live-events';
import { PROPOSALS_QUERY_KEYS } from '@/features/planner/hooks/use-trip-proposals';
import type { GroupProposalsListResponse } from '@/types/itinerary';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(init?.withCredentials);
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  triggerMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

// Attach mock EventSource to window
vi.stubGlobal('EventSource', MockEventSource);

describe('useItineraryLiveEvents', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('subscribes to SSE stream and updates cache when PROPOSAL_VOTED event arrives', () => {
    const itineraryId = 'itinerary-123';
    const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);

    // Seed initial proposals in cache
    const initialData: GroupProposalsListResponse = {
      proposals: [
        {
          id: 'prop-1',
          placeId: 'place-1',
          placeName: 'Quán Cơm Gà',
          placeAddress: 'Đà Nẵng',
          placeRatingAvg: 4.8,
          placePriceLevel: 'MEDIUM',
          placeImageUrl: null,
          proposedBy: 'user-other',
          proposerName: 'Nguyen Van B',
          proposerAvatar: null,
          destinationId: null,
          targetStopName: null,
          dayNumber: 1,
          proposedStartTime: null,
          notes: null,
          status: 'PENDING',
          voteCount: 1,
          hasVoted: false,
          voters: [],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    queryClient.setQueryData(listKey, initialData);

    const { unmount } = renderHook(
      () => useItineraryLiveEvents(itineraryId, 'user-current'),
      { wrapper: createWrapper() },
    );

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain(`/itineraries/${itineraryId}/live-events`);
    expect(es.withCredentials).toBe(true);

    // Simulate event sent by another user (user-other)
    act(() => {
      es.triggerMessage({
        type: 'PROPOSAL_VOTED',
        itineraryId,
        actor: { userId: 'user-other', fullName: 'Nguyen Van B' },
        payload: {
          proposalId: 'prop-1',
          voted: true,
          voteCount: 2,
          proposal: {
            ...initialData.proposals[0],
            voteCount: 2,
            voters: [{ userId: 'user-other', fullName: 'Nguyen Van B', avatarUrl: null, role: 'MEMBER' }],
          },
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Cache should be updated with new vote count
    const updated = queryClient.getQueryData<GroupProposalsListResponse>(listKey);
    expect(updated?.proposals[0].voteCount).toBe(2);

    // Toast should be shown because action was performed by someone else
    expect(toast.info).toHaveBeenCalledWith('Nguyen Van B vừa bình chọn đề xuất!');

    // Test unmount cleanup
    unmount();
    expect(es.closed).toBe(true);
  });

  it('suppresses toast notifications for events triggered by the current user', () => {
    const itineraryId = 'itinerary-123';
    const currentUserId = 'user-current';

    renderHook(
      () => useItineraryLiveEvents(itineraryId, currentUserId),
      { wrapper: createWrapper() },
    );

    const es = MockEventSource.instances[0];

    // Simulate event from current user
    act(() => {
      es.triggerMessage({
        type: 'PROPOSAL_VOTED',
        itineraryId,
        actor: { userId: currentUserId, fullName: 'My Self' },
        payload: {
          proposalId: 'prop-1',
          voted: true,
          voteCount: 3,
          proposal: { id: 'prop-1', voteCount: 3, voters: [] },
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Should NOT show toast to self
    expect(toast.info).not.toHaveBeenCalled();
  });
});
