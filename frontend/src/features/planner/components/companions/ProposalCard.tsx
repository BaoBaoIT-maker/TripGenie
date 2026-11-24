'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useI18n, type MessageKey } from '@/i18n';
import { TRIP_COMPANIONS_CONFIG } from '../../config/trip-companions.config';
import type { GroupProposalItem, ProposalResolveAction } from '@/types/itinerary';

interface ProposalCardProps {
  proposal: GroupProposalItem;
  memberCount: number;
  canEdit: boolean;
  currentUserId?: string;
  targetStopName?: string;
  onToggleVote: (proposalId: string) => void;
  onResolve: (proposalId: string, action: ProposalResolveAction) => void;
  onWithdraw: (proposalId: string) => void;
  isResolving?: boolean;
  isWithdrawing?: boolean;
}

export function ProposalCard({
  proposal,
  memberCount,
  canEdit,
  currentUserId,
  targetStopName,
  onToggleVote,
  onResolve,
  onWithdraw,
  isResolving = false,
  isWithdrawing = false,
}: ProposalCardProps) {
  const { t } = useI18n();
  const isPending = proposal.status === 'PENDING';
  const isProposer = Boolean(currentUserId && proposal.proposedBy === currentUserId);
  const statusMeta = TRIP_COMPANIONS_CONFIG.PROPOSAL_STATUS_META[proposal.status];
  const statusLabel = t(`planner.proposals.status.${proposal.status}` as MessageKey);
  const denominator = Math.max(1, memberCount);
  const voteRatioPct = Math.min(100, Math.round((proposal.voteCount / denominator) * 100));
  const isBusy = isResolving || isWithdrawing;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 transition-colors hover:border-[#0194F3]/40">
      {/* Top Row: Place Thumbnail, Title, Status Badge */}
      <div className="flex items-start gap-3">
        <div className="size-14 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
          {proposal.place.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proposal.place.imageUrl}
              alt={proposal.place.name}
              className="size-full object-cover"
            />
          ) : (
            <i className="fa-solid fa-location-dot text-slate-400 text-base" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0194F3] text-[10px] font-bold">
                {proposal.destinationId
                  ? t('planner.proposals.cardSwapBadge')
                  : t('planner.proposals.cardAddBadge', { day: proposal.dayNumber })}
              </span>
              {proposal.place.categoryName && (
                <span className="text-[11px] font-medium text-slate-500">
                  {proposal.place.categoryName}
                </span>
              )}
              {proposal.proposedStartTime && (
                <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                  • {proposal.proposedStartTime}
                </span>
              )}
            </div>

            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusMeta.badgeClass}`}
            >
              {statusLabel}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
            {proposal.place.name}
          </h4>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
            {proposal.place.address && (
              <span className="truncate max-w-full flex items-center gap-1">
                <i className="fa-solid fa-location-dot text-[10px] text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{proposal.place.address}</span>
              </span>
            )}
            {proposal.place.ratingAvg != null && proposal.place.ratingAvg > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 tabular-nums shrink-0">
                <i className="fa-solid fa-star text-[10px] text-amber-500" aria-hidden="true" />
                <span>{proposal.place.ratingAvg.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context Swap Target */}
      {proposal.destinationId && targetStopName && (
        <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-1.5 flex items-center gap-1.5 border border-slate-200/70">
          <i className="fa-solid fa-right-left text-[10px] text-[#0194F3] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {t('planner.proposals.replacesStopLabel')}{' '}
            <strong className="text-[#10243A]">{targetStopName}</strong>
          </span>
        </div>
      )}

      {/* Proposer + Editorial Note */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Avatar className="size-5 border border-slate-200 shrink-0">
            <AvatarImage src={proposal.proposer.avatarUrl || undefined} alt={proposal.proposer.fullName} />
            <AvatarFallback className="text-[9px] font-bold bg-[#10243A] text-white">
              {proposal.proposer.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            {t('planner.proposals.proposedBy')}{' '}
            <strong className="text-[#10243A]">{proposal.proposer.fullName}</strong>
          </span>
        </div>

        {proposal.notes && (
          <p className="text-xs text-slate-700 leading-relaxed pl-3 border-l-2 border-[#0194F3]/40">
            {proposal.notes}
          </p>
        )}
      </div>

      {/* Consensus / Vote Summary */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-slate-700 tabular-nums">
            <i className="fa-solid fa-thumbs-up text-[#0194F3] mr-1.5" aria-hidden="true" />
            {t('planner.proposals.votesSummary', {
              votes: proposal.voteCount,
              total: denominator,
            })}
          </span>

          {proposal.voters.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {proposal.voters.slice(0, 5).map((v) => (
                <Avatar
                  key={v.userId}
                  title={v.fullName}
                  className="size-5 border border-white ring-1 ring-slate-200"
                >
                  <AvatarImage src={v.avatarUrl || undefined} alt={v.fullName} />
                  <AvatarFallback className="text-[8px] font-bold bg-[#F0F7FF] text-[#0194F3]">
                    {v.fullName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {proposal.voters.length > 5 && (
                <span className="size-5 rounded-full bg-slate-100 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center tabular-nums">
                  +{proposal.voters.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0194F3] transition-all duration-300"
            style={{ width: `${voteRatioPct}%` }}
          />
        </div>
      </div>

      {/* Actions Row */}
      {isPending && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onToggleVote(proposal.id)}
              aria-pressed={proposal.hasVoted}
              className={`h-8 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                proposal.hasVoted
                  ? 'bg-[#F0F7FF] text-[#0194F3] border-[#0194F3]/40'
                  : 'bg-white hover:bg-[#F0F7FF] text-slate-700 hover:text-[#0194F3] border-slate-200'
              }`}
            >
              <i
                className={`${proposal.hasVoted ? 'fa-solid' : 'fa-regular'} fa-thumbs-up text-xs`}
                aria-hidden="true"
              />
              <span>
                {proposal.hasVoted ? t('planner.proposals.voted') : t('planner.proposals.vote')}
              </span>
            </button>

            {isProposer && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onWithdraw(proposal.id)}
                className="h-8 px-2.5 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
              >
                {isWithdrawing ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />
                ) : (
                  <i className="fa-regular fa-trash-can text-[11px]" aria-hidden="true" />
                )}
                <span>{t('planner.proposals.withdraw')}</span>
              </button>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onResolve(proposal.id, 'REJECT')}
                className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('planner.proposals.reject')}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onResolve(proposal.id, 'APPROVE')}
                className="h-8 px-3.5 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isResolving ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                ) : (
                  <i className="fa-solid fa-check text-xs" aria-hidden="true" />
                )}
                <span>{t('planner.proposals.approveToItinerary')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
