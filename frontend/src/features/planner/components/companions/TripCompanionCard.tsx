'use client';

import React, { useState } from 'react';
import { Users, Plus, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data, isLoading } = useTripCompanions(itineraryId, isMemberOrOwner);

  // If user is a public guest / stranger, don't show companion management
  if (!isMemberOrOwner) return null;

  const members = data?.members || [];
  const previewMembers = members.slice(0, TRIP_COMPANIONS_CONFIG.MAX_AVATAR_PREVIEWS);
  const remainingCount = members.length - previewMembers.length;

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h3 className="text-sm font-bold font-heading text-foreground">
              Bạn đồng hành ({members.length})
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Quản lý
          </button>
        </div>

        {/* Avatar Stack & Dashed Plus */}
        <div className="flex items-center gap-2 pt-1">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="size-10 rounded-full bg-muted animate-pulse" />
              <div className="size-10 rounded-full bg-muted animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center -space-x-2.5 overflow-hidden py-1">
              {previewMembers.map((member) => (
                <div
                  key={member.userId}
                  title={`${member.fullName} (${
                    member.role === 'OWNER'
                      ? 'Chủ chuyến đi'
                      : member.role === 'EDITOR'
                        ? 'Chỉnh sửa'
                        : 'Chỉ xem'
                  })`}
                  className="relative group transition-transform hover:scale-105 hover:z-10"
                >
                  <Avatar className="size-10 border-2 border-card shadow-xs ring-1 ring-border/40 shrink-0">
                    <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName} />
                    <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                      {member.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.role === 'OWNER' && (
                    <div className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Crown className="size-2.5" />
                    </div>
                  )}
                </div>
              ))}

              {remainingCount > 0 && (
                <div
                  onClick={() => setIsPanelOpen(true)}
                  className="size-10 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground shadow-xs cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  +{remainingCount}
                </div>
              )}

              {canManageMembers && (
                <button
                  type="button"
                  onClick={() => setIsInviteDialogOpen(true)}
                  title="Mời bạn đồng hành"
                  aria-label="Mời bạn đồng hành"
                  className="size-10 rounded-full border-2 border-dashed border-border hover:border-primary hover:text-primary text-muted-foreground flex items-center justify-center transition-colors cursor-pointer ml-3 shrink-0"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {canManageMembers
            ? 'Mời bạn bè cùng lên kế hoạch và chỉnh sửa lịch trình chuyến đi.'
            : 'Đang cùng lên kế hoạch cho chuyến đi du lịch này.'}
        </p>

        {/* Action Button */}
        {canManageMembers ? (
          <Button
            type="button"
            onClick={() => setIsInviteDialogOpen(true)}
            className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span>Mời bạn cùng đi</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPanelOpen(true)}
            className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <Users className="size-4 text-primary" />
            <span>Xem bạn đồng hành</span>
          </Button>
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
