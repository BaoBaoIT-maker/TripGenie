'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatTripDates } from '../../model/itinerary-format';
import {
  PARTY_SIZE_BOUNDS,
  type WorkspaceTabKey,
} from '../../constants/itinerary.constants';
import { TRIP_COMPANIONS_CONFIG } from '../../config/trip-companions.config';
import type { ItineraryDetail, ItineraryMemberSummary } from '@/types/itinerary';

export interface ItineraryHeroHeaderProps {
  data: ItineraryDetail;
  activeCoverPhoto: string;
  totalDays: number;
  totalNights: number;
  isOwner: boolean;
  canEdit: boolean;
  isMemberOrOwner: boolean;
  memberCount: number;
  members: ItineraryMemberSummary[];
  pendingProposalsCount: number;
  activeTab: WorkspaceTabKey;
  onSelectTab: (tab: WorkspaceTabKey) => void;
  onBack: () => void;
  onOpenCoverModal: () => void;
  onOpenEditMetaModal: () => void;
  onOpenCompanionsModal: () => void;
  onOpenPrintModal: () => void;
  onShare: () => void;
  onClone: () => void;
  onOpenDeleteModal: () => void;
  onUpdatePartySize: (nextSize: number) => void;
  isCloning?: boolean;
  isUpdatingMeta?: boolean;
}

