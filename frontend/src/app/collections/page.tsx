"use client";

import { useState } from "react";
import { Heart, Coffee, Utensils, Plus, FolderHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceCard } from "@/components/place/PlaceCard";
import { MOCK_PLACES } from "@/mocks/data/places";
import { toast } from "sonner";

export default function CollectionsPage() {
  const [activeCollection, setActiveCollection] = useState("favorites");

  const collections = [
    { id: "favorites", name: "❤️ Yêu thích", count: 4, icon: Heart },
    { id: "cafe", name: "☕ Quán cafe", count: 2, icon: Coffee },
    { id: "food", name: "🍜 Quán ăn ngon", count: 2, icon: Utensils },
    { id: "date", name: "💑 Điểm hẹn hò", count: 2, icon: FolderHeart },
  ];

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
            Địa điểm đã lưu
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Danh sách các địa điểm bạn đã lưu lại cho chuyến đi tới.
          </p>
        </div>

        <Button
          onClick={() => toast.success("Đã mở hộp thoại tạo bộ sưu tập mới!")}
          variant="outline"
          className="h-10 px-4 rounded-xl font-semibold gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Plus className="size-4" />
          <span>Tạo bộ sưu tập</span>
        </Button>
      </div>

      {/* Collection Categories Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {collections.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => setActiveCollection(col.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
              activeCollection === col.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{col.name}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeCollection === col.id
                  ? "bg-white/20 text-white"
                  : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {col.count}
            </span>
          </button>
        ))}
      </div>

      {/* Saved Places Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MOCK_PLACES.slice(0, 4).map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </div>
  );
}
