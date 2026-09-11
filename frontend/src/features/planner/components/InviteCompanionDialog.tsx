"use client";

import { useState, useEffect } from "react";
import { Search, ShieldAlert, Check } from "lucide-react";
import { Planner, InviteCandidate } from "@/types/planner";
import { plannerService } from "@/services/planner.service";
import { getInviteConflict } from "../model/planner-draft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InviteCompanionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planner: Planner;
  onInvite: (candidate: InviteCandidate, permission: "viewer" | "editor") => Promise<void>;
}

export function InviteCompanionDialog({
  open,
  onOpenChange,
  planner,
  onInvite,
}: InviteCompanionDialogProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<InviteCandidate | null>(null);
  const [permission, setPermission] = useState<"viewer" | "editor">("editor");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setCandidates([]);
      setSelectedCandidate(null);
      setPermission("editor");
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setCandidates([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await plannerService.searchInviteCandidates(query);
        setCandidates(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const selectedConflict = selectedCandidate
    ? getInviteConflict(planner, "user-current", selectedCandidate.id)
    : null;

  const getConflictMessage = (conflict: "self" | "member" | "pending" | null) => {
    switch (conflict) {
      case "self":
        return "Bạn không thể tự mời chính mình";
      case "member":
        return "Người này đã tham gia chuyến đi";
      case "pending":
        return "Đã gửi lời mời đến người này rồi";
      default:
        return null;
    }
  };

  const handleSend = async () => {
    if (!selectedCandidate || selectedConflict) return;
    setIsSubmitting(true);
    try {
      await onInvite(selectedCandidate, permission);
      handleOpenChangeInternal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mời bạn đồng hành</DialogTitle>
          <DialogDescription>
            Tìm kiếm người dùng trong hệ thống để mời cùng lên kế hoạch hoặc xem lịch trình.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search box */}
          <div className="space-y-1">
            <label
              htmlFor="invite-search-input"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Tìm người dùng
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="invite-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="pl-9 h-10 text-xs rounded-xl"
                autoFocus
              />
            </div>
            {query.trim().length > 0 && query.trim().length < 2 && (
              <p className="text-[11px] text-muted-foreground">
                Nhập ít nhất 2 ký tự để tìm kiếm...
              </p>
            )}
          </div>

          {/* Search results */}
          {candidates.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-muted-foreground">
                Kết quả tìm kiếm:
              </span>
              <div className="space-y-1.5 pt-1">
                {candidates.map((cand) => {
                  const conflict = getInviteConflict(planner, "user-current", cand.id);
                  const isSelected = selectedCandidate?.id === cand.id;

                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setSelectedCandidate(cand)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-7">
                          {cand.avatarUrl && <AvatarImage src={cand.avatarUrl} />}
                          <AvatarFallback className="text-[10px] font-bold">
                            {cand.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {cand.displayName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {cand.email}
                          </p>
                        </div>
                      </div>

                      {conflict ? (
                        <span className="text-[10px] font-medium text-destructive">
                          {getConflictMessage(conflict)}
                        </span>
                      ) : isSelected ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isSearching && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Đang tìm kiếm...
            </p>
          )}

          {/* Selected Candidate Conflict warning */}
          {selectedCandidate && selectedConflict && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{getConflictMessage(selectedConflict)}</span>
            </div>
          )}

          {/* Permission selection */}
          <div className="space-y-1 pt-1">
            <label
              htmlFor="invite-permission-select"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Quyền hạn
            </label>
            <select
              id="invite-permission-select"
              value={permission}
              onChange={(e) => setPermission(e.target.value as "viewer" | "editor")}
              className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-medium outline-none focus:border-primary"
            >
              <option value="editor">Có thể chỉnh sửa (Editor)</option>
              <option value="viewer">Có thể xem (Viewer)</option>
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChangeInternal(false)}
            className="text-xs rounded-xl"
          >
            Hủy
          </Button>

          <Button
            type="button"
            onClick={handleSend}
            disabled={!selectedCandidate || selectedConflict !== null || isSubmitting}
            className="text-xs rounded-xl font-bold bg-primary text-primary-foreground"
          >
            {isSubmitting ? "Đang gửi..." : "Gửi lời mời"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
