import Link from "next/link";
import { MapPin, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 text-foreground py-12 mt-auto mb-16 md:mb-0">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Brand Col */}
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MapPin className="size-4" />
              </div>
              <span className="text-lg font-bold">TripTailor</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Hệ thống khám phá địa điểm du lịch và hỗ trợ lập kế hoạch trải nghiệm cá nhân hóa với bản đồ tương tác và AI.
            </p>
          </div>

          {/* Col 1 */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Khám phá
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/explore" className="hover:text-foreground transition-colors">
                  Tất cả địa điểm
                </Link>
              </li>
              <li>
                <Link href="/explore?category=cafe" className="hover:text-foreground transition-colors">
                  Quán Cafe & Trà
                </Link>
              </li>
              <li>
                <Link href="/explore?category=restaurant" className="hover:text-foreground transition-colors">
                  Ẩm thực & Nhà hàng
                </Link>
              </li>
              <li>
                <Link href="/explore?category=nature" className="hover:text-foreground transition-colors">
                  Thiên nhiên & Check-in
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Công cụ
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/planner/new" className="hover:text-foreground transition-colors">
                  Lập kế hoạch cá nhân
                </Link>
              </li>
              <li>
                <Link href="/planner" className="hover:text-foreground transition-colors">
                  Lịch trình đã lưu
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-foreground transition-colors">
                  Cộng đồng chia sẻ
                </Link>
              </li>
              <li>
                <Link href="/collections" className="hover:text-foreground transition-colors">
                  Bộ sưu tập yêu thích
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 TripTailor. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Xây dựng với</span>
            <Heart className="size-3.5 fill-red-500 text-red-500 inline" />
            <span>cho trải nghiệm du lịch Việt Nam</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
