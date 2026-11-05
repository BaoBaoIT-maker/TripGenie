"use client";

import { useState } from "react";

export function CompanionsSection() {
  const [lanAnhRole, setLanAnhRole] = useState("EDITOR");
  const [hoangNamRole, setHoangNamRole] = useState("VIEWER");

  return (
    <section
      id="companions"
      className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/70 border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0194F3] text-white text-xs font-bold uppercase tracking-wider shadow-xs">
            Hội Bạn Đồng Hành
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 leading-tight">
            Lên kế hoạch cùng bạn bè, không lo lạc trôi tin nhắn Zalo
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Gửi link mời bạn bè cùng vào xem lịch trình, đề xuất quán ăn yêu thích và biểu quyết chọn điểm đến ngay trên giao diện trực quan.
          </p>

          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 font-medium pt-2">
            <li className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-[#0194F3] text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <span>
                Phân quyền rõ ràng: <strong>Chủ chuyến đi</strong>, <strong>Chỉnh sửa</strong>, và <strong>Chỉ xem</strong>.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-[#0194F3] text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <span>Chia đều chi phí từng bữa ăn tự động (Split Bills).</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-5 rounded-full bg-[#0194F3] text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <span>Đồng bộ thông báo tức thì khi có thành viên đổi giờ giấc.</span>
            </li>
          </ul>
        </div>

        {/* Right Mockup */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Chuyến đi Đà Nẵng 3N2Đ</h4>
              <span className="text-[11px] text-emerald-600 font-semibold">Đang hoạt động 3 thành viên online</span>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0194F3] border border-blue-200 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              + Mời thêm bạn
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Member 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-[#0194F3] flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  MH
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Minh Huy (Bạn)</span>
                  <span className="text-[10px] text-blue-700 font-semibold">Chủ chuyến đi</span>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700">
                Toàn quyền
              </span>
            </div>

            {/* Member 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  LA
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Lan Anh</span>
                  <span className="text-[10px] text-[#0194F3] font-semibold">
                    {lanAnhRole === "EDITOR" ? "Có quyền chỉnh sửa" : "Chỉ xem lịch trình"}
                  </span>
                </div>
              </div>
              <select
                value={lanAnhRole}
                onChange={(e) => setLanAnhRole(e.target.value)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-300 text-[#0194F3] focus:outline-none cursor-pointer"
              >
                <option value="EDITOR">Chỉnh sửa</option>
                <option value="VIEWER">Chỉ xem</option>
              </select>
            </div>

            {/* Member 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-amber-500 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  HN
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Hoàng Nam</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {hoangNamRole === "EDITOR" ? "Có quyền chỉnh sửa" : "Chỉ xem lịch trình"}
                  </span>
                </div>
              </div>
              <select
                value={hoangNamRole}
                onChange={(e) => setHoangNamRole(e.target.value)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="VIEWER">Chỉ xem</option>
                <option value="EDITOR">Chỉnh sửa</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
