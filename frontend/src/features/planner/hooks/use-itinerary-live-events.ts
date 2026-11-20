'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-client';
import type {
  GroupProposalItem,
  GroupProposalsListResponse,
  ProposalResolveAction,
} from '@/types/itinerary';
import { TRIP_COMPANIONS_CONFIG } from '../config/trip-companions.config';
import { itineraryKeys } from './use-itinerary-planner';
import { PROPOSALS_QUERY_KEYS } from './use-trip-proposals';

export type ItineraryLiveEventType =
  | 'PROPOSAL_VOTED'
  | 'PROPOSAL_CREATED'
  | 'PROPOSAL_RESOLVED'
  | 'PROPOSAL_WITHDRAWN'
  | 'STOPS_REORDERED';

export interface ItineraryLiveEvent<T = unknown> {
  type: ItineraryLiveEventType;
  itineraryId: string;
  actor: {
    userId: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  };
  payload: T;
  timestamp: string;
}

export interface ProposalVotedPayload {
  proposalId: string;
  voted: boolean;
  voteCount: number;
  proposal: GroupProposalItem;
}

export interface ProposalResolvedPayload {
  proposalId: string;
  action: ProposalResolveAction;
  proposal: GroupProposalItem;
}

export interface ProposalWithdrawnPayload {
  proposalId: string;
}

export interface StopsReorderedPayload {
  destinationId: string;
  direction: 'UP' | 'DOWN';
}

/**
 * Real-time SSE collaboration hook for an itinerary.
 * Automatically subscribes to server-sent events for the itinerary,
 * updates TanStack Query cache in 0ms, and displays actor-attributed toasts.
 * Auto-closes on unmount or tab close. Zero external dependencies.
 */
export function useItineraryLiveEvents(
  itineraryId: string,
  currentUserId?: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !itineraryId || typeof window === 'undefined') return;

    const streamUrl = `${API_BASE_URL}/itineraries/${itineraryId}/live-events`;
    const es = new EventSource(streamUrl, { withCredentials: true });
    eventSourceRef.current = es;

    const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);
    const detailKey = itineraryKeys.detail(itineraryId);

    es.onmessage = (event) => {
      if (!event.data) return;

      try {
        const liveEvent = JSON.parse(event.data) as ItineraryLiveEvent;
        if (!liveEvent || !liveEvent.type) return;

        // Self-suppression: do not toast or re-mutate for the actor's own local actions
        const isSelf = Boolean(
          currentUserId && liveEvent.actor?.userId === currentUserId,
        );

        switch (liveEvent.type) {
          case 'PROPOSAL_VOTED': {
            const { proposalId, proposal } =
              liveEvent.payload as ProposalVotedPayload;

            queryClient.setQueryData<GroupProposalsListResponse>(
              listKey,
              (old) => {
                if (!old) return old;
                return {
                  proposals: old.proposals.map((item) =>
                    item.id === proposalId
                      ? {
                          ...item,
                          voteCount: proposal.voteCount,
                          voters: proposal.voters,
                          // If current user is not the voter, keep current user's local hasVoted state intact
                          hasVoted: isSelf ? proposal.hasVoted : item.hasVoted,
                        }
                      : item,
                  ),
                };
              },
            );

            if (!isSelf) {
              toast.info(
                TRIP_COMPANIONS_CONFIG.LIVE_NOTIFICATIONS.PROPOSAL_VOTED(
                  liveEvent.actor.fullName,
                ),
              );
            }
            break;
          }

          case 'PROPOSAL_CREATED': {
            const createdProposal = liveEvent.payload as GroupProposalItem;

            queryClient.setQueryData<GroupProposalsListResponse>(
              listKey,
              (old) => {
                if (!old) return { proposals: [createdProposal] };
                if (old.proposals.some((p) => p.id === createdProposal.id)) {
                  return old;
                }
                return {
                  proposals: [createdProposal, ...old.proposals],
                };
              },
            );

            if (!isSelf) {
              toast.info(
                TRIP_COMPANIONS_CONFIG.LIVE_NOTIFICATIONS.PROPOSAL_CREATED(
                  liveEvent.actor.fullName,
                ),
              );
            }
            break;
          }

          case 'PROPOSAL_RESOLVED': {
            const { proposalId, action, proposal } =
              liveEvent.payload as ProposalResolvedPayload;

            queryClient.setQueryData<GroupProposalsListResponse>(
              listKey,
              (old) => {
                if (!old) return old;
                return {
                  proposals: old.proposals.map((p) =>
                    p.id === proposalId ? { ...p, status: proposal.status } : p,
                  ),
                };
              },
            );

            // Re-fetch timeline detail if approved so new place appears immediately
            if (action === 'APPROVE') {
              void queryClient.invalidateQueries({ queryKey: detailKey });
            }

            if (!isSelf) {
              toast.info(
                TRIP_COMPANIONS_CONFIG.LIVE_NOTIFICATIONS.PROPOSAL_RESOLVED(
                  action === 'APPROVE',
                  liveEvent.actor.fullName,
                ),
              );
            }
            break;
          }

          case 'PROPOSAL_WITHDRAWN': {
            const { proposalId } = liveEvent.payload as ProposalWithdrawnPayload;

            queryClient.setQueryData<GroupProposalsListResponse>(
              listKey,
              (old) => {
                if (!old) return old;
                return {
                  proposals: old.proposals.filter((p) => p.id !== proposalId),
                };
              },
            );

            if (!isSelf) {
              toast.info(
                TRIP_COMPANIONS_CONFIG.LIVE_NOTIFICATIONS.PROPOSAL_WITHDRAWN(
                  liveEvent.actor.fullName,
                ),
              );
            }
            break;
          }

          case 'STOPS_REORDERED': {
            // Background re-fetch updated timeline order
            void queryClient.invalidateQueries({ queryKey: detailKey });

            if (!isSelf) {
              toast.info(
                TRIP_COMPANIONS_CONFIG.LIVE_NOTIFICATIONS.STOPS_REORDERED(
                  liveEvent.actor.fullName,
                ),
              );
            }
            break;
          }
        }
      } catch {
        // Ignore malformed heartbeat or transient non-JSON stream events
      }
    };

    es.onerror = () => {
      // EventSource automatically retries connection; no custom backoff code needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled, itineraryId, currentUserId, queryClient]);
}
