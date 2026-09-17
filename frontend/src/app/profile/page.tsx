"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function ProfilePage() {
  const [preferences, setPreferences] = useState<string[]>([
    "Cafe chill",
    "View hoàng hôn",
    "Ẩm thực địa phương",
    "Thiên nhiên",
    "Chụp ảnh check-in",
  ]);

  const allPreferences = [
    "Cafe chill",
    "View hoàng hôn",
    "Ẩm thực địa phương",
    "Thiên nhiên",
    "Chụp ảnh check-in",
    "Du lịch tiết kiệm",
    "Nghỉ dưỡng sang chảnh",
    "Đi dã ngoại",
    "Vui chơi mạo hiểm",
    "Di tích lịch sử",
  ];

  const togglePref = (item: string) => {
    if (preferences.includes(item)) {
      setPreferences(preferences.filter((p) => p !== item));
    } else {
      setPreferences([...preferences, item]);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-16">
      {/* Profile Header */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-xs">
        <Avatar className="size-20 sm:size-24 border-2 border-primary/20 shadow-sm">
          <AvatarImage
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
            alt="Avatar"
          />
          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
            TP
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
              Trọng Phúc
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Đã lưu thiết lập hồ sơ!")}
              className="text-xs rounded-xl self-center sm:self-auto"
            >
              Chỉnh sửa hồ sơ
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg">
            Đam mê khám phá các góc cafe yên bình, săn hoàng hôn và thưởng thức đặc sản ẩm thực từng vùng miền.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1">
            <span>📍 TP. Hồ Chí Minh</span>
            <span>•</span>
            <span>📋 3 Lịch trình đã tạo</span>
            <span>•</span>
            <span>❤️ 12 Địa điểm đã lưu</span>
          </div>
        </div>
      </div>

      {/* Preferences Section for AI Recommendation */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
            <Sparkles className="size-3.5" />
            <span>Cá nhân hóa gợi ý AI</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Sở thích du lịch & Trải nghiệm
          </h2>
          <p className="text-xs text-muted-foreground">
            Chọn các sở thích để AI tự động ưu tiên gợi ý những địa điểm và lịch trình phù hợp nhất với bạn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          {allPreferences.map((pref) => {
            const isSelected = preferences.includes(pref);
            return (
              <button
                key={pref}
                type="button"
                onClick={() => togglePref(pref)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs scale-102"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isSelected ? `✓ ${pref}` : `+ ${pref}`}
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <Button
            onClick={() => toast.success("Đã cập nhật sở thích cho AI Recommendation!")}
            className="rounded-xl font-bold text-xs h-9 bg-primary text-primary-foreground"
          >
            Lưu sở thích
          </Button>
        </div>
      </div>
    </div>
  );
}
