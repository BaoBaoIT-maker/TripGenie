"use client";

import { useState, useCallback, memo } from "react";
import { X, Loader2 } from "lucide-react";
import { useReportCommunityPost } from "@/features/community/hooks/use-community";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import { CommunityModalPortal } from "./CommunityModalPortal";
import { useI18n } from "@/i18n";
import type { CommunityPostItem, CommunityReportType } from "@/types/community";

interface ReportPostModalProps {
  open: boolean;
  onClose: () => void;
  post: CommunityPostItem;
}

const REPORT_REASON_IDS: readonly CommunityReportType[] = [
  "SPAM",
  "FALSE_INFO",
  "INAPPROPRIATE",
  "COPYRIGHT",
  "OTHER",
];

const ReportReasonFieldset = memo(function ReportReasonFieldset({
  selectedType,
  onSelectType,
}: {
  selectedType: CommunityReportType;
  onSelectType: (type: CommunityReportType) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-extrabold text-[#0F172A] mb-1.5">
        {t("community.report.reasonLegend")} <span className="text-rose-500">*</span>
      </legend>
      {REPORT_REASON_IDS.map((reasonId) => {
        const checked = selectedType === reasonId;
        return (
          <label
            key={reasonId}
            className={`flex items-start gap-3 p-3 rounded-[14px] border cursor-pointer transition-colors ${
              checked
                ? "border-[#0194F3] bg-[#F0F7FF]"
                : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
            }`}
          >
            <input
              type="radio"
              name="reportType"
              value={reasonId}
              checked={checked}
              onChange={() => onSelectType(reasonId)}
              className="mt-0.5 accent-[#0194F3]"
            />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#0F172A]">
                {t(`community.report.reasons.${reasonId}.label`)}
              </div>
              <div className="text-[11px] text-[#64748B] leading-snug mt-0.5">
                {t(`community.report.reasons.${reasonId}.desc`)}
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
});

export function ReportPostModal({ open, onClose, post }: ReportPostModalProps) {
  const { t } = useI18n();
  const [reportType, setReportType] = useState<CommunityReportType>("SPAM");
  const [description, setDescription] = useState("");
  const reportMutation = useReportCommunityPost();

  const handleClose = useCallback(() => {
    if (!reportMutation.isPending) {
      setDescription("");
      setReportType("SPAM");
      onClose();
    }
  }, [reportMutation.isPending, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await reportMutation.mutateAsync({
      postId: post.id,
      payload: {
        reportType,
        description: description.trim() || undefined,
      },
    });
    handleClose();
  };

  return (
    <CommunityModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="report-post-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-rose-500 text-white flex items-center justify-center text-sm">
            <i className="fa-solid fa-flag" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="report-post-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              {t("community.report.title")}
            </h3>
            <p className="text-[11px] text-[#64748B]">
              {t("community.report.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={reportMutation.isPending}
          aria-label={t("community.report.closeAria")}
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Form Body */}
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4 overflow-y-auto flex-1 custom-scroll"
      >
        <div className="rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2.5 text-xs text-[#475569]">
          {t("community.report.reportingPrefix")}{" "}
          <strong className="text-[#0F172A] line-clamp-1">
            &ldquo;{post.title}&rdquo;
          </strong>{" "}
          {t("community.report.reportingBy")} <strong>{post.author.fullName}</strong>
        </div>

        <ReportReasonFieldset
          selectedType={reportType}
          onSelectType={setReportType}
        />

        <div className="space-y-1.5">
          <label
            htmlFor="report-description"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            {t("community.report.descriptionLabel")}
          </label>
          <textarea
            id="report-description"
            rows={3}
            maxLength={COMMUNITY_UI_CONSTANTS.MAX_REPORT_DESCRIPTION_LENGTH}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("community.report.descriptionPlaceholder")}
            className="w-full p-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors resize-none"
          />
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={reportMutation.isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={reportMutation.isPending}
            className="h-9 px-4 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {reportMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            <span>{t("community.report.submit")}</span>
          </button>
        </div>
      </form>
    </CommunityModalPortal>
  );
}