export function ItineraryHeroHeader({
  data,
  activeCoverPhoto,
  totalDays,
  totalNights,
  isOwner,
  canEdit,
  isMemberOrOwner,
  memberCount,
  members,
  pendingProposalsCount,
  activeTab,
  onSelectTab,
  onBack,
  onOpenCoverModal,
  onOpenEditMetaModal,
  onOpenCompanionsModal,
  onOpenPrintModal,
  onShare,
  onClone,
  onOpenDeleteModal,
  onUpdatePartySize,
  isCloning = false,
  isUpdatingMeta = false,
}: ItineraryHeroHeaderProps) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const partySize = Math.max(
    PARTY_SIZE_BOUNDS.MIN,
    data.budgetBreakdown?.partySize ?? data.partySize ?? PARTY_SIZE_BOUNDS.DEFAULT,
  );
  const showSyncMemberBanner = isOwner && memberCount > partySize;

  const handleStepPartySize = (delta: number) => {
    if (!isOwner || isUpdatingMeta) return;
    const next = Math.min(PARTY_SIZE_BOUNDS.MAX, Math.max(PARTY_SIZE_BOUNDS.MIN, partySize + delta));
    if (next !== partySize) {
      onUpdatePartySize(next);
    }
  };

  const formattedCompactBudget = data.budgetBreakdown
    ? `~${(data.budgetBreakdown.totalEstimated / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`
    : null;

  return (
    <header className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Compact Cover Banner with max 2 translucent frosted buttons */}
      <div className="relative h-44 sm:h-48 w-full bg-slate-200 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeCoverPhoto}
          alt={data.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/15 to-slate-950/35" />

        <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-3.5 rounded-xl bg-white/90 hover:bg-white text-[#10243A] text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md shadow-xs transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
            <span>Quay lại</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onOpenCoverModal}
              className="h-9 px-3.5 rounded-xl bg-slate-950/55 hover:bg-slate-950/75 text-white border border-white/25 text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-camera text-xs" aria-hidden="true" />
              <span>Đổi ảnh bìa</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Hero Identity, Metadata & Primary Action Bar */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {data.destination && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F0F7FF] text-[#0194F3] text-xs font-bold">
                  <i className="fa-solid fa-location-dot text-[11px]" aria-hidden="true" />
                  <span>{data.destination}</span>
                </span>
              )}
              {data.viewerRole && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                  {TRIP_COMPANIONS_CONFIG.ROLES[data.viewerRole]}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug tracking-tight">
              {data.title}
            </h1>

            {data.description && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                {data.description}
              </p>
            )}
          </div>

          {/* Action Bar + Overflow Menu */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onShare}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#D0E7FF] text-xs font-bold text-[#10243A] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-share-nodes text-xs" aria-hidden="true" />
              <span>Chia sẻ</span>
            </button>

            <button
              type="button"
              onClick={onOpenPrintModal}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#D0E7FF] text-xs font-bold text-[#10243A] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-print text-xs" aria-hidden="true" />
              <span>Xuất PDF</span>
            </button>

            <button
              type="button"
              disabled={isCloning}
              onClick={onClone}
              className="h-9 px-3.5 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCloning ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
              ) : (
                <i className="fa-regular fa-clone text-xs" aria-hidden="true" />
              )}
              <span>{isCloning ? 'Đang sao chép...' : 'Sao chép'}</span>
            </button>

            {(canEdit || isMemberOrOwner || isOwner) && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Tùy chọn thêm"
                  aria-expanded={isOverflowOpen}
                  onClick={() => setIsOverflowOpen((v) => !v)}
                  className="size-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-ellipsis text-sm" aria-hidden="true" />
                </button>

                {isOverflowOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsOverflowOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 mt-1.5 w-56 rounded-2xl border border-slate-200 bg-white shadow-lg py-1.5 z-30 text-xs">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            onOpenEditMetaModal();
                          }}
                          className="w-full px-3.5 py-2 text-left font-semibold text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3] flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-pen-to-square w-3.5 text-center" aria-hidden="true" />
                          <span>Chỉnh sửa tên, ngày &amp; mô tả</span>
                        </button>
                      )}
                      {isMemberOrOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            onOpenCompanionsModal();
                          }}
                          className="w-full px-3.5 py-2 text-left font-semibold text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3] flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-users w-3.5 text-center" aria-hidden="true" />
                          <span>Quản lý bạn đồng hành</span>
                        </button>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            onOpenDeleteModal();
                          }}
                          className="w-full px-3.5 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                        >
                          <i className="fa-regular fa-trash-can w-3.5 text-center" aria-hidden="true" />
                          <span>Xóa chuyến đi</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Metadata Strip + Party Size Stepper + Member Stack */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 w-full sm:w-auto">
            {canEdit ? (
              <button
                type="button"
                onClick={onOpenEditMetaModal}
                title="Bấm để chỉnh sửa ngày chuyến đi"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-[#F0F7FF] hover:border-[#0194F3]/40 hover:text-[#0194F3] border border-slate-200/80 font-semibold text-slate-700 tabular-nums transition-colors cursor-pointer group text-left"
              >
                <i className="fa-regular fa-calendar text-[#0194F3]" aria-hidden="true" />
                <span>{formatTripDates(data.startDate, data.endDate)}</span>
                <i className="fa-solid fa-pen text-[9px] text-slate-400 group-hover:text-[#0194F3] transition-colors ml-0.5" aria-hidden="true" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 font-semibold text-slate-700 tabular-nums">
                <i className="fa-regular fa-calendar text-[#0194F3]" aria-hidden="true" />
                <span>{formatTripDates(data.startDate, data.endDate)}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 font-semibold text-slate-700 tabular-nums">
              <i className="fa-regular fa-clock text-[#0194F3]" aria-hidden="true" />
              <span>
                {totalDays}N{totalNights}Đ
              </span>
            </span>

            {/* Inline Party Size Stepper (Owner edits, others view) */}
            {isOwner ? (
              <div className="col-span-2 sm:col-span-1 inline-flex items-center justify-between gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                <button
                  type="button"
                  aria-label="Giảm số người dự kiến"
                  disabled={isUpdatingMeta || partySize <= PARTY_SIZE_BOUNDS.MIN}
                  onClick={() => handleStepPartySize(-1)}
                  className="size-7 rounded-lg bg-white hover:bg-[#F0F7FF] text-slate-700 hover:text-[#0194F3] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <i className="fa-solid fa-minus text-[10px]" aria-hidden="true" />
                </button>
                <span className="px-2 text-xs font-bold text-[#10243A] tabular-nums inline-flex items-center gap-1">
                  <i className="fa-solid fa-user-group text-[11px] text-[#0194F3]" aria-hidden="true" />
                  <span>{partySize} người</span>
                </span>
                <button
                  type="button"
                  aria-label="Tăng số người dự kiến"
                  disabled={isUpdatingMeta || partySize >= PARTY_SIZE_BOUNDS.MAX}
                  onClick={() => handleStepPartySize(1)}
                  className="size-7 rounded-lg bg-white hover:bg-[#F0F7FF] text-slate-700 hover:text-[#0194F3] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <i className="fa-solid fa-plus text-[10px]" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 font-medium tabular-nums">
                <i className="fa-solid fa-user-group text-[#0194F3]" aria-hidden="true" />
                <span>{partySize} người</span>
              </span>
            )}
          </div>

          {/* Clickable Companion Stack */}
          {isMemberOrOwner && (
            <button
              type="button"
              onClick={onOpenCompanionsModal}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-[#F5F9FF] border border-transparent hover:border-[#D0E7FF] transition-colors cursor-pointer"
              title="Quản lý thành viên chuyến đi"
            >
              <div className="flex items-center -space-x-2">
                {members.slice(0, 4).map((m) => (
                  <Avatar key={m.userId} className="size-7 border-2 border-white ring-1 ring-slate-200">
                    <AvatarImage src={m.avatarUrl || undefined} alt={m.fullName || 'Thành viên'} />
                    <AvatarFallback className="text-[10px] font-bold bg-[#10243A] text-white">
                      {(m.fullName || 'TV').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {memberCount > 4 && (
                  <span className="size-7 rounded-full bg-slate-100 border-2 border-white text-[10px] font-bold text-slate-600 flex items-center justify-center tabular-nums">
                    +{memberCount - 4}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-[#0194F3] tabular-nums">
                {memberCount} thành viên
              </span>
            </button>
          )}
        </div>

        {/* Soft Sync-Member Banner */}
        {showSyncMemberBanner && (
          <div className="rounded-xl border border-[#D0E7FF] bg-[#F5F9FF] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#10243A]">
              <i className="fa-solid fa-users-gear text-[#0194F3] shrink-0" aria-hidden="true" />
              <span className="tabular-nums">
                Đoàn đã có <strong>{memberCount} thành viên</strong> tham gia, trong khi dự toán chi phí đang tính cho{' '}
                <strong>{partySize} người</strong>.
              </span>
            </div>
            <button
              type="button"
              disabled={isUpdatingMeta}
              onClick={() => onUpdatePartySize(Math.min(PARTY_SIZE_BOUNDS.MAX, memberCount))}
              className="h-8 px-3 rounded-lg bg-[#0194F3] hover:bg-[#007AD0] text-white font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Đồng bộ sang {Math.min(PARTY_SIZE_BOUNDS.MAX, memberCount)} người
            </button>
          </div>
        )}
      </div>

      {/* Workspace Sub-tabs attached to bottom edge */}
      <nav
        role="tablist"
        aria-label="Không gian làm việc lịch trình"
        className="px-4 sm:px-6 border-t border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-50/40"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'itinerary'}
          onClick={() => onSelectTab('itinerary')}
          className={`px-4 py-3 text-xs sm:text-[13px] font-bold tracking-tight border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'itinerary'
              ? 'border-[#0194F3] text-[#0194F3]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <i className="fa-solid fa-route text-xs" aria-hidden="true" />
          <span>Lịch trình</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'budget'}
          onClick={() => onSelectTab('budget')}
          className={`px-4 py-3 text-xs sm:text-[13px] font-bold tracking-tight border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'budget'
              ? 'border-[#0194F3] text-[#0194F3]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <i className="fa-solid fa-wallet text-xs" aria-hidden="true" />
          <span>Chi phí</span>
          {formattedCompactBudget && (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold tabular-nums">
              {formattedCompactBudget}
            </span>
          )}
        </button>

        {isMemberOrOwner && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'voting'}
            onClick={() => onSelectTab('voting')}
            className={`px-4 py-3 text-xs sm:text-[13px] font-bold tracking-tight border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'voting'
                ? 'border-[#0194F3] text-[#0194F3]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-check-to-slot text-xs" aria-hidden="true" />
            <span>Bình chọn</span>
            {pendingProposalsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#0194F3] text-white text-[10px] font-bold tabular-nums">
                {pendingProposalsCount}
              </span>
            )}
          </button>
        )}

        {isMemberOrOwner && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'group'}
            onClick={() => onSelectTab('group')}
            className={`px-4 py-3 text-xs sm:text-[13px] font-bold tracking-tight border-b-2 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'group'
                ? 'border-[#0194F3] text-[#0194F3]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-users text-xs" aria-hidden="true" />
            <span>Đoàn &amp; Hướng dẫn</span>
          </button>
        )}
      </nav>
    </header>
  );
}
