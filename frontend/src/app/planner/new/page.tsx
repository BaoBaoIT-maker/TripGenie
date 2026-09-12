"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  PenTool,
  ArrowLeft,
  ImageIcon,
  Compass,
  Car,
  Clock,
  HeartHandshake,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/common/LoadingState";
import { toast } from "sonner";
import { AiPlannerInput } from "@/types/planner";
import { plannerService } from "@/services/planner.service";
import { ManualPlannerForm } from "@/features/planner/components/ManualPlannerForm";

const SAMPLE_COVERS = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&auto=format&fit=crop&q=80",
];

function NewPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "manual" ? "manual" : "ai";
  const [currentMode, setCurrentMode] = useState<"ai" | "manual">(initialMode);
  const isAiMode = currentMode === "ai";

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Left column state (General Info)
  const [title, setTitle] = useState(isAiMode ? "Du lịch Sài Gòn" : "Khám phá ẩm thực Sài Gòn cuối tuần");
  const [description, setDescription] = useState(
    isAiMode
      ? "Cùng bạn bè du lịch sài gòn. Khám phá các góc cafe chill và thưởng thức ẩm thực đường phố."
      : "Lên danh sách các quán ăn ngon và điểm check-in view đẹp ở trung tâm TP.HCM."
  );
  const [startDate, setStartDate] = useState("2026-11-01");
  const [endDate, setEndDate] = useState("2026-11-03");
  const [coverImage, setCoverImage] = useState(SAMPLE_COVERS[3]);

  // Right column state (AI / Detail Brief)
  const [people, setPeople] = useState("2");
  const [budget, setBudget] = useState("3.000.000");
  const [destination, setDestination] = useState("Thành phố Hồ Chí Minh");
  const [wishlistPlaces, setWishlistPlaces] = useState("Tiệm cafe view đẹp, chợ đêm, bãi biển...");
  const [interests, setInterests] = useState("cafe, ăn uống, chill");
  const [tripStyle, setTripStyle] = useState("Cân bằng");
  const [pace, setPace] = useState("Linh hoạt");
  const [companion, setCompanion] = useState("Cặp đôi");
  const [transport, setTransport] = useState("Ô tô");
  const [extraNotes, setExtraNotes] = useState("Ưu tiên điểm gần nhau, có chỗ đậu xe...");

  const switchMode = (newMode: "ai" | "manual") => {
    setCurrentMode(newMode);
    window.history.replaceState(null, "", `/planner/new?mode=${newMode}`);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !destination.trim()) {
      toast.error("Vui lòng nhập tên chuyến đi và địa điểm!");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      toast.error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu!");
      return;
    }

    const aiInput: AiPlannerInput = {
      title: title.trim(),
      description: description.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      budget: parseInt(budget.replace(/\D/g, ""), 10) || 3000000,
      people: parseInt(people, 10) || 2,
      interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
      wishlistPlaces: wishlistPlaces.split(/,|→/).map((s) => s.trim()).filter(Boolean),
      tripStyle: isAiMode ? tripStyle : "Tự thiết kế",
      pace,
      companion,
      transport,
      extraNotes,
      coverImage,
    };

    setIsSubmitting(true);
    try {
      const generated = await plannerService.generateAiPlanner(aiInput);
      const created = await plannerService.createPlanner(generated);

      toast.success(
        isAiMode
          ? "✨ AI đã khởi tạo lịch trình tối ưu! Đang mở bảng chỉnh sửa..."
          : "Đã tạo lịch trình thành công! Đang mở bảng chỉnh sửa..."
      );

      router.push(`/planner/${created.id}/edit`);
    } catch {
      toast.error("Không thể tạo lịch trình, vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-20">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <Link
          href="/planner"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Quay lại</span>
        </Link>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1 border border-border/80 w-fit">
          <button
            type="button"
            onClick={() => switchMode("ai")}
            aria-pressed={isAiMode}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              isAiMode
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Tạo bằng AI</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode("manual")}
            aria-pressed={!isAiMode}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              !isAiMode
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="size-3.5" />
            <span>Tự thiết kế</span>
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
          {isAiMode ? "Thông tin chuyến đi" : "Tạo chuyến đi thủ công"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isAiMode
            ? "Nhập thông tin cơ bản cho chuyến đi của bạn."
            : "Khởi tạo chuyến đi trước, sau đó tự thêm và sắp xếp địa điểm theo ý bạn."}
        </p>
      </div>

      {/* 2 Columns Form Layout (Matching Screenshot 1) */}
      {isAiMode && (
        <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─────────────────────────────────────────────────────────────
            LEFT COLUMN (Col 1-7): THÔNG TIN CHUYẾN ĐI & ẢNH BÌA
        ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Cover Image Upload / Selection Card */}
          <div className="space-y-2">
            <div className="relative aspect-[16/8] sm:aspect-[16/7] w-full overflow-hidden rounded-3xl border-2 border-dashed border-border/80 bg-muted/30 group">
              {coverImage ? (
                <>
                  <Image
                    src={coverImage}
                    alt="Cover preview"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 transition-opacity group-hover:bg-black/40" />
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = (SAMPLE_COVERS.indexOf(coverImage) + 1) % SAMPLE_COVERS.length;
                        setCoverImage(SAMPLE_COVERS[nextIdx]);
                        toast.info("Đã đổi ảnh bìa mẫu khác!");
                      }}
                      className="rounded-xl bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-md backdrop-blur-md hover:bg-background transition-colors flex items-center gap-1.5"
                    >
                      <ImageIcon className="size-3.5 text-primary" />
                      <span>Đổi ảnh bìa</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-muted shadow-xs">
                    <ImageIcon className="size-7 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">
                      Chọn ảnh bìa cho chuyến đi
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG hoặc chọn từ kho ảnh du lịch
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Tên chuyến đi
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên chuyến đi của bạn..."
              className="h-13 text-base sm:text-lg font-bold rounded-2xl bg-card border-border/80 px-4 focus-visible:ring-primary"
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Mô tả ngắn gọn
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Viết mô tả ngắn gọn về chuyến đi này..."
              className="w-full rounded-2xl border border-border/80 bg-card p-4 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary/20 placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Date Picker Box */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 shadow-2xs">
                <Calendar className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ngày đi
                </h4>
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Chọn khoảng ngày cho chuyến đi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 text-xs rounded-xl w-36 bg-muted/40 font-medium"
              />
              <span className="text-muted-foreground text-xs font-bold">→</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 text-xs rounded-xl w-36 bg-muted/40 font-medium"
              />
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT COLUMN (Col 8-12): THÔNG TIN CHO AI / THIẾT LẬP
        ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 rounded-3xl border border-border/80 bg-card p-6 sm:p-7 space-y-5 shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 shadow-2xs">
                <Sparkles className="size-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isAiMode ? "Thông tin cho AI" : "Thiết lập chi tiết"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Càng rõ, gợi ý càng sát
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Row 1: Số người & Chi phí */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="size-3.5 text-primary" /> Số người:
                </label>
                <Input
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  placeholder="2"
                  className="h-10 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="size-3.5 text-emerald-600" /> Chi phí ước tính:
                </label>
                <Input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="3,000,000"
                  className="h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            {/* Row 2: Địa điểm muốn tới */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3.5 text-primary" /> Địa điểm muốn tới:
              </label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Đà Lạt, Vũng Tàu, Đà Nẵng, TP.HCM..."
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>

            {/* Row 3: Điểm muốn ghé / Danh sách địa điểm */}
            <div className="space-y-2">
              <label className="font-semibold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Compass className="size-3.5 text-primary" /> {isAiMode ? "Điểm muốn ghé:" : "Danh sách địa điểm dự kiến:"}
                </span>
                {!isAiMode && (
                  <span className="text-[10px] text-primary font-bold">Tự thêm thủ công</span>
                )}
              </label>

              <div className="flex gap-2">
                <Input
                  value={wishlistPlaces}
                  onChange={(e) => setWishlistPlaces(e.target.value)}
                  placeholder={isAiMode ? "Tiệm cafe view đẹp, chợ đêm, bãi biển..." : "Nhập tên quán / địa chỉ muốn đến..."}
                  className="h-10 rounded-xl text-xs flex-1"
                />
              </div>

              {/* Quick suggestions chips for adding places */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-muted-foreground text-[10px]">Gợi ý thêm:</span>
                {["Lacàph Bến Thành", "The Deck Saigon", "Chợ Bến Thành", "Thảo Cầm Viên", "Túi Mơ To"].map((place) => (
                  <button
                    key={place}
                    type="button"
                    onClick={() => {
                      if (wishlistPlaces.trim()) {
                        setWishlistPlaces(wishlistPlaces + " → " + place);
                      } else {
                        setWishlistPlaces(place);
                      }
                      toast.info(`Đã thêm "${place}" vào danh sách!`);
                    }}
                    className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    +{place}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Sở thích */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">
                Sở thích & Phong cách:
              </label>
              <Input
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="cafe, ăn uống, chill, chụp ảnh..."
                className="h-10 rounded-xl text-xs font-medium"
              />
            </div>

            {/* Row 5: Kiểu chuyến đi & Nhịp độ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">
                  Kiểu chuyến đi:
                </label>
                <div className="relative">
                  <select
                    value={tripStyle}
                    onChange={(e) => setTripStyle(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-primary appearance-none font-medium pr-8"
                  >
                    <option value="Cân bằng">Cân bằng</option>
                    <option value="Nghỉ dưỡng">Nghỉ dưỡng</option>
                    <option value="Khám phá">Khám phá</option>
                    <option value="Ẩm thực">Ẩm thực</option>
                    <option value="Chữa lành">Chữa lành</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3 text-primary" /> Nhịp độ:
                </label>
                <div className="relative">
                  <select
                    value={pace}
                    onChange={(e) => setPace(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-primary appearance-none font-medium pr-8"
                  >
                    <option value="Linh hoạt">Linh hoạt</option>
                    <option value="Thong thả">Thong thả</option>
                    <option value="Năng động">Năng động</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 6: Đi cùng ai & Phương tiện */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  <HeartHandshake className="size-3 text-rose-500" /> Đi cùng ai:
                </label>
                <div className="relative">
                  <select
                    value={companion}
                    onChange={(e) => setCompanion(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-primary appearance-none font-medium pr-8"
                  >
                    <option value="Cặp đôi">Cặp đôi</option>
                    <option value="Gia đình">Gia đình</option>
                    <option value="Bạn bè">Bạn bè</option>
                    <option value="Một mình">Một mình</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  <Car className="size-3 text-primary" /> Phương tiện:
                </label>
                <div className="relative">
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-primary appearance-none font-medium pr-8"
                  >
                    <option value="Ô tô">Ô tô</option>
                    <option value="Xe máy">Xe máy</option>
                    <option value="Máy bay">Máy bay</option>
                    <option value="Tàu hỏa">Tàu hỏa</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 7: Yêu cầu thêm */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">
                Yêu cầu thêm:
              </label>
              <Input
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder="Ưu tiên điểm gần nhau, có chỗ đậu xe..."
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl font-bold gap-2 text-sm bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              {isAiMode ? (
                <>
                  <Sparkles className="size-4" />
                  <span>{isSubmitting ? "Đang tạo lịch trình..." : "Tạo lịch trình với AI"}</span>
                </>
              ) : (
                <>
                  <PenTool className="size-4" />
                  <span>{isSubmitting ? "Đang tạo lịch trình..." : "Tạo lịch trình"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      )}
      {!isAiMode && <ManualPlannerForm coverOptions={SAMPLE_COVERS} />}
    </div>
  );
}

export default function NewPlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
          <LoadingState message="Đang tải mẫu lịch trình..." />
        </div>
      }
    >
      <NewPlannerContent />
    </Suspense>
  );
}
