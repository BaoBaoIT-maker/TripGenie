"use client";

import { Map as MapIcon, List as ListIcon } from "lucide-react";

export interface MapMobileViewToggleProps {
  currentView: "list" | "map";
  onToggle: () => void;
}

export function MapMobileViewToggle({
  currentView,
  onToggle,
}: MapMobileViewToggleProps) {
  const isList = currentView === "list";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xl transition-all hover:bg-primary/90 active:scale-95"
      >
        {isList ? (
          <>
            <MapIcon className="size-4" />
            <span>Xem bản đồ 🗺️</span>
          </>
        ) : (
          <>
            <ListIcon className="size-4" />
            <span>Xem danh sách 📋</span>
          </>
        )}
      </button>
    </div>
  );
}
