'use client';

import { formatVnd } from '../../model/itinerary-format';
import type { BudgetBreakdown } from '@/types/itinerary';
import {
  Ticket,
  UtensilsCrossed,
  BedDouble,
  Car,
  Plane,
  Info,
} from 'lucide-react';

interface Props {
  breakdown: BudgetBreakdown;
  transitModeName?: string;
  totalDays?: number;
}

export default function BudgetBreakdownCard({
  breakdown,
  transitModeName,
  totalDays = 3,
}: Props) {
  const nights = Math.max(1, totalDays - 1);
  const total = Math.max(1, breakdown.totalEstimated);

  // Compute percentages for the 5-segment bar
  const pTransit = Math.round((breakdown.transitRoundTrip / total) * 100);
  const pHotel = Math.round((breakdown.accommodation / total) * 100);
  const pFood = Math.round((breakdown.food / total) * 100);
  const pTickets = Math.round((breakdown.tickets / total) * 100);
  const pLocal = Math.max(1, 100 - (pTransit + pHotel + pFood + pTickets));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
      {/* Header with Total Estimated */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Dự toán chi phí 5 khoản
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Ước lượng minh bạch từ dữ liệu địa điểm thực tế</p>
        </div>
        <span className="text-sm font-extrabold text-teal-800 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-full shadow-2xs">
          ~{formatVnd(breakdown.totalEstimated)} / người
        </span>
      </div>

      {/* Multi-colored Progress Bar (Matches Figma Prompt Screen 2 Item 3) */}
      <div className="space-y-1.5">
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 shadow-2xs">
          <div
            style={{ width: `${pTransit}%` }}
            className="bg-teal-600 transition-all duration-500"
            title={`Vé di chuyển: ${pTransit}%`}
          />
          <div
            style={{ width: `${pHotel}%` }}
            className="bg-indigo-600 transition-all duration-500"
            title={`Khách sạn: ${pHotel}%`}
          />
          <div
            style={{ width: `${pFood}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Ăn uống: ${pFood}%`}
          />
          <div
            style={{ width: `${pTickets}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Vé tham quan: ${pTickets}%`}
          />
          <div
            style={{ width: `${pLocal}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Đi lại nội thành: ${pLocal}%`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-x-3 gap-y-1 pt-0.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-teal-600" />
            Di chuyển ({pTransit}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-indigo-600" />
            Khách sạn ({pHotel}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            Ăn uống ({pFood}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            Vé ({pTickets}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Nội thành ({pLocal}%)
          </span>
        </div>
      </div>

      {/* Detailed 5-Row Cost List */}
      <div className="divide-y divide-slate-100 text-xs pt-1">
        <div className="py-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-slate-800 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal-600 shrink-0" />
              1. Vé {transitModeName || 'di chuyển'} khứ hồi
            </span>
            <p className="text-[11px] text-slate-500 pl-4">Cước phí vé theo chặng và ngày khởi hành</p>
          </div>
          <span className="font-bold text-slate-900 shrink-0">
            {formatVnd(breakdown.transitRoundTrip)}
          </span>
        </div>

        <div className="py-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-slate-800 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-600 shrink-0" />
              2. Lưu trú khách sạn ({nights} đêm)
            </span>
            <p className="text-[11px] text-slate-500 pl-4">Đơn giá phòng theo tiêu chuẩn sao đã tính hệ số vùng</p>
          </div>
          <span className="font-bold text-slate-900 shrink-0">
            {formatVnd(breakdown.accommodation)}
          </span>
        </div>

        <div className="py-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-slate-800 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              3. Di chuyển nội địa ({totalDays} ngày)
            </span>
            <p className="text-[11px] text-slate-500 pl-4">Thuê xe máy / Taxi nội thành kèm phụ cấp xăng xe</p>
          </div>
          <span className="font-bold text-slate-900 shrink-0">
            {formatVnd(breakdown.localTransit)}
          </span>
        </div>

        <div className="py-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-slate-800 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
              4. Vé tham quan danh lam thắng cảnh
            </span>
            <p className="text-[11px] text-slate-500 pl-4">Tổng giá vé niêm yết của các điểm đến trong lịch (điểm miễn phí: 0đ)</p>
          </div>
          <span className="font-bold text-slate-900 shrink-0">
            {formatVnd(breakdown.tickets)}
          </span>
        </div>

        <div className="py-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-slate-800 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
              5. Ẩm thực & Cafe địa phương ({totalDays} ngày)
            </span>
            <p className="text-[11px] text-slate-500 pl-4">Tính theo khoảng giá thực đơn các quán ăn/cafe được xếp lịch</p>
          </div>
          <span className="font-bold text-slate-900 shrink-0">
            {formatVnd(breakdown.food)}
          </span>
        </div>
      </div>

      {/* Advisory Note */}
      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed">
        <Info className="size-3.5 text-teal-600 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <strong>Lưu ý:</strong> Ngân sách được tính tự động từ dữ liệu giá cào được của từng địa điểm. Khuyến nghị dự phòng 10-15% cho mua sắm quà lưu niệm hoặc chi tiêu phát sinh theo mùa du lịch.
        </span>
      </div>
    </div>
  );
}
