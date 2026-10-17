"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  CalendarDays,
  Bookmark,
  Plus,
  Compass,
  Settings,
  ShieldCheck,
  Heart,
  MapPin,
  Loader2,
  Check,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlannerCard } from "@/components/planner/PlannerCard";
import { PlaceCard } from "@/components/place/PlaceCard";
import { usePlannersQuery } from "@/features/planner/hooks/use-planner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AccountSecuritySection } from "@/features/auth/components/AccountSecuritySection";
import { mapBackendPlaceToPlace } from "@/services/place.service";
import {
  useCollections,
  useCollectionDetail,
} from "@/features/collections/hooks/use-collections";
import {
  useUserPreferences,
  useUpdateUserPreferences,
} from "@/features/preferences/hooks/use-user-preferences";
import { BudgetLevel } from "@/services/user-preference.service";

const TRAVEL_STYLES = [
  { id: "CULTURE", label: "Văn hóa & Di sản" },
  { id: "FOOD", label: "Ẩm thực địa phương" },
  { id: "CHILL", label: "Nghỉ dưỡng & Cafe" },
  { id: "NATURE", label: "Thiên nhiên non nước" },
  { id: "ADVENTURE", label: "Khám phá & Trải nghiệm" },
  { id: "CHECKIN", label: "Chụp ảnh check-in" },
  { id: "HEALING", label: "Chữa lành tâm hồn" },
  { id: "BUDGET", label: "Du lịch tiết kiệm" },
];

const PREFERRED_CATEGORIES = [
  { id: "am-thuc", label: "Quán ăn & Ẩm thực" },
  { id: "cafe", label: "Quán cafe & Trà" },
  { id: "diem-tham-quan", label: "Điểm tham quan" },
  { id: "lich-su", label: "Di tích lịch sử" },
  { id: "mua-sam", label: "Chợ & Mua sắm" },
  { id: "giai-tri", label: "Khu vui chơi giải trí" },
];

const DIETARY_RESTRICTIONS = [
  { id: "VEGETARIAN", label: "Ăn chay" },
  { id: "HALAL", label: "Halal" },
  { id: "NO_SEAFOOD", label: "Không ăn hải sản" },
  { id: "NO_SPICY", label: "Không ăn cay" },
];

const BUDGET_LEVELS: { id: BudgetLevel; label: string; desc: string }[] = [
  { id: "LOW", label: "Tiết kiệm", desc: "Homestay, ăn đường phố, xe máy" },
  { id: "MEDIUM", label: "Vừa phải", desc: "Khách sạn 3*, nhà hàng vừa, taxi/xe máy" },
  { id: "HIGH", label: "Thoải mái", desc: "Resort 4*, trải nghiệm ẩm thực tinh hoa" },
  { id: "LUXURY", label: "Sang trọng", desc: "Nghỉ dưỡng 5* cao cấp, tour riêng tư" },
];

function ProfileContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"planners" | "saved" | "preferences" | "account">(() => {
    if (tabParam === "account") return "account";
    if (tabParam === "preferences") return "preferences";
    if (tabParam === "saved") return "saved";
    return "planners";
  });

  useEffect(() => {
    if (tabParam === "account") setActiveTab("account");
    if (tabParam === "preferences") setActiveTab("preferences");
    if (tabParam === "saved") setActiveTab("saved");
  }, [tabParam]);

  // Real Preferences from backend
  const { data: userPref, isLoading: isPrefLoading } = useUserPreferences({
    enabled: Boolean(user),
  });
  const updatePrefMutation = useUpdateUserPreferences();

  // Local form state for preferences tab
  const [selectedBudget, setSelectedBudget] = useState<BudgetLevel>("MEDIUM");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  useEffect(() => {
    if (userPref) {
      setSelectedBudget(userPref.budgetLevel || "MEDIUM");
      setSelectedStyles(userPref.travelStyle || []);
      setSelectedCategories(userPref.preferredCategories || []);
      setSelectedDietary(userPref.dietaryRestrictions || []);
    }
  }, [userPref]);

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleDietary = (id: string) => {
    setSelectedDietary((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleSavePreferences = () => {
    updatePrefMutation.mutate({
      budgetLevel: selectedBudget,
      travelStyle: selectedStyles,
      preferredCategories: selectedCategories,
      dietaryRestrictions: selectedDietary,
    });
  };

  // Real Planners
  const { data: planners = [] } = usePlannersQuery();
  const myPlanners = useMemo(() => {
    return planners.filter(
      (p) =>
        p.members?.some((m) => m.userId === user?.id) ||
        p.authorName?.includes(user?.fullName || "") ||
        !p.authorName?.includes("AI")
    );
  }, [planners, user]);

  // Real Collections & Saved Places
  const { data: collections = [] } = useCollections();
  const favoriteCollection = useMemo(() => {
    return collections.find((c) => c.title === "Yêu thích") || collections[0];
  }, [collections]);

  const { data: favDetail, isLoading: isFavLoading } = useCollectionDetail(
    favoriteCollection?.id || ""
  );

  const savedPlaceCount = favoriteCollection?._count?.places ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Profile Header */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-xs">
        <Avatar className="size-20 sm:size-24 border-2 border-primary/20 shadow-sm shrink-0">
          <AvatarImage
            src={user?.avatarUrl || "/avatar.jpg"}
            alt={user?.fullName || "Avatar Người dùng"}
          />
          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
            {user?.fullName
              ? user.fullName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "TG"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
              {user?.fullName || "Khách du lịch TripGenie"}
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("account")}
              className="text-xs rounded-xl self-center sm:self-auto gap-1.5"
            >
              <Settings className="size-3.5" />
              <span>Chỉnh sửa hồ sơ</span>
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            {user?.email || "Khám phá các điểm đến thông minh và thiết kế hành trình cùng TripGenie."}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <MapPin className="size-3 text-primary" />
              <span>Việt Nam</span>
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("planners")}
              className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:text-primary ${
                activeTab === "planners" ? "font-bold text-primary" : ""
              }`}
            >
              <CalendarDays className="size-3.5" />
              <span>{myPlanners.length} Lịch trình đã tạo</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("saved")}
              className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:text-primary ${
                activeTab === "saved" ? "font-bold text-primary" : ""
              }`}
            >
              <Heart className="size-3.5 text-rose-500 fill-current" />
              <span>{savedPlaceCount} Địa điểm đã lưu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("planners")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
            activeTab === "saved"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <Bookmark className="size-4" />
          <span>Địa điểm đã lưu ({savedPlaceCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
            activeTab === "preferences"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4" />
          <span>Sở thích du lịch AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
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
              <Button size="sm" className="rounded-xl font-semibold gap-1.5 text-xs">
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
                <Button size="sm" className="rounded-xl font-semibold gap-1.5 text-xs">
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

      {/* Tab 2: Saved Places (Real Collection Places) */}
      {activeTab === "saved" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-heading text-foreground">
                Địa điểm đã lưu
              </h2>
              <p className="text-xs text-muted-foreground">
                Các quán cafe, nhà hàng và điểm tham quan bạn đã lưu vào bộ sưu tập.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/collections"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "rounded-xl font-semibold gap-1.5 text-xs inline-flex items-center",
                })}
              >
                <Bookmark className="size-3.5" />
                <span>Xem tất cả bộ sưu tập</span>
              </Link>
              <Link
                href="/places"
                className={buttonVariants({
                  size: "sm",
                  className: "rounded-xl font-semibold gap-1.5 text-xs inline-flex items-center",
                })}
              >
                <Compass className="size-3.5" />
                <span>Khám phá thêm</span>
              </Link>
            </div>
          </div>

          {isFavLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : favDetail?.places && favDetail.places.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {favDetail.places.map((item) => {
                const place = mapBackendPlaceToPlace(item.place as any);
                return <PlaceCard key={place.id} place={place} />;
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-12 text-center space-y-3">
              <Bookmark className="size-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">Chưa có địa điểm nào được lưu</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bấm vào biểu tượng trái tim trên các địa điểm để lưu lại cho chuyến đi tiếp theo của bạn.
              </p>
              <Link href="/places">
                <Button size="sm" className="rounded-xl font-semibold gap-1.5 text-xs">
                  <Compass className="size-3.5" />
                  <span>Khám phá địa điểm ngay</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Preferences Section for AI Recommendation */}
      {activeTab === "preferences" && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-7 shadow-xs max-w-4xl">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
              <Sparkles className="size-3.5" />
              <span>Hồ sơ sở thích du lịch</span>
            </div>
            <h2 className="text-xl font-bold font-heading text-foreground">
              Cá nhân hóa trải nghiệm & Lịch trình AI
            </h2>
            <p className="text-xs text-muted-foreground">
              TripGenie sử dụng các thông tin này để tự động ưu tiên gợi ý các điểm đến và tạo lịch trình phù hợp nhất với gu của bạn.
            </p>
          </div>

          {/* Budget Level Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Mức ngân sách ưu tiên
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {BUDGET_LEVELS.map((lvl) => {
                const isSelected = selectedBudget === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setSelectedBudget(lvl.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/70 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-xs text-foreground">
                      <span>{lvl.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {lvl.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Travel Styles Chips */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. Phong cách du lịch yêu thích
            </label>
            <div className="flex flex-wrap gap-2">
              {TRAVEL_STYLES.map((style) => {
                const isSelected = selectedStyles.includes(style.id);
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => toggleStyle(style.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Categories Chips */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              3. Thể loại địa điểm quan tâm
            </label>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dietary Restrictions Chips */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              4. Chế độ ăn uống & Kiêng cữ
            </label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_RESTRICTIONS.map((diet) => {
                const isSelected = selectedDietary.includes(diet.id);
                return (
                  <button
                    key={diet.id}
                    type="button"
                    onClick={() => toggleDietary(diet.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{diet.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isPrefLoading ? "Đang tải hồ sơ..." : "Thay đổi sẽ áp dụng ngay cho các lịch trình tạo mới."}
            </p>
            <Button
              onClick={handleSavePreferences}
              disabled={updatePrefMutation.isPending || isPrefLoading}
              className="rounded-xl font-semibold text-xs h-10 px-5 gap-2"
            >
              {updatePrefMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              <span>Lưu sở thích du lịch</span>
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
