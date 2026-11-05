import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_transparent.png"
              alt="TripGenie Logo"
              width={48}
              height={48}
              className="h-12 w-auto object-contain"
            />
            <div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                TripGenie
              </span>
              <p className="text-xs text-slate-500 -mt-0.5 font-medium">
                Nền tảng Lập Kế hoạch Du lịch Việt Nam
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#destinations" className="hover:text-[#0194F3] transition-colors">
              Điểm đến
            </a>
            <a href="#timeline" className="hover:text-[#0194F3] transition-colors">
              Lịch trình mẫu
            </a>
            <a href="#food-guide" className="hover:text-[#0194F3] transition-colors">
              Cẩm nang ẩm thực
            </a>
            <a href="#companions" className="hover:text-[#0194F3] transition-colors">
              Bạn đồng hành
            </a>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 TripGenie Platform. Thiết kế tinh gọn, chuẩn trải nghiệm du lịch hiện đại.</p>
          <div className="flex items-center gap-6 font-medium">
            <a href="#" className="hover:text-slate-800 transition-colors">
              Điều khoản
            </a>
            <a href="#" className="hover:text-slate-800 transition-colors">
              Bảo mật
            </a>
            <a href="#" className="hover:text-slate-800 transition-colors">
              Liên hệ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
