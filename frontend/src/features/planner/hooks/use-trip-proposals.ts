'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { ApiError } from '@/services/itinerary-planner.service';
import { tripProposalService } from '@/services/trip-companion.service';
import type {
  CreateGroupProposalRequest,
  GroupProposalItem,
  GroupProposalParticipant,
  GroupProposalsListResponse,
  ProposalResolveAction,
} from '@/types/itinerary';
import { TRIP_COMPANIONS_CONFIG } from '../config/trip-companions.config';
import { NON_RETRYABLE_HTTP_STATUS } from '../constants/itinerary.constants';
import { itineraryKeys } from './use-itinerary-planner';

export const PROPOSALS_QUERY_KEYS = {
  list: (itineraryId: string) => ['itineraries', itineraryId, 'proposals'] as const,
};

function isNonRetryableError(error: unknown): boolean {
  return error instanceof ApiError && NON_RETRYABLE_HTTP_STATUS.includes(error.status);
}

function applyOptimisticVoteToggle(
  proposal: GroupProposalItem,
  currentUser?: GroupProposalParticipant | null,
): GroupProposalItem {
  const nextHasVoted = !proposal.hasVoted;
  const nextVoteCount = Math.max(0, proposal.voteCount + (nextHasVoted ? 1 : -1));

  let nextVoters = proposal.voters;
  if (currentUser) {
    if (nextHasVoted) {
      const alreadyListed = proposal.voters.some((v) => v.userId === currentUser.userId);
      nextVoters = alreadyListed ? proposal.voters : [...proposal.voters, currentUser];
    } else {
      nextVoters = proposal.voters.filter((v) => v.userId !== currentUser.userId);
    }
  }

  return { ...proposal, hasVoted: nextHasVoted, voteCount: nextVoteCount, voters: nextVoters };
}

/**
 * Smart polling (8s while tab is visible) for group proposals & advisory votes.
 * Polling stops only on non-recoverable errors (401/403/404); transient failures keep retrying.
 */
export function useTripProposals(itineraryId: string, enabled = true) {
  return useQuery<GroupProposalsListResponse>({
    queryKey: PROPOSALS_QUERY_KEYS.list(itineraryId),
    queryFn: () => tripProposalService.listProposals(itineraryId),
    enabled: Boolean(itineraryId) && enabled,
    refetchInterval: (query) =>
      isNonRetryableError(query.state.error)
        ? false
        : TRIP_COMPANIONS_CONFIG.PROPOSALS_POLLING_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: (_, err) => !isNonRetryableError(err),
  });
}

export function useCreateGroupProposal(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);

  return useMutation({
    mutationFn: (dto: CreateGroupProposalRequest) =>
      tripProposalService.createProposal(itineraryId, dto),
    onSuccess: (created) => {
      queryClient.setQueryData<GroupProposalsListResponse>(listKey, (prev) => ({
        proposals: [created, ...(prev?.proposals.filter((p) => p.id !== created.id) ?? [])],
      }));
      queryClient.invalidateQueries({ queryKey: listKey });
      toast.success(t('planner.proposals.toasts.createSuccess'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.proposals.toasts.createError'));
    },
  });
}

/**
 * 0ms Optimistic UI toggle for advisory member votes with rollback on error;
 * always re-syncs with the server once settled.
 */
export function useToggleProposalVote(
  itineraryId: string,
  currentUser?: GroupProposalParticipant | null,
) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);

  return useMutation({
    mutationFn: (proposalId: string) => tripProposalService.toggleVote(itineraryId, proposalId),
    onMutate: async (proposalId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousData = queryClient.getQueryData<GroupProposalsListResponse>(listKey);

      if (previousData) {
        queryClient.setQueryData<GroupProposalsListResponse>(listKey, {
          proposals: previousData.proposals.map((item) =>
            item.id === proposalId ? applyOptimisticVoteToggle(item, currentUser) : item,
          ),
        });
      }

      return { previousData };
    },
    onError: (err: Error, _proposalId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(listKey, context.previousData);
      }
      toast.error(err.message || t('planner.proposals.toasts.voteError'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

export function useResolveGroupProposal(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);

  return useMutation({
    mutationFn: ({
      proposalId,
      action,
    }: {
      proposalId: string;
      action: ProposalResolveAction;
    }) => tripProposalService.resolveProposal(itineraryId, proposalId, action),
    onSuccess: (res, variables) => {
      const approvedProposal = res.proposal;
      queryClient.setQueryData<GroupProposalsListResponse>(listKey, (prev) => {
        if (!prev) return prev;
        return {
          proposals: prev.proposals.map((p) => {
            if (p.id === approvedProposal.id) return approvedProposal;
            // Optimistic: mark rival PENDING swaps for the same destination as REJECTED.
            // Server will confirm on the next refetch; this avoids a stale "pending" flicker.
            if (
              variables.action === 'APPROVE' &&
              p.status === 'PENDING' &&
              approvedProposal.destinationId &&
              p.destinationId === approvedProposal.destinationId &&
              p.id !== approvedProposal.id
            ) {
              return { ...p, status: 'REJECTED' as const };
            }
            return p;
          }),
        };
      });
      queryClient.invalidateQueries({ queryKey: listKey });

      if (res.itinerary) {
        queryClient.setQueryData(itineraryKeys.detail(itineraryId), res.itinerary);
        queryClient.invalidateQueries({ queryKey: itineraryKeys.lists() });
      }

      toast.success(
        variables.action === 'APPROVE'
          ? t('planner.proposals.toasts.approveSuccess')
          : t('planner.proposals.toasts.rejectSuccess'),
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.proposals.toasts.resolveError'));
    },
  });
}

export function useWithdrawGroupProposal(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const listKey = PROPOSALS_QUERY_KEYS.list(itineraryId);

  return useMutation({
    mutationFn: (proposalId: string) =>
      tripProposalService.withdrawProposal(itineraryId, proposalId),
    onMutate: async (proposalId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousData = queryClient.getQueryData<GroupProposalsListResponse>(listKey);

      if (previousData) {
        queryClient.setQueryData<GroupProposalsListResponse>(listKey, {
          proposals: previousData.proposals.filter((item) => item.id !== proposalId),
        });
      }

      return { previousData };
    },
    onError: (err: Error, _proposalId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(listKey, context.previousData);
      }
      toast.error(err.message || t('planner.proposals.toasts.withdrawError'));
    },
    onSuccess: () => {
      toast.success(t('planner.proposals.toasts.withdrawSuccess'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
