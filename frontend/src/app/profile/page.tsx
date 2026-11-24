"use client";

import { useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  LogIn,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AccountSecuritySection } from "@/features/auth/components/AccountSecuritySection";
import {
  useUserPreferences,
  useUpdateUserPreferences,
} from "@/features/preferences/hooks/use-user-preferences";
import { BudgetLevel } from "@/services/user-preference.service";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { AvatarPickerModal } from "@/features/auth/components/AvatarPickerModal";
import { useI18n } from "@/i18n";

const DEFAULT_TRAVEL_STYLE_IDS = [
  "CULTURE",
  "FOOD",
  "CHILL",
  "NATURE",
  "ADVENTURE",
  "CHECKIN",
  "HEALING",
  "BUDGET",
] as const;

const DEFAULT_PREFERRED_CATEGORY_IDS = [
  "am-thuc",
  "cafe",
  "diem-tham-quan",
  "lich-su",
  "mua-sam",
  "giai-tri",
] as const;

const DEFAULT_DIETARY_RESTRICTION_IDS = [
  "VEGETARIAN",
  "HALAL",
  "NO_SEAFOOD",
  "NO_SPICY",
] as const;

const BUDGET_LEVEL_IDS: readonly BudgetLevel[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "LUXURY",
];

function ProfileContent() {
  const { t } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const userInitials = useMemo(() => {
    if (!user?.fullName) return "TG";
    return user.fullName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user?.fullName]);

  const [activeTab, setActiveTab] = useState<"account" | "preferences">(() => {
    return tabParam === "preferences" ? "preferences" : "account";
  });
  const [prevTabParam, setPrevTabParam] = useState(tabParam);
  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    if (tabParam === "preferences") setActiveTab("preferences");
    else if (tabParam === "account") setActiveTab("account");
  }

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

  const [syncedUserPref, setSyncedUserPref] = useState(userPref);
  if (userPref && userPref !== syncedUserPref) {
    setSyncedUserPref(userPref);
    setSelectedBudget(userPref.budgetLevel || "MEDIUM");
    setSelectedStyles(userPref.travelStyle || []);
    setSelectedCategories(userPref.preferredCategories || []);
    setSelectedDietary(userPref.dietaryRestrictions || []);
  }

  // Input state for custom user-defined preferences
  const [customStyleInput, setCustomStyleInput] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [customDietaryInput, setCustomDietaryInput] = useState("");

  const toggleStyle = (value: string) => {
    setSelectedStyles((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const handleAddCustomStyle = () => {
    const trimmed = customStyleInput.trim();
    if (!trimmed) return;
    if (!selectedStyles.includes(trimmed)) {
      setSelectedStyles((prev) => [...prev, trimmed]);
    }
    setCustomStyleInput("");
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
    setCustomCategoryInput("");
  };

  const toggleDietary = (value: string) => {
    setSelectedDietary((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const handleAddCustomDietary = () => {
    const trimmed = customDietaryInput.trim();
    if (!trimmed) return;
    if (!selectedDietary.includes(trimmed)) {
      setSelectedDietary((prev) => [...prev, trimmed]);
    }
    setCustomDietaryInput("");
  };

  const handleSavePreferences = async () => {
    try {
      await updatePrefMutation.mutateAsync({
        budgetLevel: selectedBudget,
        travelStyle: selectedStyles,
        preferredCategories: selectedCategories,
        dietaryRestrictions: selectedDietary,
      });
      toast.success(t("profile.preferences.saveSuccess"));
    } catch {
      toast.error(t("profile.preferences.saveError"));
    }
  };

  if (!isAuthLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-16 text-center space-y-5">
        <div className="rounded-3xl border border-border bg-card p-10 space-y-4 shadow-xs">
          <i className="fa-regular fa-circle-user text-5xl text-primary mx-auto block text-center" aria-hidden="true" />
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {t("profile.guestTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {t("profile.guestDescription")}
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button className="rounded-xl font-semibold gap-2 px-6">
                <LogIn className="size-4" />
                <span>{t("profile.signInNow")}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Set of predefined IDs for badge recognition
  const predefinedStyleIds = new Set<string>(DEFAULT_TRAVEL_STYLE_IDS);
  const predefinedCategoryIds = new Set<string>(DEFAULT_PREFERRED_CATEGORY_IDS);
  const predefinedDietaryIds = new Set<string>(DEFAULT_DIETARY_RESTRICTION_IDS);

  return (
    <div className="max-w-[1200px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-16">
      {/* Profile Header (Clean & Minimalist Hero) */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 flex items-center gap-6 shadow-xs">
        <button
          type="button"
          onClick={() => setIsAvatarModalOpen(true)}
          className="group relative shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title={t("profile.changeAvatarTooltip")}
          aria-label={t("profile.changeAvatarAria")}
        >
          <Avatar className="size-20 sm:size-24 border-2 border-primary/20 shadow-sm group-hover:border-primary transition-colors">
            <AvatarImage
              src={user?.avatarUrl || DEFAULT_AVATAR}
              alt={user?.fullName || t("profile.avatarAlt")}
            />
            <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground tracking-tight truncate">
              {user?.fullName || t("profile.fallbackName")}
            </h1>
            {Boolean(user?.isVerifiedCreator || user?.role === "ADMIN") && (
              <span
                title={user?.role === "ADMIN" ? t("profile.adminBadgeTitle") : t("profile.verifiedCreatorTitle")}
                aria-label={t("profile.verifiedAria")}
                className="text-brand-blue text-[20px] inline-flex items-center shrink-0"
              >
                <i className="fa-solid fa-circle-check" aria-hidden="true" />
              </span>
            )}
          </div>
          {user?.bio && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 max-w-xl">
              {user.bio}
            </p>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Only 2 Core Tabs) */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
            activeTab === "account"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <i className="fa-regular fa-id-badge text-base" aria-hidden="true" />
          <span>{t("profile.tabs.account")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] cursor-pointer ${
            activeTab === "preferences"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          <i className="fa-solid fa-sliders text-sm" aria-hidden="true" />
          <span>{t("profile.tabs.preferences")}</span>
        </button>
      </div>

      {/* Tab 1: Account & Security */}
      {activeTab === "account" && (
        <AccountSecuritySection onOpenAvatarModal={() => setIsAvatarModalOpen(true)} />
      )}

      {/* Tab 2: Travel Preferences (With Custom Input & Quick Chips) */}
      {activeTab === "preferences" && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-8 shadow-xs max-w-4xl">
          <div className="space-y-1 border-b border-border pb-4">
            <h2 className="text-xl font-bold font-heading text-foreground">
              {t("profile.preferences.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("profile.preferences.subtitle")}
            </p>
          </div>

          {/* 1. Budget Level Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("profile.preferences.budgetHeading")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {BUDGET_LEVEL_IDS.map((budgetId) => {
                const isSelected = selectedBudget === budgetId;
                return (
                  <button
                    key={budgetId}
                    type="button"
                    onClick={() => setSelectedBudget(budgetId)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/70 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-xs text-foreground">
                      <span>{t(`profile.preferences.budgets.${budgetId}.label`)}</span>
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {t(`profile.preferences.budgets.${budgetId}.desc`)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Travel Styles Chips & Custom Input */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("profile.preferences.stylesHeading")}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t("profile.preferences.stylesHint")}
              </span>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TRAVEL_STYLE_IDS.map((styleId) => {
                const isSelected = selectedStyles.includes(styleId);
                return (
                  <button
                    key={styleId}
                    type="button"
                    onClick={() => toggleStyle(styleId)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{t(`profile.preferences.travelStyles.${styleId}`)}</span>
                  </button>
                );
              })}

              {/* Custom User-Added Style Chips */}
              {selectedStyles
                .filter((s) => !predefinedStyleIds.has(s))
                .map((customStyle) => (
                  <span
                    key={customStyle}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold bg-primary text-primary-foreground shadow-xs min-h-[40px]"
                  >
                    <span>{customStyle}</span>
                    <button
                      type="button"
                      onClick={() => toggleStyle(customStyle)}
                      className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={t("profile.preferences.removeStyleTitle")}
                      aria-label={t("profile.preferences.removeAria", { item: customStyle })}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>

            {/* Inline Custom Input */}
            <div className="flex items-center gap-2 max-w-md pt-1">
              <Input
                type="text"
                placeholder={t("profile.preferences.customStylePlaceholder")}
                value={customStyleInput}
                onChange={(e) => setCustomStyleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomStyle();
                  }
                }}
                className="h-10 rounded-xl text-xs bg-background border-border/80"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomStyle}
                disabled={!customStyleInput.trim()}
                className="rounded-xl h-10 px-3.5 text-xs font-semibold shrink-0 cursor-pointer gap-1"
              >
                <Plus className="size-3.5" />
                <span>{t("profile.preferences.addButton")}</span>
              </Button>
            </div>
          </div>

          {/* 3. Preferred Categories Chips & Custom Input */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("profile.preferences.categoriesHeading")}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t("profile.preferences.categoriesHint")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_PREFERRED_CATEGORY_IDS.map((catId) => {
                const isSelected = selectedCategories.includes(catId);
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => toggleCategory(catId)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{t(`profile.preferences.categories.${catId}`)}</span>
                  </button>
                );
              })}

              {/* Custom User-Added Category Chips */}
              {selectedCategories
                .filter((c) => !predefinedCategoryIds.has(c))
                .map((customCat) => (
                  <span
                    key={customCat}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold bg-primary text-primary-foreground shadow-xs min-h-[40px]"
                  >
                    <span>{customCat}</span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(customCat)}
                      className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={t("profile.preferences.removeCategoryTitle")}
                      aria-label={t("profile.preferences.removeAria", { item: customCat })}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>

            {/* Inline Custom Input */}
            <div className="flex items-center gap-2 max-w-md pt-1">
              <Input
                type="text"
                placeholder={t("profile.preferences.customCategoryPlaceholder")}
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomCategory();
                  }
                }}
                className="h-10 rounded-xl text-xs bg-background border-border/80"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomCategory}
                disabled={!customCategoryInput.trim()}
                className="rounded-xl h-10 px-3.5 text-xs font-semibold shrink-0 cursor-pointer gap-1"
              >
                <Plus className="size-3.5" />
                <span>{t("profile.preferences.addButton")}</span>
              </Button>
            </div>
          </div>

          {/* 4. Dietary Restrictions Chips & Custom Input */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("profile.preferences.dietaryHeading")}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t("profile.preferences.dietaryHint")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_DIETARY_RESTRICTION_IDS.map((dietId) => {
                const isSelected = selectedDietary.includes(dietId);
                return (
                  <button
                    key={dietId}
                    type="button"
                    onClick={() => toggleDietary(dietId)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{t(`profile.preferences.dietary.${dietId}`)}</span>
                  </button>
                );
              })}

              {/* Custom User-Added Dietary Chips */}
              {selectedDietary
                .filter((d) => !predefinedDietaryIds.has(d))
                .map((customDiet) => (
                  <span
                    key={customDiet}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold bg-primary text-primary-foreground shadow-xs min-h-[40px]"
                  >
                    <span>{customDiet}</span>
                    <button
                      type="button"
                      onClick={() => toggleDietary(customDiet)}
                      className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={t("profile.preferences.removeDietaryTitle")}
                      aria-label={t("profile.preferences.removeAria", { item: customDiet })}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>

            {/* Inline Custom Input */}
            <div className="flex items-center gap-2 max-w-md pt-1">
              <Input
                type="text"
                placeholder={t("profile.preferences.customDietaryPlaceholder")}
                value={customDietaryInput}
                onChange={(e) => setCustomDietaryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomDietary();
                  }
                }}
                className="h-10 rounded-xl text-xs bg-background border-border/80"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomDietary}
                disabled={!customDietaryInput.trim()}
                className="rounded-xl h-10 px-3.5 text-xs font-semibold shrink-0 cursor-pointer gap-1"
              >
                <Plus className="size-3.5" />
                <span>{t("profile.preferences.addButton")}</span>
              </Button>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {isPrefLoading ? t("profile.preferences.loadingProfile") : t("profile.preferences.applyHint")}
            </p>
            <Button
              onClick={handleSavePreferences}
              disabled={updatePrefMutation.isPending || isPrefLoading}
              className="rounded-xl font-semibold text-xs h-10 px-6 gap-2 cursor-pointer self-start sm:self-auto shadow-xs"
            >
              {updatePrefMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              <span>{t("profile.preferences.saveButton")}</span>
            </Button>
          </div>
        </div>
      )}

      <AvatarPickerModal
        open={isAvatarModalOpen}
        onOpenChange={setIsAvatarModalOpen}
        currentAvatarUrl={user?.avatarUrl}
        userFullName={user?.fullName}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-44 rounded-3xl bg-muted/40 animate-pulse border border-border" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
