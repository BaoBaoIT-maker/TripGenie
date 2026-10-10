"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, CalendarDays, Bookmark, Plus, Compass, Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlannerCard } from "@/components/planner/PlannerCard";
import { PlaceCard } from "@/components/place/PlaceCard";
import { usePlannersQuery } from "@/features/planner/hooks/use-planner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AccountSecuritySection } from "@/features/auth/components/AccountSecuritySection";
import { MOCK_PLACES } from "@/mocks/data/places";
import { toast } from "sonner";

function ProfileContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"planners" | "saved" | "preferences" | "account">(() => {
    if (tabParam === "account") return "account";
    return "planners";
  });

  useEffect(() => {
    if (tabParam === "account") {
      setActiveTab("account");
    }
  }, [tabParam]);
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

  const { data: planners = [] } = usePlannersQuery();

  // User's planners (owned, authored, or customized)
  const myPlanners = planners.filter(
    (p) =>
      p.members?.some((m) => m.userId === "user-current") ||
      p.authorName?.includes("Của bạn") ||
      p.authorName?.includes("Trọng Phúc") ||
      !p.authorName?.includes("AI")
  );

  // Saved mock places
  const savedPlaces = MOCK_PLACES.slice(0, 8);

  const togglePref = (item: string) => {
    if (preferences.includes(item)) {
      setPreferences(preferences.filter((p) => p !== item));
    } else {
      setPreferences([...preferences, item]);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Profile Header */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-xs">
        <Avatar className="size-20 sm:size-24 border-2 border-primary/20 shadow-sm shrink-0">
          <AvatarImage
            src={user?.avatarUrl || "/avatar.jpg"}
            alt={user?.fullName || "Avatar Trọng Phúc"}
          />
          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
            {user?.fullName
              ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
              : "TP"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
              {user?.fullName || "Trọng Phúc"}
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Đã lưu thiết lập hồ sơ!")}
              className="text-xs rounded-xl self-center sm:self-auto gap-1.5"
            >
              <Settings className="size-3.5" />
              <span>Chỉnh sửa hồ sơ</span>
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Đam mê khám phá các góc cafe yên bình, săn hoàng hôn và thưởng thức đặc sản ẩm thực từng vùng miền.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground pt-1">
            <span className="font-medium text-foreground/80">📍 TP. Hồ Chí Minh</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("planners")}
              className={`cursor-pointer transition-colors hover:text-primary ${
                activeTab === "planners" ? "font-bold text-primary" : ""
              }`}
            >
              📋 {myPlanners.length} Lịch trình đã tạo
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("saved")}
              className={`cursor-pointer transition-colors hover:text-primary ${
                activeTab === "saved" ? "font-bold text-primary" : ""
              }`}
            >
              ❤️ {savedPlaces.length} Địa điểm đã lưu
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("planners")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "planners"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <CalendarDays className="size-4" />
          <span>Lịch trình của tôi ({myPlanners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("saved")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "saved"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <Bookmark className="size-4" />
          <span>Địa điểm đã lưu ({savedPlaces.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "preferences"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4" />
          <span>Sở thích gợi ý AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "account"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <ShieldCheck className="size-4" />
          <span>Tài khoản & Bảo mật</span>
        </button>
      </div>

      {/* Tab: Account & Security */}
      {activeTab === "account" && <AccountSecuritySection />}

      {/* Tab 1: Planners List */}
      {activeTab === "planners" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-heading text-foreground">
                Lịch trình chuyến đi của bạn
              </h2>
              <p className="text-xs text-muted-foreground">
                Các chuyến đi bạn đã lên kế hoạch hoặc tạo bằng AI.
              </p>
            </div>
            <Link href="/planner/new">
              <Button size="sm" className="rounded-xl font-bold gap-1.5 text-xs">
                <Plus className="size-3.5" />
                <span>Tạo lịch trình mới</span>
              </Button>
            </Link>
          </div>

          {myPlanners.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-12 text-center space-y-3">
              <CalendarDays className="size-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">Bạn chưa có lịch trình nào</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bắt đầu chuyến đi mới với sự hỗ trợ của AI hoặc tự thiết kế lịch trình theo ý bạn.
              </p>
              <Link href="/planner/new">
                <Button size="sm" className="rounded-xl font-bold gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  <span>Tạo ngay</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {myPlanners.map((p) => (
                <PlannerCard key={p.id} planner={p} editHref={`/planner/${p.id}/edit`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Saved Places */}
      {activeTab === "saved" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-heading text-foreground">
                Địa điểm đã lưu
              </h2>
              <p className="text-xs text-muted-foreground">
                Các quán cafe, nhà hàng và điểm tham quan bạn quan tâm.
              </p>
            </div>
            <Link href="/explore">
              <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5 text-xs">
                <Compass className="size-3.5" />
                <span>Khám phá thêm</span>
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {savedPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Preferences Section for AI Recommendation */}
      {activeTab === "preferences" && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs max-w-3xl">
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
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
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
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1400px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
          <div className="h-44 rounded-3xl bg-muted/40 animate-pulse border border-border" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
