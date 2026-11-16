'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  useTripCompanions,
  useUpdateMemberRole,
  useRemoveMember,
  useLeaveTrip,
  useRevokeInvitation,
} from '../../hooks/use-trip-companions';
import { TRIP_COMPANIONS_CONFIG } from '../../config/trip-companions.config';
import { InviteTripCompanionDialog } from './InviteTripCompanionDialog';

interface TripCompanionsPanelProps {
  open: boolean;
  onClose: () => void;
  itineraryId: string;
  canManageMembers: boolean;
  currentUserId?: string;
}

interface CompanionRoleSelectProps {
  value: 'VIEWER' | 'EDITOR';
  onChange: (newRole: 'VIEWER' | 'EDITOR') => void;
  disabled?: boolean;
}

function CompanionRoleSelect({ value, onChange, disabled }: CompanionRoleSelectProps) {
  const isEditor = value === 'EDITOR';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'h-8 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none',
          isEditor
            ? 'border-[#D0E7FF] bg-[#F0F7FF] text-[#0194F3]'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        aria-label="Thay đổi vai trò thành viên"
        title="Nhấn để đổi vai trò thành viên"
      >
        {isEditor ? (
          <>
            <i className="fa-solid fa-pen text-[10px]" aria-hidden="true" />
            <span>Chỉnh sửa</span>
          </>
        ) : (
          <>
            <i className="fa-regular fa-eye text-[10px]" aria-hidden="true" />
            <span>Chỉ xem</span>
          </>
        )}
        <i className="fa-solid fa-chevron-down text-[9px] opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => {
            if (value !== 'VIEWER') onChange('VIEWER');
          }}
          className={cn(
            'flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold',
            !isEditor && 'bg-slate-100 text-slate-900',
          )}
        >
          <div className="flex items-center gap-2">
            <i className="fa-regular fa-eye text-xs text-slate-500" aria-hidden="true" />
            <span>Chỉ xem</span>
          </div>
          {!isEditor && <i className="fa-solid fa-check text-xs text-[#0194F3]" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            if (value !== 'EDITOR') onChange('EDITOR');
          }}
          className={cn(
            'flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold',
            isEditor && 'bg-[#F0F7FF] text-[#0194F3]',
          )}
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-pen text-xs text-[#0194F3]" aria-hidden="true" />
            <span>Chỉnh sửa</span>
          </div>
          {isEditor && <i className="fa-solid fa-check text-xs text-[#0194F3]" aria-hidden="true" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TripCompanionsPanel({
  open,
  onClose,
  itineraryId,
  canManageMembers,
  currentUserId,
}: TripCompanionsPanelProps) {
  const router = useRouter();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data, isLoading } = useTripCompanions(itineraryId, open);

  const updateRoleMutation = useUpdateMemberRole(itineraryId);
  const removeMemberMutation = useRemoveMember(itineraryId);
  const leaveTripMutation = useLeaveTrip(itineraryId);
  const revokeInvitationMutation = useRevokeInvitation(itineraryId);

  const members = data?.members || [];
  const pendingInvitations = data?.pendingInvitations || [];

  const handleRoleChange = (userId: string, newRole: 'VIEWER' | 'EDITOR') => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (window.confirm(TRIP_COMPANIONS_CONFIG.CONFIRMATIONS.REMOVE_MEMBER(name))) {
      removeMemberMutation.mutate(userId);
    }
  };

  const handleLeaveTrip = () => {
    if (window.confirm(TRIP_COMPANIONS_CONFIG.CONFIRMATIONS.LEAVE_TRIP)) {
      leaveTripMutation.mutate(undefined, {
        onSuccess: () => {
          onClose();
          router.push('/planner');
        },
      });
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    revokeInvitationMutation.mutate(invitationId);
  };

  return (
    <>
      <AppModalPortal
        open={open}
        onClose={onClose}
        ariaLabelledBy="companions-panel-title"
        maxWidthClass="max-w-lg"
        dialogClassName="flex flex-col max-h-[85vh]"
        mobileBottomSheet
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center">
              <i className="fa-solid fa-users text-xs" aria-hidden="true" />
            </div>
            <h2 id="companions-panel-title" className="text-sm font-bold text-slate-900 tabular-nums">
              Bạn đồng hành ({members.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng bạn đồng hành"
            className="size-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {/* Active Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Thành viên tham gia
              </span>
              {canManageMembers && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(true)}
                  className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 text-[#0194F3] border-[#D0E7FF] hover:bg-[#F0F7FF] cursor-pointer"
                >
                  <i className="fa-solid fa-user-plus text-xs" aria-hidden="true" />
                  <span>Mời thêm</span>
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {members.map((member) => {
                  const isSelf = currentUserId === member.userId;
                  const isOwnerRole = member.role === 'OWNER';

                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-3.5 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-9 border border-slate-200 shrink-0">
                          <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName} />
                          <AvatarFallback className="text-xs font-bold bg-[#10243A] text-white">
                            {member.fullName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#10243A] truncate">
                              {member.fullName}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex items-center gap-1 mt-0.5">
                            {isOwnerRole ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                                <i className="fa-solid fa-crown text-[10px]" aria-hidden="true" />
                                <span>{TRIP_COMPANIONS_CONFIG.ROLES.OWNER}</span>
                              </span>
                            ) : member.role === 'EDITOR' ? (
                              <span className="inline-flex items-center gap-1 text-[#0194F3] font-semibold text-[11px]">
                                <i className="fa-solid fa-pen text-[10px]" aria-hidden="true" />
                                <span>{TRIP_COMPANIONS_CONFIG.ROLES.EDITOR}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                                <i className="fa-regular fa-eye text-[10px]" aria-hidden="true" />
                                <span>{TRIP_COMPANIONS_CONFIG.ROLES.VIEWER}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {canManageMembers && !isOwnerRole ? (
                          <>
                            <CompanionRoleSelect
                              value={member.role as 'VIEWER' | 'EDITOR'}
                              onChange={(newRole) => handleRoleChange(member.userId, newRole)}
                              disabled={updateRoleMutation.isPending}
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.userId, member.fullName)}
                              disabled={removeMemberMutation.isPending}
                              title="Xóa thành viên"
                              aria-label={`Xóa thành viên ${member.fullName}`}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <i className="fa-regular fa-trash-can text-xs" aria-hidden="true" />
                            </button>
                          </>
                        ) : isSelf && !isOwnerRole ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleLeaveTrip}
                            disabled={leaveTripMutation.isPending}
                            className="h-8 px-2.5 rounded-lg text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer gap-1"
                          >
                            <i className="fa-solid fa-right-from-bracket text-xs" aria-hidden="true" />
                            <span>Rời chuyến</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations Section (Owner Only) */}
          {canManageMembers && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider tabular-nums">
                Lời mời đang chờ ({pendingInvitations.length})
              </span>

              {pendingInvitations.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Không có lời mời nào đang chờ phản hồi.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#10243A] truncate">
                          {inv.inviteeName || inv.inviteeEmail}
                        </div>
                        {inv.inviteeEmail && inv.inviteeName && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {inv.inviteeEmail}
                          </div>
                        )}
                        <div className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-0.5 font-medium">
                          <i className="fa-regular fa-clock" aria-hidden="true" />
                          <span>Đang chờ phản hồi</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        disabled={revokeInvitationMutation.isPending}
                        className="h-7 px-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer gap-1"
                      >
                        <i className="fa-solid fa-rotate-left text-[11px]" aria-hidden="true" />
                        <span>Thu hồi</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </AppModalPortal>

      <InviteTripCompanionDialog
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        itineraryId={itineraryId}
      />
    </>
  );
}
