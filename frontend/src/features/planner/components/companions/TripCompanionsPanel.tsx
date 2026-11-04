'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  Users,
  X,
  Crown,
  Edit3,
  Eye,
  Trash2,
  LogOut,
  Clock,
  RotateCcw,
  UserPlus,
  ChevronDown,
  Check,
} from 'lucide-react';
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
          "h-8 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs select-none",
          isEditor
            ? "border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100/80 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            : "border-border/90 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Thay đổi vai trò thành viên"
        title="Nhấn để đổi vai trò thành viên"
      >
        {isEditor ? (
          <>
            <Edit3 className="size-3 text-blue-600 dark:text-blue-400" />
            <span>Chỉnh sửa</span>
          </>
        ) : (
          <>
            <Eye className="size-3 text-muted-foreground" />
            <span>Chỉ xem</span>
          </>
        )}
        <ChevronDown className="size-3 text-muted-foreground/80" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => {
            if (value !== 'VIEWER') onChange('VIEWER');
          }}
          className={cn(
            "flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold",
            !isEditor && "bg-muted text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Eye className="size-3.5 text-muted-foreground" />
            <span>Chỉ xem</span>
          </div>
          {!isEditor && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            if (value !== 'EDITOR') onChange('EDITOR');
          }}
          className={cn(
            "flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold",
            isEditor && "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
          )}
        >
          <div className="flex items-center gap-2">
            <Edit3 className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span>Chỉnh sửa</span>
          </div>
          {isEditor && <Check className="size-3.5 text-blue-600 dark:text-blue-400" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const noopSubscribe = () => () => {};

export function TripCompanionsPanel({
  open,
  onClose,
  itineraryId,
  canManageMembers,
  currentUserId,
}: TripCompanionsPanelProps) {
  const router = useRouter();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  const { data, isLoading } = useTripCompanions(itineraryId, open);

  const updateRoleMutation = useUpdateMemberRole(itineraryId);
  const removeMemberMutation = useRemoveMember(itineraryId);
  const leaveTripMutation = useLeaveTrip(itineraryId);
  const revokeInvitationMutation = useRevokeInvitation(itineraryId);

  if (!open || !isClient) return null;

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
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="companions-panel-title"
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h2 id="companions-panel-title" className="text-base font-bold font-heading text-foreground">
                Bạn đồng hành ({members.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng bạn đồng hành"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Active Members Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Thành viên tham gia
                </span>
                {canManageMembers && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(true)}
                    className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 text-primary cursor-pointer"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Mời thêm</span>
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                  <div className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                </div>
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border bg-background">
                  {members.map((member) => {
                    const isSelf = currentUserId === member.userId;
                    const isOwnerRole = member.role === 'OWNER';

                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3.5 gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="size-9 border border-border shrink-0">
                            <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName} />
                            <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                              {member.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {member.fullName}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {isOwnerRole ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-[11px]">
                                  <Crown className="size-3" />
                                  <span>{TRIP_COMPANIONS_CONFIG.ROLES.OWNER}</span>
                                </span>
                              ) : member.role === 'EDITOR' ? (
                                <span className="inline-flex items-center gap-1 text-primary font-medium text-[11px]">
                                  <Edit3 className="size-3" />
                                  <span>{TRIP_COMPANIONS_CONFIG.ROLES.EDITOR}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground font-medium text-[11px]">
                                  <Eye className="size-3" />
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
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </>
                          ) : isSelf && !isOwnerRole ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleLeaveTrip}
                              disabled={leaveTripMutation.isPending}
                              className="h-8 px-2.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
                            >
                              <LogOut className="size-3.5" />
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
              <div className="space-y-3 pt-2 border-t border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Lời mời đang chờ ({pendingInvitations.length})
                </span>

                {pendingInvitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Không có lời mời nào đang chờ phản hồi.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border bg-background overflow-hidden">
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {inv.inviteeName || inv.inviteeEmail}
                          </div>
                          {inv.inviteeEmail && inv.inviteeName && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {inv.inviteeEmail}
                            </div>
                          )}
                          <div className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                            <Clock className="size-3" />
                            <span>Đang chờ phản hồi</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          disabled={revokeInvitationMutation.isPending}
                          className="h-7 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
                        >
                          <RotateCcw className="size-3" />
                          <span>Thu hồi</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

      <InviteTripCompanionDialog
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        itineraryId={itineraryId}
      />
    </>
  );
}
