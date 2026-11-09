'use client';

import { UserCheck, Phone, MapPin, FileText, ClipboardList, Edit3, Printer } from 'lucide-react';
import type { TourBriefing } from '@/types/itinerary';

interface TourBriefingBannerProps {
  briefing?: TourBriefing | null;
  isOwner: boolean;
  onOpenModal: () => void;
}

/**
 * Web card under the hero header. The backend already redacts leaderPhone/notes for viewers
 * outside the trip, so each block simply renders only the fields it received.
 */
export function TourBriefingBanner({ briefing, isOwner, onOpenModal }: TourBriefingBannerProps) {
  const hasBriefing = Boolean(
    briefing && (briefing.leaderName || briefing.leaderPhone || briefing.meetingPoint || briefing.notes),
  );

  if (!hasBriefing && !isOwner) {
    return null;
  }

  return (
    <section
      aria-label="Thông tin điều hành đoàn và tập trung"
      className="bg-sky-50/70 border border-sky-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/70 pb-3 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-[#0068B8] text-white flex items-center justify-center shrink-0">
            <ClipboardList className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Thông tin Đoàn &amp; Hướng dẫn Tập trung</h2>
            <p className="text-xs text-slate-600">
              {hasBriefing
                ? 'Thông tin từ Trưởng nhóm dành cho thành viên chuyến đi'
                : 'Thiết lập thông tin Trưởng đoàn, giờ tập trung để chia sẻ cho nhóm và in phiếu hành trình A4'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 text-sky-950 border border-sky-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
        >
          {isOwner ? (
            <>
              <Edit3 className="size-3.5 text-[#0068B8]" aria-hidden="true" />
              <span>{hasBriefing ? 'Chỉnh sửa & Xem bản in A4' : 'Thiết lập Tờ Hướng Dẫn Tour'}</span>
            </>
          ) : (
            <>
              <Printer className="size-3.5 text-[#0068B8]" aria-hidden="true" />
              <span>Xem tờ hướng dẫn / Xuất PDF</span>
            </>
          )}
        </button>
      </div>

      {hasBriefing ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4 text-xs">
          {(briefing?.leaderName || briefing?.leaderPhone) && (
            <div className="bg-white/90 rounded-xl p-3 border border-sky-200">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <UserCheck className="size-3.5 text-[#0194F3]" aria-hidden="true" />
                <span>Trưởng đoàn / Phụ trách</span>
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {briefing?.leaderName || 'Chưa cập nhật tên'}
              </div>
              {briefing?.leaderPhone && (
                <a
                  href={`tel:${briefing.leaderPhone.replace(/\s+/g, '')}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-200 font-mono text-xs font-bold transition-colors"
                  title="Bấm để gọi điện cho Trưởng đoàn"
                >
                  <Phone className="size-3 text-[#0068B8]" aria-hidden="true" />
                  <span>{briefing.leaderPhone}</span>
                </a>
              )}
            </div>
          )}

          {briefing?.meetingPoint && (
            <div className="bg-white/90 rounded-xl p-3 border border-sky-200">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <MapPin className="size-3.5 text-[#0194F3]" aria-hidden="true" />
                <span>Điểm &amp; Giờ tập trung</span>
              </span>
              <p className="font-semibold text-slate-900 leading-relaxed">{briefing.meetingPoint}</p>
            </div>
          )}

          {briefing?.notes && (
            <div className="bg-white/90 rounded-xl p-3 border border-sky-200">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <FileText className="size-3.5 text-[#0194F3]" aria-hidden="true" />
                <span>Dặn dò / Lưu ý đoàn</span>
              </span>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{briefing.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-600 bg-white/80 rounded-xl px-3.5 py-2.5 border border-sky-200">
          Chưa có thông tin điều hành đoàn. Số điện thoại và ghi chú chỉ hiển thị với chủ lịch trình và thành viên nhóm;
          người xem công khai chỉ thấy tên trưởng đoàn và điểm tập trung.
        </div>
      )}
    </section>
  );
}
