"use client";

import { useState, useEffect } from "react";
import { ADMIN_UI_CONSTANTS } from "../admin.constants";

interface AdminDebouncedSearchProps {
  placeholder?: string;
  initialValue?: string;
  onSearchChange: (debouncedValue: string) => void;
  className?: string;
}

export function AdminDebouncedSearch({
  placeholder = "Tìm kiếm...",
  initialValue = "",
  onSearchChange,
  className = "w-full sm:w-72",
}: AdminDebouncedSearchProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(value.trim());
    }, ADMIN_UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, onSearchChange]);

  return (
    <div className={`relative ${className}`}>
      <i
        className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-9 pr-8 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-[#10243A] placeholder:text-slate-400 focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            onSearchChange("");
          }}
          aria-label="Xóa từ khóa tìm kiếm"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
