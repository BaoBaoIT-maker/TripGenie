"use client";

import { useState } from "react";

export function CompanionsSection() {
  const [lanAnhRole, setLanAnhRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [hoangNamRole, setHoangNamRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [hasVoted, setHasVoted] = useState(true);

  return (
    <section
      id="companions"
      className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div className="bg-gradient-to-br from-[#F5F9FF] via-white to-[#F0F7FF] border border-blue-100 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Value Proposition */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#0194F3] border border-blue-200/80 text-xs font-bold uppercase tracking-wider">
            <i className="fa-solid fa-users text-xs" />
            <span>Hội Bạn Đồng Hành</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Lên kế hoạch cùng bạn bè, không lo lạc trôi tin nhắn
          </h2>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Gửi liên kết mời nhóm bạn cùng vào xem lịch trình, phân quyền rõ ràng và biểu quyết chốt điểm đến ngay trên một màn hình trực quan duy nhất.
          </p>

          {/* Semantic Feature List (Không dùng dấu tích tròn lặp máy móc) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-xl bg-blue-100/80 text-[#0194F3] flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i className="fa-solid fa-shield-halved" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Phân quyền thành viên minh bạch
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-normal">
                  Chủ chuyến đi toàn quyền kiểm soát, cho phép bạn bè chỉnh sửa hoặc chỉ xem để tránh ai đó lỡ tay xóa nhầm.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i className="fa-solid fa-square-poll-vertical" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Biểu quyết dân chủ theo thời gian thực
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-normal">
                  Bỏ phiếu chọn quán ăn, địa điểm check-in trong tích tắc, đồng thuận nhanh mà không cần tranh cãi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center text-sm shrink-0 mt-0.5">
                <i className="fa-solid fa-receipt" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Chia đều chi phí tự động (Split Bill)
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-normal">
                  Ghi nhận ai đã thanh toán, tự động tính số tiền từng người cần gửi lại, minh bạch đến từng nghìn đồng.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Craft Collaboration Mockup */}
        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-xl space-y-5">
          {/* Mockup Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Chuyến đi Đà Nẵng — Hội An 3N2Đ
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-semibold">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>3 thành viên đang online</span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0194F3] border border-blue-200/80 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-user-plus text-xs" />
              <span>Mời thêm bạn</span>
            </button>
          </div>

          {/* Member List with High Contrast & Unbreakable Flow */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Thành viên chuyến đi
            </span>

            {/* Member 1: Huy (Owner) */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-[#0194F3] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  MH
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                    Minh Huy (Bạn)
                  </span>
                  <span className="text-[11px] text-[#0194F3] font-semibold block">
                    Chủ chuyến đi
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-100/70 text-blue-900 border border-blue-200/50">
                Toàn quyền
              </span>
            </div>

            {/* Member 2: Lan Anh */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  LA
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                    Lan Anh
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {lanAnhRole === "EDITOR" ? "Có thể chỉnh sửa" : "Chỉ xem lịch trình"}
                  </span>
                </div>
              </div>

              <select
                value={lanAnhRole}
                onChange={(e) => setLanAnhRole(e.target.value as "EDITOR" | "VIEWER")}
                aria-label="Phân quyền cho Lan Anh"
                className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 cursor-pointer"
              >
                <option value="EDITOR">Chỉnh sửa</option>
                <option value="VIEWER">Chỉ xem</option>
              </select>
            </div>

            {/* Member 3: Nam */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  HN
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                    Hoàng Nam
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {hoangNamRole === "EDITOR" ? "Có thể chỉnh sửa" : "Chỉ xem lịch trình"}
                  </span>
                </div>
              </div>

              <select
                value={hoangNamRole}
                onChange={(e) => setHoangNamRole(e.target.value as "EDITOR" | "VIEWER")}
                aria-label="Phân quyền cho Hoàng Nam"
                className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 cursor-pointer"
              >
                <option value="VIEWER">Chỉ xem</option>
                <option value="EDITOR">Chỉnh sửa</option>
              </select>
            </div>
          </div>

          {/* Collaborative Live Vote Snippet (Evidence over claims) */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Đang biểu quyết: Bữa tối Ngày 1
              </span>
              <span className="text-emerald-600 font-bold">3/3 đồng thuận</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#0194F3] shrink-0 text-xs">
                  <i className="fa-solid fa-utensils" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    Hải sản Năm Đảnh (Sơn Trà)
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Mì xào hải sản &amp; ốc hương sốt trứng muối
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHasVoted(!hasVoted)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hasVoted
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {hasVoted ? "✓ Đã chọn" : "Bình chọn"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
