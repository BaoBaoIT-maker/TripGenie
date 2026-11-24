'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useI18n, type MessageKey } from '@/i18n';
import { useTripCompanions } from '../../hooks/use-trip-companions';
import { TRIP_COMPANIONS_CONFIG } from '../../config/trip-companions.config';
import { InviteTripCompanionDialog } from './InviteTripCompanionDialog';
import { TripCompanionsPanel } from './TripCompanionsPanel';

interface TripCompanionCardProps {
  itineraryId: string;
  canManageMembers: boolean;
  currentUserId?: string;
  isMemberOrOwner: boolean;
}

export function TripCompanionCard({
  itineraryId,
  canManageMembers,
  currentUserId,
  isMemberOrOwner,
}: TripCompanionCardProps) {
  const { t } = useI18n();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data, isLoading } = useTripCompanions(itineraryId, isMemberOrOwner);

  if (!isMemberOrOwner) return null;

  const members = data?.members || [];
  const previewMembers = members.slice(0, TRIP_COMPANIONS_CONFIG.MAX_AVATAR_PREVIEWS);
  const remainingCount = members.length - previewMembers.length;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
              <i className="fa-solid fa-users text-xs" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 tabular-nums">
              {t('planner.companions.cardTitle', { count: members.length })}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
          >
            {t('planner.common.manage')}
          </button>
        </div>

        {/* Avatar Stack & Dashed Plus */}
        <div className="flex items-center gap-2 pt-1">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="size-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="size-10 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center -space-x-2.5 py-1">
              {previewMembers.map((member) => (
                <div
                  key={member.userId}
                  title={`${member.fullName} (${t(`planner.roles.${member.role}` as MessageKey)})`}
                  className="relative"
                >
                  <Avatar className="size-10 border-2 border-white ring-1 ring-slate-200 shrink-0">
                    <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName} />
                    <AvatarFallback className="text-xs font-bold bg-[#10243A] text-white">
                      {member.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.role === 'OWNER' && (
                    <div
                      title={t('planner.roles.OWNER')}
                      className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs"
                    >
                      <i className="fa-solid fa-crown text-[8px]" aria-hidden="true" />
                    </div>
                  )}
                </div>
              ))}

              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(true)}
                  className="size-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors tabular-nums"
                >
                  +{remainingCount}
                </button>
              )}

              {canManageMembers && (
                <button
                  type="button"
                  onClick={() => setIsInviteDialogOpen(true)}
                  title={t('planner.companions.inviteTooltip')}
                  aria-label={t('planner.companions.inviteTooltip')}
                  className="size-10 rounded-full border-2 border-dashed border-slate-300 hover:border-[#0194F3] hover:text-[#0194F3] text-slate-400 flex items-center justify-center transition-colors cursor-pointer ml-4 shrink-0"
                >
                  <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 leading-relaxed">
          {canManageMembers
            ? t('planner.companions.descCanManage')
            : t('planner.companions.descMember')}
        </p>

        {/* Action Button */}
        {canManageMembers ? (
          <button
            type="button"
            onClick={() => setIsInviteDialogOpen(true)}
            className="w-full h-10 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-xs" aria-hidden="true" />
            <span>{t('planner.companions.inviteButton')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-users text-xs text-[#0194F3]" aria-hidden="true" />
            <span>{t('planner.companions.viewMembersButton')}</span>
          </button>
        )}
      </div>

      <TripCompanionsPanel
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        itineraryId={itineraryId}
        canManageMembers={canManageMembers}
        currentUserId={currentUserId}
      />

      <InviteTripCompanionDialog
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        itineraryId={itineraryId}
      />
    </>
  );
}
