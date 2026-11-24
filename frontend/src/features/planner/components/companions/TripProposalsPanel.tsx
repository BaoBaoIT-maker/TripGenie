'use client';

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { useI18n, type MessageKey } from '@/i18n';
import { TRIP_COMPANIONS_CONFIG } from '../../config/trip-companions.config';
import { useTripCompanions } from '../../hooks/use-trip-companions';
import {
  useResolveGroupProposal,
  useToggleProposalVote,
  useTripProposals,
  useWithdrawGroupProposal,
} from '../../hooks/use-trip-proposals';
import { ProposalCard } from './ProposalCard';
import type {
  GroupProposalItem,
  GroupProposalParticipant,
  ItineraryActivity,
  ItineraryDay,
  ProposalResolveAction,
} from '@/types/itinerary';

interface TripProposalsPanelProps {
  itineraryId: string;
  days: ItineraryDay[];
  canEdit: boolean;
  isMemberOrOwner: boolean;
  currentUser?: { id?: string; fullName?: string; avatarUrl?: string | null } | null;
  onOpenCreateProposal: () => void;
  onOpenCompanionsModal?: () => void;
}

export function TripProposalsPanel({
  itineraryId,
  days,
  canEdit,
  isMemberOrOwner,
  currentUser,
  onOpenCreateProposal,
  onOpenCompanionsModal,
}: TripProposalsPanelProps) {
  const { t } = useI18n();
  const [showHistory, setShowHistory] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const {
    data: proposalsData,
    isLoading,
    error,
    refetch,
  } = useTripProposals(itineraryId, isMemberOrOwner);
  const { data: companionsData } = useTripCompanions(itineraryId, isMemberOrOwner);

  const currentParticipant: GroupProposalParticipant | null = useMemo(() => {
    if (!currentUser?.id) return null;
    return {
      userId: currentUser.id,
      fullName: currentUser.fullName || t('planner.common.you'),
      avatarUrl: currentUser.avatarUrl ?? null,
    };
  }, [currentUser, t]);

  const voteMutation = useToggleProposalVote(itineraryId, currentParticipant);
  const resolveMutation = useResolveGroupProposal(itineraryId);
  const withdrawMutation = useWithdrawGroupProposal(itineraryId);

  const stopLookup = useMemo(() => {
    const map = new Map<string, ItineraryActivity & { dayNumber: number }>();
    for (const day of days) {
      for (const act of day.activities) {
        if (act.id) {
          map.set(act.id, { ...act, dayNumber: day.dayNumber });
        }
      }
    }
    return map;
  }, [days]);

  const proposals = useMemo(() => proposalsData?.proposals ?? [], [proposalsData?.proposals]);
  const members = companionsData?.members ?? [];
  const memberCount = Math.max(1, members.length);

  const { swapGroups, newByDay, historyItems, pendingCount } = useMemo(() => {
    const swapMap = new Map<
      string,
      { destinationId: string; targetName: string; dayNumber: number; items: GroupProposalItem[] }
    >();
    const addDayMap = new Map<number, GroupProposalItem[]>();
    const history: GroupProposalItem[] = [];
    let pending = 0;

    for (const p of proposals) {
      if (p.status !== 'PENDING') {
        history.push(p);
        continue;
      }
      pending++;
      if (p.destinationId) {
        const target = stopLookup.get(p.destinationId);
        const existing = swapMap.get(p.destinationId);
        if (existing) {
          existing.items.push(p);
        } else {
          swapMap.set(p.destinationId, {
            destinationId: p.destinationId,
            targetName: target?.placeName || t('planner.proposals.selectedStopFallback'),
            dayNumber: target?.dayNumber ?? p.dayNumber,
            items: [p],
          });
        }
      } else {
        const list = addDayMap.get(p.dayNumber) ?? [];
        list.push(p);
        addDayMap.set(p.dayNumber, list);
      }
    }

    const sortedNewDays = Array.from(addDayMap.entries()).sort(([a], [b]) => a - b);
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      swapGroups: Array.from(swapMap.values()),
      newByDay: sortedNewDays,
      historyItems: history,
      pendingCount: pending,
    };
  }, [proposals, stopLookup, t]);

  const handleToggleVote = (proposalId: string) => {
    voteMutation.mutate(proposalId);
  };

  const handleResolve = async (proposalId: string, action: ProposalResolveAction) => {
    try {
      setResolvingId(proposalId);
      await resolveMutation.mutateAsync({ proposalId, action });
    } finally {
      setResolvingId(null);
    }
  };

  const handleWithdraw = async (proposalId: string) => {
    try {
      setWithdrawingId(proposalId);
      await withdrawMutation.mutateAsync(proposalId);
    } finally {
      setWithdrawingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl bg-white" />
          <Skeleton className="h-44 w-full rounded-2xl bg-white" />
          <Skeleton className="h-44 w-full rounded-2xl bg-white" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-64 w-full rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t('planner.proposals.loadErrorTitle')}
        message={t('planner.proposals.loadErrorMessage')}
        onRetry={() => refetch()}
        className="bg-white border-slate-200"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Active Proposals & History */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-check-to-slot text-[#0194F3]" aria-hidden="true" />
              <span>{t('planner.proposals.panelTitle', { count: pendingCount })}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {t('planner.proposals.panelDesc')}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCreateProposal}
            className="h-9 px-3.5 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            <span>{t('planner.proposals.proposeNewBtn')}</span>
          </button>
        </div>

        {/* Empty State */}
        {pendingCount === 0 && historyItems.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center space-y-3">
            <div className="size-12 rounded-2xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center mx-auto">
              <i className="fa-solid fa-check-to-slot text-lg" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-slate-900">
                {t('planner.proposals.emptyTitle')}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('planner.proposals.emptyDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateProposal}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
              <span>{t('planner.proposals.createFirstBtn')}</span>
            </button>
          </div>
        )}

        {/* Swap Proposals Grouped by Target Stop */}
        {swapGroups.map((group) => (
          <section key={group.destinationId} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i className="fa-solid fa-right-left text-[#0194F3]" aria-hidden="true" />
                <span>
                  {t('planner.proposals.swapGroupTitle', {
                    name: group.targetName,
                    day: group.dayNumber,
                  })}
                </span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {t('planner.proposals.optionsCount', { count: group.items.length })}
              </span>
            </div>

            <div className="space-y-2.5">
              {group.items.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  memberCount={memberCount}
                  canEdit={canEdit}
                  currentUserId={currentUser?.id}
                  targetStopName={group.targetName}
                  onToggleVote={handleToggleVote}
                  onResolve={handleResolve}
                  onWithdraw={handleWithdraw}
                  isResolving={resolvingId === proposal.id}
                  isWithdrawing={withdrawingId === proposal.id}
                />
              ))}
            </div>
          </section>
        ))}

        {/* New Place Additions Grouped by Day */}
        {newByDay.map(([dayNumber, items]) => (
          <section key={`add-day-${dayNumber}`} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <i className="fa-regular fa-calendar-plus text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.proposals.addDayGroupTitle', { day: dayNumber })}</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {t('planner.common.stopsShort', { count: items.length })}
              </span>
            </div>

            <div className="space-y-2.5">
              {items.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  memberCount={memberCount}
                  canEdit={canEdit}
                  currentUserId={currentUser?.id}
                  onToggleVote={handleToggleVote}
                  onResolve={handleResolve}
                  onWithdraw={handleWithdraw}
                  isResolving={resolvingId === proposal.id}
                  isWithdrawing={withdrawingId === proposal.id}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Empty pending state when only resolved history exists */}
        {pendingCount === 0 && historyItems.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              {t('planner.proposals.noPendingNote')}
            </p>
            <button
              type="button"
              onClick={onOpenCreateProposal}
              className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
            >
              {t('planner.proposals.proposeMoreLink')}
            </button>
          </div>
        )}

        {/* Collapsed Resolved History */}
        {historyItems.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-slate-400" aria-hidden="true" />
                <span>
                  {t('planner.proposals.historyHeading', { count: historyItems.length })}
                </span>
              </span>
              <i
                className={`fa-solid fa-chevron-down text-[11px] text-slate-400 transition-transform ${
                  showHistory ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {showHistory && (
              <div className="p-4 pt-0 space-y-2.5 border-t border-slate-100">
                <div className="pt-3 space-y-2.5">
                  {historyItems.map((proposal) => {
                    const targetName = proposal.destinationId
                      ? stopLookup.get(proposal.destinationId)?.placeName
                      : undefined;
                    return (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        memberCount={memberCount}
                        canEdit={canEdit}
                        currentUserId={currentUser?.id}
                        targetStopName={targetName}
                        onToggleVote={handleToggleVote}
                        onResolve={handleResolve}
                        onWithdraw={handleWithdraw}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Real Group Members Participation Sidebar */}
      <aside className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#10243A] flex items-center gap-2">
                <i className="fa-solid fa-users text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.proposals.groupMembersHeading', { count: members.length })}</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {t('planner.proposals.autoSyncSubtitle', {
                  seconds: Math.round(TRIP_COMPANIONS_CONFIG.PROPOSALS_POLLING_INTERVAL_MS / 1000),
                })}
              </p>
            </div>

            {onOpenCompanionsModal && (
              <button
                type="button"
                onClick={onOpenCompanionsModal}
                className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer shrink-0"
              >
                {t('planner.common.manage')}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.userId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-8 border border-slate-200 shrink-0">
                    <AvatarImage src={m.avatarUrl || undefined} alt={m.fullName} />
                    <AvatarFallback className="text-[11px] font-bold bg-[#10243A] text-white">
                      {m.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#10243A] truncate">
                      {m.fullName}
                      {currentUser?.id === m.userId && (
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-500">
                          {t('planner.common.youParen')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    m.role === 'OWNER'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : m.role === 'EDITOR'
                        ? 'bg-[#F0F7FF] text-[#0194F3] border border-[#D0E7FF]'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t(`planner.roles.${m.role}` as MessageKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
