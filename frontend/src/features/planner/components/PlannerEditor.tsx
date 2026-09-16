"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePlannerQuery,
  useUpdatePlannerMutation,
  useCreatePlannerInvitationMutation,
  useUpdateMockInvitationStatusMutation,
} from "../hooks/use-planner";
import { usePlannerDraftStore } from "../stores/planner-draft-store";
import { TripDetailsEditor } from "./TripDetailsEditor";
import { BudgetSummary } from "./BudgetSummary";
import { ItineraryEditor } from "./ItineraryEditor";
import { CompanionPanel } from "./CompanionPanel";
import { InviteCompanionDialog } from "./InviteCompanionDialog";
import { normalizePlanner } from "../model/planner-draft";
import { InviteCandidate } from "@/types/planner";

interface PlannerEditorProps {
  plannerId: string;
  childrenItinerary?: React.ReactNode;
  childrenCompanions?: React.ReactNode;
}

export function PlannerEditor({
  plannerId,
  childrenItinerary,
  childrenCompanions,
}: PlannerEditorProps) {
  const router = useRouter();
  const { data: serverPlanner, isLoading, isError, refetch } = usePlannerQuery(plannerId);
  const updateMutation = useUpdatePlannerMutation();
  const createInviteMutation = useCreatePlannerInvitationMutation();
  const updateMockStatusMutation = useUpdateMockInvitationStatusMutation();

  const { draft, isDirty, load, patch, replace, markSaved } = usePlannerDraftStore();
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (serverPlanner && (!draft || draft.id !== plannerId)) {
      load(serverPlanner);
    }
  }, [serverPlanner, plannerId, draft, load]);

  if (isLoading) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <LoadingState message="Đang tải thông tin chuyến đi..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-4">
          <div className="flex justify-center text-destructive">
            <AlertCircle className="size-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Lỗi khi tải lịch trình</h2>
          <p className="text-sm text-muted-foreground">
            Không thể tải dữ liệu lịch trình. Vui lòng kiểm tra lại kết nối.
          </p>
          <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  if (!serverPlanner && !draft) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <EmptyState
          title="Không tìm thấy lịch trình"
          description="Lịch trình bạn đang tìm kiếm không tồn tại hoặc đã bị xóa."
          actionLabel="Về danh sách lịch trình"
          onAction={() => router.push("/planner")}
        />
      </div>
    );
  }

  const currentPlanner = draft || serverPlanner!;

  const handleSave = async () => {
    if (!draft) return;
    try {
      const normalized = normalizePlanner(draft);
      const saved = await updateMutation.mutateAsync({
        id: plannerId,
        input: normalized,
      });
      markSaved(saved);
      toast.success("Lưu chuyến đi thành công!");
      return saved;
    } catch {
      toast.error("Lưu thất bại, vui lòng thử lại!");
    }
  };

  const handlePreviewClick = () => {
    if (!isDirty) {
      router.push(`/planner/${plannerId}`);
    } else {
      setShowUnsavedPrompt(true);
    }
  };

  const handleDiscardAndPreview = () => {
    if (serverPlanner) {
      load(serverPlanner);
    }
    setShowUnsavedPrompt(false);
    router.push(`/planner/${plannerId}`);
  };

  const handleSaveAndPreview = async () => {
    const saved = await handleSave();
    if (saved) {
      setShowUnsavedPrompt(false);
      router.push(`/planner/${plannerId}`);
    }
  };

  const handleSendInvite = async (
    candidate: InviteCandidate,
    permission: "viewer" | "editor"
  ) => {
    try {
      const inv = await createInviteMutation.mutateAsync({
        plannerId,
        input: { userId: candidate.id, permission },
      });
      patch({
        invitations: [...(currentPlanner.invitations || []), inv],
      });
      toast.success("Đã gửi lời mời thành công!");
    } catch {
      toast.error("Gửi lời mời thất bại, vui lòng thử lại!");
    }
  };

  const handleUpdateCompanionStatus = async (
    invitationId: string,
    status: "accepted" | "declined"
  ) => {
    try {
      const updated = await updateMockStatusMutation.mutateAsync({
        plannerId,
        invitationId,
        status,
      });
      replace(updated);
      toast.success(
        status === "accepted" ? "Đã chấp nhận lời mời!" : "Đã từ chối lời mời!"
      );
    } catch {
      toast.error("Thao tác thất bại, vui lòng thử lại!");
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-24">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/planner"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại</span>
          </Link>

          <span className="text-muted-foreground">•</span>

          {/* Status badge */}
          {updateMutation.isPending ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Clock className="size-3.5 animate-spin text-primary" />
              <span>Đang lưu...</span>
            </span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Chưa lưu thay đổi</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              <span>Đã lưu</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewClick}
            className="h-10 rounded-xl gap-1.5 text-xs font-bold"
          >
            <Eye className="size-3.5" />
            <span>Xem trước</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || updateMutation.isPending}
            className="h-10 rounded-xl gap-1.5 text-xs font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          >
            <Save className="size-3.5" />
            <span>{updateMutation.isPending ? "Đang lưu..." : "Lưu chuyến đi"}</span>
          </Button>
        </div>
      </div>

      {/* Editor Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Trip details and Itinerary */}
        <div className="lg:col-span-8 space-y-8">
          <TripDetailsEditor planner={currentPlanner} onPatch={patch} />
          {childrenItinerary || (
            <ItineraryEditor
              planner={currentPlanner}
              onUpdateDraft={replace}
            />
          )}
        </div>

        {/* Right Column: Sticky Budget and Companions */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          <BudgetSummary planner={currentPlanner} />
          {childrenCompanions || (
            <CompanionPanel
              planner={currentPlanner}
              onOpenInvite={() => setInviteDialogOpen(true)}
              onUpdateStatus={handleUpdateCompanionStatus}
            />
          )}
        </div>
      </div>

      {/* Unsaved Prompt Dialog */}
      <Dialog open={showUnsavedPrompt} onOpenChange={setShowUnsavedPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bạn có thay đổi chưa lưu</DialogTitle>
            <DialogDescription>
              Bạn có các chỉnh sửa chưa được lưu lại. Bạn muốn lưu hay bỏ thay đổi trước khi xem trước?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUnsavedPrompt(false)}
              className="w-full sm:w-auto text-xs"
            >
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDiscardAndPreview}
              className="w-full sm:w-auto text-xs"
            >
              Bỏ thay đổi
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndPreview}
              className="w-full sm:w-auto text-xs font-bold bg-primary text-primary-foreground"
            >
              Lưu rồi xem trước
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Companion Dialog */}
      <InviteCompanionDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        planner={currentPlanner}
        onInvite={handleSendInvite}
      />
    </div>
  );
}
