"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface HeroSearchBarProps {
  onDestinationChange?: (locationName: string) => void;
}

interface SuggestionItem {
  label: string;
  query: string;
  locationTitle: string;
}

const POPULAR_SUGGESTIONS: SuggestionItem[] = [
  {
    label: "Hạ Long",
    query: "Hạ Long",
    locationTitle: "Vịnh Hạ Long, Quảng Ninh",
  },
  {
    label: "Đà Nẵng",
    query: "Đà Nẵng",
    locationTitle: "Bán đảo Sơn Trà & Biển Mỹ Khê, Đà Nẵng",
  },
  {
    label: "Phố cổ Hội An",
    query: "Hội An",
    locationTitle: "Phố cổ Hội An, Quảng Nam",
  },
  {
    label: "Hà Nội 36 phố",
    query: "Hà Nội",
    locationTitle: "Hồ Gươm & Phố Cổ 36 Phố, Hà Nội",
  },
  {
    label: "Đà Lạt",
    query: "Đà Lạt",
    locationTitle: "Hồ Tuyền Lâm & Rừng Thông, Đà Lạt",
  },
  {
    label: "Phú Quốc",
    query: "Phú Quốc",
    locationTitle: "Bãi Sao & Hòn Thơm, Phú Quốc",
  },
  {
    label: "Sa Pa mây ngàn",
    query: "Sa Pa",
    locationTitle: "Đèo Ô Quy Hồ & Bản Tả Van, Sa Pa",
  },
];

export function HeroSearchBar({ onDestinationChange }: HeroSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const executeSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/explore?keyword=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/explore");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (item: SuggestionItem) => {
    setQuery(item.query);
    if (onDestinationChange) {
      onDestinationChange(item.locationTitle);
    }
    executeSearch(item.query);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3.5 text-left">
      {/* Google-inspired Translucent Search Capsule Bar */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-full bg-white/80 hover:bg-white/90 focus-within:bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/25 transition-all focus-within:ring-4 focus-within:ring-sky-400/25 focus-within:border-white/80"
      >
        {/* Left Search Icon */}
        <div className="pl-3 sm:pl-4 text-slate-500 shrink-0 flex items-center pointer-events-none">
          <Search className="size-5 transition-colors group-focus-within:text-[#0194F3]" />
        </div>

        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm điểm đến, món ngon, quán cafe..."
          className="flex-1 min-w-0 bg-transparent py-2 sm:py-3 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-500/90 focus:outline-hidden"
          aria-label="Tìm kiếm điểm đến du lịch"
        />

        {/* Clear Button (appears when query is non-empty) */}
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 sm:p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer shrink-0"
            aria-label="Xóa tìm kiếm"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Primary Search Submit Button - Responsive Icon on Mobile, Expanded on Tablet+ */}
        <button
          type="submit"
          className="size-10 sm:h-11 sm:w-auto sm:px-6 rounded-full bg-[#0194F3] hover:bg-[#0073D1] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 shrink-0 cursor-pointer"
          title="Khám phá ngay"
        >
          <Search className="size-4.5 sm:size-4" />
          <span className="hidden sm:inline">Khám phá</span>
        </button>
      </form>

      {/* Suggestion Pills: Translucent, Clean, Responsive Touch Scroll on Mobile */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center text-xs">
        <span className="text-white/80 font-bold text-[11px] uppercase tracking-wider drop-shadow-xs shrink-0">
          Gợi ý hot:
        </span>
        {POPULAR_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleSuggestionClick(s)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md border border-white/25 hover:border-white/50 text-white text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-2xs drop-shadow-xs shrink-0 whitespace-nowrap"
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
