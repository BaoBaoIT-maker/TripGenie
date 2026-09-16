"use client";

import { Users, UserPlus, Shield, Eye, Check, X } from "lucide-react";
import { Planner, PlannerMemberRole } from "@/types/planner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CompanionPanelProps {
  planner: Planner;
  onOpenInvite: () => void;
  onUpdateStatus: (invitationId: string, status: "accepted" | "declined") => void;
}

function getRoleLabel(role: PlannerMemberRole): string {
  switch (role) {
    case "owner":
      return "Chủ chuyến đi";
    case "editor":
      return "Người chỉnh sửa";
    case "viewer":
      return "Người xem";
    default:
      return role;
  }
}

export function CompanionPanel({
  planner,
  onOpenInvite,
  onUpdateStatus,
}: CompanionPanelProps) {
  const members = planner.members || [];
  const invitations = (planner.invitations || []).filter((i) => i.status === "pending");

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Bạn đồng hành</h3>
            <p className="text-[11px] text-muted-foreground">
              {members.length} thành viên tham gia
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={onOpenInvite}
          className="h-8 rounded-xl gap-1 text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <UserPlus className="size-3.5" />
          <span>Mời bạn cùng đi</span>
        </Button>
      </div>

      {/* Member list */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Thành viên ({members.length})
        </h4>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="size-8">
                  {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                  <AvatarFallback className="text-[11px] font-bold">
                    {member.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {member.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>
              </div>

              <span className="shrink-0 flex items-center gap-1 rounded-lg bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border/80">
                {member.role === "owner" ? (
                  <Shield className="size-2.5 text-amber-500" />
                ) : member.role === "editor" ? (
                  <Shield className="size-2.5 text-primary" />
                ) : (
                  <Eye className="size-2.5 text-muted-foreground" />
                )}
                <span>{getRoleLabel(member.role)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/70">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Lời mời đang chờ ({invitations.length})
          </h4>

          <div className="space-y-2.5">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {inv.invitee.displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {inv.invitee.email} • {getRoleLabel(inv.permission)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Đang chờ phản hồi
                  </span>
                </div>

                {/* Mock testing buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] font-medium text-muted-foreground">Giả lập:</span>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(inv.id, "accepted")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    <Check className="size-2.5" />
                    <span>Chấp nhận giả lập</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus(inv.id, "declined")}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    <X className="size-2.5" />
                    <span>Từ chối giả lập</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
