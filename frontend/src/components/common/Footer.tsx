import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/80 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/logo_transparent.png"
                alt="TripGenie Logo"
                width={48}
                height={48}
                className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900">
                  TripGenie
                </span>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 -mt-0.5">
                  Nền Tảng Du Lịch Thông Minh
                </p>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm font-bold text-slate-600">
            <Link href="/explore" className="hover:text-[#0194F3] transition-colors">
              Khám phá
            </Link>
            <Link href="/planner" className="hover:text-[#0194F3] transition-colors">
              Lịch trình
            </Link>
            <Link href="/community" className="hover:text-[#0194F3] transition-colors">
              Cộng đồng
            </Link>
            <Link href="/collections" className="hover:text-[#0194F3] transition-colors">
              Bộ sưu tập
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 TripGenie Platform. Thiết kế tinh gọn, chuẩn trải nghiệm du lịch hiện đại.</p>
          <div className="flex items-center gap-6 font-medium">
            <span className="text-slate-400 font-medium">
              Phiên bản 2.0 • Đồng hành du lịch Việt Nam
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
