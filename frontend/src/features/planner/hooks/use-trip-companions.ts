'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import {
  tripCompanionService,
  CompanionsListResponse,
  InvitationSummary,
} from '@/services/trip-companion.service';
import { TRIP_COMPANIONS_CONFIG } from '../config/trip-companions.config';

export const COMPANIONS_QUERY_KEYS = {
  all: ['trip-companions'] as const,
  list: (itineraryId: string) => ['itineraries', itineraryId, 'companions'] as const,
  invitation: (invitationId: string) => ['trip-invitations', invitationId] as const,
};

export function useTripCompanions(itineraryId: string, enabled = true) {
  return useQuery<CompanionsListResponse>({
    queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId),
    queryFn: () => tripCompanionService.getCompanions(itineraryId),
    enabled: Boolean(itineraryId) && enabled,
    refetchInterval: TRIP_COMPANIONS_CONFIG.POLLING_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useTripInvitation(invitationId: string, enabled = true) {
  return useQuery<InvitationSummary>({
    queryKey: COMPANIONS_QUERY_KEYS.invitation(invitationId),
    queryFn: () => tripCompanionService.getInvitation(invitationId),
    enabled: Boolean(invitationId) && enabled,
    retry: false,
  });
}

export function useInviteCompanion(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (email: string) => tripCompanionService.inviteCompanion(itineraryId, email),
    onSuccess: () => {
      toast.success(t('planner.companions.toasts.inviteSuccess'));
      queryClient.invalidateQueries({ queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.inviteError'));
    },
  });
}

export function useUpdateMemberRole(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'VIEWER' | 'EDITOR' }) =>
      tripCompanionService.updateMemberRole(itineraryId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId) });
      const previousData = queryClient.getQueryData<CompanionsListResponse>(
        COMPANIONS_QUERY_KEYS.list(itineraryId)
      );

      if (previousData) {
        queryClient.setQueryData<CompanionsListResponse>(
          COMPANIONS_QUERY_KEYS.list(itineraryId),
          {
            ...previousData,
            members: previousData.members.map((m) =>
              m.userId === userId ? { ...m, role } : m
            ),
          }
        );
      }

      return { previousData };
    },
    onError: (err: Error, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          COMPANIONS_QUERY_KEYS.list(itineraryId),
          context.previousData
        );
      }
      toast.error(err.message || t('planner.companions.toasts.roleUpdateError'));
    },
    onSuccess: (_, variables) => {
      toast.success(
        t('planner.companions.toasts.roleUpdated', {
          role: t(`planner.roles.${variables.role}`),
        })
      );
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
      queryClient.invalidateQueries({ queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId) });
      queryClient.invalidateQueries({ queryKey: ['itineraries', 'detail', itineraryId] });
    },
  });
}

export function useRemoveMember(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (userId: string) => tripCompanionService.removeMember(itineraryId, userId),
    onSuccess: () => {
      toast.success(t('planner.companions.toasts.memberRemoved'));
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
      queryClient.invalidateQueries({ queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId) });
      queryClient.invalidateQueries({ queryKey: ['itineraries', 'detail', itineraryId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.memberRemoveError'));
    },
  });
}

export function useLeaveTrip(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: () => tripCompanionService.leaveTrip(itineraryId),
    onSuccess: () => {
      toast.success(t('planner.companions.toasts.leftTrip'));
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.leaveTripError'));
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (invitationId: string) => tripCompanionService.acceptInvitation(invitationId),
    onSuccess: () => {
      toast.success(t('planner.companions.toasts.invitationAccepted'));
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.invitationAcceptError'));
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (invitationId: string) => tripCompanionService.declineInvitation(invitationId),
    onSuccess: () => {
      toast.info(t('planner.companions.toasts.invitationDeclined'));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.invitationDeclineError'));
    },
  });
}

export function useRevokeInvitation(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (invitationId: string) => tripCompanionService.revokeInvitation(invitationId),
    onSuccess: () => {
      toast.success(t('planner.companions.toasts.invitationRevoked'));
      queryClient.invalidateQueries({ queryKey: COMPANIONS_QUERY_KEYS.list(itineraryId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('planner.companions.toasts.invitationRevokeError'));
    },
  });
}
