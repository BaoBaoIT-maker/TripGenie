"use client";

import { useState } from "react";

export function CoreFeaturesSection() {
  // Feature 1: Route toggle state
  const [routeState, setRouteState] = useState<"da-nang" | "phu-quoc">("da-nang");

  // Feature 2: Group count state for budget split
  const [groupCount, setGroupCount] = useState<number>(2);
  const totalTripCost = 5400000;
  const costPerPerson = Math.round(totalTripCost / groupCount);

  // Feature 3: Interactive vote states
  const [vote1, setVote1] = useState<boolean>(true);
  const [vote2, setVote2] = useState<boolean>(false);

  return (
    <section
      id="timeline"
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F0F7FF] via-[#F8FAFC] to-[#F1F5F9] border-y border-slate-200/80 overflow-hidden"
    >
      {/* Subtle Topographic Contour Map Watermark (Vector SVG siêu nhẹ, 0% lag, tạo chất du lịch) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#0194F3_1px,transparent_1px)] [background-size:24px_24px]"></div>

      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-28 sm:space-y-36">
        {/* Section Title & Intro */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 text-[#0194F3] border border-blue-200/80 text-xs font-bold uppercase tracking-wider">
            Tính Năng Trọng Tâm
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Lên kế hoạch thông minh hơn.
            <br className="hidden sm:inline" />
            Không còn bối rối giữa ma trận thông tin.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            TripGenie giải quyết trọn vẹn những điểm đau đầu nhất khi đi du lịch tự túc: tối ưu quãng đường di chuyển, minh bạch chi phí và gắn kết nhóm bạn cùng sửa lịch trình.
          </p>
        </div>

        {/* FEATURE BLOCK 1: LỘ TRÌNH THÔNG MINH (Text Left, Visual Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Story Text */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              01 / TỐI ƯU TUYẾN ĐƯỜNG
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Không còn cảnh chạy xe ngược xuôi. Lịch trình tự động gom tuyến ngắn nhất.
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Thay vì mất cả buổi tra cứu Google Maps để xem quán nào gần chùa Linh Ứng hay cầu Rồng, TripGenie tự động gom cụm các địa điểm gần nhau và đề xuất thứ tự di chuyển tối ưu — giúp bạn tiết kiệm trung bình 45 phút di chuyển mỗi ngày.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Tự động gom quán ăn &amp; điểm check-in trên cùng cung đường
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Cảnh báo khung giờ kẹt xe và gợi ý thời điểm ghé thăm đẹp nhất
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Dễ dàng kéo thả đổi thứ tự theo nhịp sinh hoạt thực tế
                </p>
              </div>
            </div>
          </div>

          {/* Visual Showcase Card */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Lộ trình mẫu đã tối ưu
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {routeState === "da-nang"
                      ? "Bán đảo Sơn Trà — Biển Mỹ Khê, Đà Nẵng"
                      : "Bãi Sao — Làng chài Hàm Ninh, Phú Quốc"}
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  {routeState === "da-nang"
                    ? "Tiết kiệm 45 phút/ngày"
                    : "Tiết kiệm 55 phút/ngày"}
                </span>
              </div>

              {/* Steps Container */}
              <div className="space-y-3.5">
                {routeState === "da-nang" ? (
                  <>
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-[#0194F3] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          08:00 — Mì Quảng Bà Mua (Ăn sáng)
                        </p>
                        <p className="text-xs text-slate-500">
                          95 Nguyễn Tri Phương, Hải Châu
                        </p>
                      </div>
                    </div>

                    <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 text-xs text-slate-500 py-1">
                      Di chuyển 3.8 km • Khoảng 12 phút đi xe máy / taxi
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          09:30 — Bán đảo Sơn Trà &amp; Chùa Linh Ứng
                        </p>
                        <p className="text-xs text-slate-500">
                          Tượng Phật Bà 67m hướng biển Đông
                        </p>
                      </div>
                    </div>

                    <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 text-xs text-slate-500 py-1">
                      Di chuyển 6.2 km • Cung đường ven biển Hoàng Sa mát rượi
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          12:00 — Hải sản Bé Mặn (Ăn trưa)
                        </p>
                        <p className="text-xs text-slate-500">
                          Bờ biển Mỹ Khê — Tôm sú sốt bơ tỏi, mực hấp hành
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-[#0194F3] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          08:30 — Bún Quậy Kiến Xây (Ăn sáng)
                        </p>
                        <p className="text-xs text-slate-500">
                          Đường Trần Phú, Dương Đông
                        </p>
                      </div>
                    </div>

                    <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 text-xs text-slate-500 py-1">
                      Di chuyển 14 km • Tuyến thẳng đường Nam đảo thoáng đãng
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          10:00 — Bãi Sao &amp; Hòn Mây Rút
                        </p>
                        <p className="text-xs text-slate-500">
                          Cát trắng mịn, nước trong ngọc bích
                        </p>
                      </div>
                    </div>

                    <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 text-xs text-slate-500 py-1">
                      Di chuyển 8 km • Đường ven biển hoàng hôn
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="size-7 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          17:30 — Làng chài Hàm Ninh (Ăn chiều)
                        </p>
                        <p className="text-xs text-slate-500">
                          Thưởng thức ghẹ Hàm Ninh &amp; ngắm hoàng hôn
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Interactive Toggle Button */}
              <button
                type="button"
                onClick={() =>
                  setRouteState((prev) =>
                    prev === "da-nang" ? "phu-quoc" : "da-nang"
                  )
                }
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg
                  className="size-4 text-[#0194F3]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>
                  {routeState === "da-nang"
                    ? "Bấm để xem mô phỏng chặng Phú Quốc"
                    : "Bấm để quay lại chặng Đà Nẵng"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* FEATURE BLOCK 2: DỰ TOÁN NGÂN SÁCH (Visual Left, Text Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Visual Showcase Card */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Bảng tính dự toán tự động
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    Chi phí dự kiến cho chuyến 3N2Đ
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-[#0194F3] text-xs font-bold border border-blue-200">
                  Chính xác 95%
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    Tổng ngân sách toàn chuyến:
                  </span>
                  <span className="text-base font-extrabold text-slate-900">
                    5.400.000 đ
                  </span>
                </div>

                {/* Distribution Bar */}
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-[#0194F3] h-full"
                      style={{ width: "45%" }}
                      title="Ẩm thực: 45%"
                    ></div>
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: "30%" }}
                      title="Vé & Vui chơi: 30%"
                    ></div>
                    <div
                      className="bg-indigo-500 h-full"
                      style={{ width: "25%" }}
                      title="Di chuyển: 25%"
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <span>
                      Ẩm thực: <strong>2.430.000 đ</strong>
                    </span>
                    <span>
                      Vé &amp; Chơi: <strong>1.620.000 đ</strong>
                    </span>
                    <span>
                      Đi lại: <strong>1.350.000 đ</strong>
                    </span>
                  </div>
                </div>

                {/* Interactive Split Controller */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Chia nhóm:</span>
                    <div className="flex items-center gap-1.5 bg-white rounded-xl p-1 border border-slate-300 shadow-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setGroupCount((prev) => Math.max(1, prev - 1))
                        }
                        className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-extrabold text-slate-900">
                        {groupCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setGroupCount((prev) => Math.min(6, prev + 1))
                        }
                        className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      thành viên
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">
                      Mỗi người thanh toán:
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {costPerPerson.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                *Tự động phân tách chi phí dùng chung của cả đoàn và chi tiêu cá nhân.
              </p>
            </div>
          </div>

          {/* Story Text */}
          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              02 / TÀI CHÍNH MINH BẠCH
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Biết trước chi phí từng món ăn. Chia tiền nhóm sòng phẳng, rõ ràng.
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Không còn những cuộc trao đổi tiền nong ngại ngùng sau chuyến đi. TripGenie cập nhật giá vé thực tế, mức giá trung bình của từng món đặc sản tại địa phương và tự động phân bổ đều cho từng thành viên trong đoàn.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Dữ liệu giá cả được xác thực từ quán ăn địa phương và khu du lịch
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Tự động chia tiền theo đầu người, sòng phẳng và minh bạch
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Không phát sinh phụ phí ẩn, chủ động tài chính trước khi khởi hành
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE BLOCK 3: CỘNG TÁC NHÓM (Text Left, Visual Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Story Text */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              03 / CỘNG TÁC THỜI GIAN THỰC
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Cả nhóm cùng lên kế hoạch qua một link. Không còn chat rối rắm.
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              Tạm biệt những chuỗi tin nhắn Zalo trôi tuột hay những bức ảnh chụp màn hình chắp vá. Chỉ cần chia sẻ một đường link duy nhất, cả nhóm bạn có thể cùng ghim quán cafe yêu thích, bỏ phiếu chọn bữa tối và xem lịch trình cập nhật theo thời gian thực.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Mời bạn bè tham gia nhanh bằng một đường link hoặc mã QR
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Bình chọn (Vote) trực tiếp để dân chủ chọn quán ăn theo số đông
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Đồng bộ tức thì trên cả điện thoại, máy tính bảng và laptop
                </p>
              </div>
            </div>
          </div>

          {/* Visual Showcase Card */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Hoạt động nhóm
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    Bình chọn bữa tối ngày 2 tại Đà Nẵng
                  </h4>
                </div>
                <div className="flex items-center -space-x-2">
                  <div className="size-8 rounded-full bg-[#0194F3] border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    MH
                  </div>
                  <div className="size-8 rounded-full bg-indigo-600 border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    LA
                  </div>
                  <div className="size-8 rounded-full bg-amber-500 border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    HN
                  </div>
                </div>
              </div>

              {/* Vote Items Container */}
              <div className="space-y-3">
                {/* Item 1 */}
                <button
                  type="button"
                  onClick={() => setVote1((prev) => !prev)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    vote1
                      ? "bg-blue-50/70 border-2 border-[#0194F3]"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        vote1
                          ? "bg-[#0194F3] text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {vote1 ? "✓" : "+"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Hải sản Năm Đảnh (K59/38 Trần Cảo)
                      </p>
                      <p className="text-xs text-slate-500">
                        Được Minh Huy &amp; Lan Anh đề xuất
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      vote1
                        ? "bg-white text-[#0194F3] border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {vote1 ? "3/3 Thành viên đồng ý" : "2/3 Thành viên đồng ý"}
                  </span>
                </button>

                {/* Item 2 */}
                <button
                  type="button"
                  onClick={() => setVote2((prev) => !prev)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    vote2
                      ? "bg-blue-50/70 border-2 border-[#0194F3]"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        vote2
                          ? "bg-[#0194F3] text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {vote2 ? "✓" : "+"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Bê thui Cầu Mống Mười Hiển
                      </p>
                      <p className="text-xs text-slate-500">
                        Đặc sản truyền thống Quảng Nam
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      vote2
                        ? "bg-white text-[#0194F3] border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {vote2 ? "2/3 Thành viên đồng ý" : "1/3 Thành viên đồng ý"}
                  </span>
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center font-medium">
                Nhấp chọn từng quán ăn để trải nghiệm tính năng vote nhóm trực quan
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
