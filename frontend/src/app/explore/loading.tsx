import * as React from "react";
import { ExploreSplitSkeleton } from "@/components/place/ExploreListSkeleton";

/**
 * Next.js streaming loading UI for /explore route.
 * Renders full geometric skeleton matching the Explore page layout with 0 CLS.
 */
export default function ExploreLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-3 gap-3 overflow-hidden font-sans">
      {/* Header Search & Toolbar Skeleton */}
      <div className="shrink-0 flex items-center justify-between gap-3 animate-pulse">
        {/* Search input placeholder */}
        <div className="h-11 flex-1 max-w-xl rounded-full bg-slate-200" />

        {/* Toolbar actions placeholder */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="h-10 w-24 rounded-xl bg-slate-200" />
          <div className="h-10 w-28 rounded-xl bg-slate-200" />
          <div className="h-10 w-36 rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Super Categories Bar Skeleton */}
      <div className="shrink-0 flex items-center gap-2 overflow-hidden py-0.5 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-28 shrink-0 rounded-full bg-slate-200"
          />
        ))}
      </div>

      {/* Split-View Skeleton (Airbnb Style) */}
      <ExploreSplitSkeleton />
    </div>
  );
}
