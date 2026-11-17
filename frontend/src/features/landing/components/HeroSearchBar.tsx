"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface HeroSearchBarProps {
  onDestinationChange?: (locationName: string) => void;
}

export function HeroSearchBar({ onDestinationChange }: HeroSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const executeSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (onDestinationChange) {
        onDestinationChange(trimmed);
      }
      router.push(`/explore?keyword=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/explore");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="w-full max-w-3xl mx-auto text-left">
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
    </div>
  );
}
