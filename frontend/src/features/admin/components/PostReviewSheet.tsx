"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import { DEFAULT_AVATAR } from "@/config/avatars";
import type {
  AdminContentReportItem,
  AdminModerationPostItem,
} from "@/types/admin";
import {
  useApproveAdminPost,
  useRejectAdminPost,
  useResolveAdminReport,
} from "../hooks/use-admin";

export type ModerationReviewTarget =
  | { kind: "POST"; post: AdminModerationPostItem }
  | { kind: "REPORT"; report: AdminContentReportItem };

interface PostReviewSheetProps {
  target: ModerationReviewTarget | null;
  onClose: () => void;
}

export function PostReviewSheet({ target, onClose }: PostReviewSheetProps) {
  const [note, setNote] = useState("");

  const approvePostMutation = useApproveAdminPost();
  const rejectPostMutation = useRejectAdminPost();
  const resolveReportMutation = useResolveAdminReport();

  const isSubmitting =
    approvePostMutation.isPending ||
    rejectPostMutation.isPending ||
    resolveReportMutation.isPending;

  useEffect(() => {
    setNote("");
  }, [target]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setNote("");
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!target) return null;

  const isReport = target.kind === "REPORT";
  const isRejectedPost = !isReport && target.post.moderationStatus === "REJECTED";
  const postData = isReport ? target.report.targetPost : target.post;
  const reportCount = isReport ? target.report.targetReportCount : 0;
  const isHighPriority = isReport && target.report.isHighPriorityAlert;

  const coverUrl = postData?.mediaUrls?.[0] || null;
  const authorName =
    postData?.user?.fullName ||
    (isReport ? target.report.reporter?.fullName : null) ||
    "Thành viên TripGenie";
  const authorEmail =
    postData?.user?.email ||
    (isReport ? target.report.reporter?.email : null) ||
    "";
  const authorAvatar = postData?.user?.avatarUrl || DEFAULT_AVATAR;
  const groupName = postData?.group?.name || "Cộng đồng chung";
  const title =
    postData?.title ||
    (isReport
      ? `Báo cáo nội dung (${target.report.reportType})`
      : "Bài viết cộng đồng");
  const caption =
    postData?.caption ||
    (isReport ? target.report.description : null) ||
    "Không có mô tả chi tiết.";
  const diagnosisText = isReport
    ? `Nhận ${reportCount} lượt báo cáo (${target.report.reportType}). ${
        target.report.description ||
        "Hệ thống giữ nguyên hiển thị bài đã duyệt để chống công kích hội đồng."
      }`
    : target.post.moderationNote ||
      (target.post.moderationStatus === "REJECTED"
        ? "Bài viết này đã bị từ chối hoặc gỡ bỏ khỏi cộng đồng."
        : target.post.moderationStatus === "FLAGGED"
          ? "AI phát hiện nội dung cần kiểm tra ngữ cảnh trước khi hiển thị."
          : "Bài viết mới ở trạng thái chờ duyệt thủ công.");

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    const trimmedNote = note.trim() || undefined;
    if (isReport) {
      await resolveReportMutation.mutateAsync({
        reportId: target.report.id,
        action: decision === "APPROVE" ? "DISMISS" : "RESOLVE",
        resolutionNote: trimmedNote,
        rejectTargetPost: decision === "REJECT",
      });
    } else {
      if (decision === "APPROVE") {
        await approvePostMutation.mutateAsync({
          postId: target.post.id,
          reason: trimmedNote,
        });
      } else {
        await rejectPostMutation.mutateAsync({
          postId: target.post.id,
          reason: trimmedNote,
        });
      }
    }
    handleClose();
  };

  return (
    <AppModalPortal
      open={Boolean(target)}
      onClose={handleClose}
      ariaLabelledBy="post-review-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Community-style Popup Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className={`size-9 rounded-[10px] text-white flex items-center justify-center text-sm ${
              isHighPriority
                ? "bg-rose-500"
                : "bg-[#0194F3] shadow-[0_2px_6px_rgba(1,148,243,0.25)]"
            }`}
          >
            <i
              className={
                isHighPriority
                  ? "fa-solid fa-fire"
                  : "fa-solid fa-shield-halved"
              }
              aria-hidden="true"
            />
          </div>
          <div>
            <h3
              id="post-review-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              Chi tiết Bài viết & Phân xử
            </h3>
            <p className="text-[11px] text-[#64748B]">{groupName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-y-auto text-xs">
        {coverUrl && (
          <div className="rounded-[14px] overflow-hidden border border-[#E2E8F0] h-48 bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-3 pb-3 border-b border-[#F1F5F9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={authorAvatar}
            alt={authorName}
            className="size-10 rounded-full object-cover border border-[#E2E8F0]"
          />
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#0F172A] truncate">
              {authorName}
            </div>
            <div className="text-[11px] text-[#64748B] truncate">
              {authorEmail}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-extrabold text-[#0F172A]">{title}</h4>
          <p className="text-xs text-slate-700 leading-relaxed p-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] whitespace-pre-wrap">
            {caption}
          </p>
        </div>

        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1 ${
            isHighPriority || isRejectedPost
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-amber-50 border-amber-200 text-amber-950"
          }`}
        >
          <div className="font-extrabold">
            {isRejectedPost ? "Lý do từ chối / gỡ bài" : "Chẩn đoán hệ thống"}
          </div>
          <p>{diagnosisText}</p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="moderation-decision-note"
            className="block text-xs font-extrabold text-[#10243A]"
          >
            Ghi chú quyết định (Lưu vào Nhật ký kiểm toán)
          </label>
          <textarea
            id="moderation-decision-note"
            rows={2}
            value={note}
            spellCheck={false}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isRejectedPost
                ? "Nhập lý do khôi phục bài viết..."
                : "Nhập lý do phê duyệt hoặc từ chối..."
            }
            className="w-full p-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#10243A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isRejectedPost && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDecision("REJECT")}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <i className="fa-solid fa-ban" aria-hidden="true" />
              )}
              <span>Từ chối / Gỡ bài</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleDecision("APPROVE")}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <i className="fa-solid fa-check" aria-hidden="true" />
            )}
            <span>
              {isReport
                ? "Bác bỏ báo cáo"
                : isRejectedPost
                  ? "Khôi phục & Phê duyệt"
                  : "Phê duyệt hiển thị"}
            </span>
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}
