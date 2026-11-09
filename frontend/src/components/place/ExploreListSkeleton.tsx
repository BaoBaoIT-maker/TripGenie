import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Geometric skeleton for an individual PlaceCard.
 * Matches PlaceCard's exact dimensions (h-44 sm:h-48 image + card body)
 * to achieve 0 Cumulative Layout Shift (CLS).
 */
export function PlaceCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs animate-pulse",
        className
      )}
    >
      {/* Visual Header / Image Skeleton */}
      <div className="relative h-44 sm:h-48 w-full bg-slate-200">
        {/* Category badge placeholder */}
        <div className="absolute top-3 left-3 h-5 w-20 rounded-md bg-slate-300/80" />
        {/* Bookmark button placeholder */}
        <div className="absolute top-3 right-3 size-9 rounded-full bg-slate-300/80" />
        {/* City & price placeholder */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-slate-300/80" />
          <div className="h-4 w-16 rounded bg-slate-300/80" />
        </div>
      </div>

      {/* Card Body Skeleton */}
      <div className="flex flex-1 flex-col p-4 sm:p-5 justify-between space-y-3">
        <div className="space-y-2">
          {/* Title line */}
          <div className="h-5 w-3/4 rounded-md bg-slate-200" />
          {/* Tagline lines */}
          <div className="space-y-1">
            <div className="h-3.5 w-full rounded bg-slate-100" />
            <div className="h-3.5 w-4/5 rounded bg-slate-100" />
          </div>
        </div>

        {/* Tags placeholders */}
        <div className="flex items-center gap-1.5 pt-1">
          <div className="h-4 w-14 rounded bg-slate-100" />
          <div className="h-4 w-16 rounded bg-slate-100" />
          <div className="h-4 w-12 rounded bg-slate-100" />
        </div>

        {/* Footer info: Rating & Details */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-20 rounded bg-slate-200" />
          </div>
          <div className="h-3.5 w-14 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * Geometric skeleton for the explore places list column.
 * Renders count bar skeleton + 6 matching PlaceCard skeletons + pagination skeleton.
 */
export function ExploreCardListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Results Count & Page Size Bar Skeleton */}
      <div className="flex items-center justify-between pb-1 animate-pulse">
        <div className="h-4 w-36 rounded-md bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-14 rounded bg-slate-100" />
          <div className="h-8.5 w-28 rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Grid of Place Card Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <PlaceCardSkeleton key={i} />
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 animate-pulse">
        <div className="h-8 w-24 rounded-xl bg-slate-200" />
        <div className="h-4 w-20 rounded bg-slate-100" />
        <div className="h-8 w-24 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

/**
 * Geometric skeleton for the map placeholder in split-view.
 */
export function ExploreMapSkeleton() {
  return (
    <div className="h-[calc(100vh-140px)] min-h-[500px] lg:h-full lg:min-h-0 rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 relative flex items-center justify-center animate-pulse">
      {/* Subtle Map Grid lines */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Controls Skeleton Top-Right */}
      <div className="absolute right-3 sm:right-4 top-3 sm:top-4 flex flex-col gap-2">
        <div className="w-10 h-20 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs" />
        <div className="size-10 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs" />
        <div className="w-20 h-24 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs" />
      </div>

      {/* Center Pin Indicator */}
      <div className="relative flex flex-col items-center gap-2 text-slate-400">
        <div className="size-10 rounded-full bg-[#0194F3]/20 flex items-center justify-center text-[#0194F3]">
          <i className="fa-solid fa-location-dot text-lg" />
        </div>
        <span className="text-xs font-semibold text-slate-500">Đang tải bản đồ tương tác...</span>
      </div>
    </div>
  );
}

/**
 * Full Split-View Skeleton (Airbnb Style)
 */
export function ExploreSplitSkeleton() {
  return (
    <div className="relative lg:flex-1 lg:min-h-0">
      <div className="h-full lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:gap-5 items-stretch">
        {/* Left Column Skeletons */}
        <div className="flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:pr-3 scrollbar-thin">
          <ExploreCardListSkeleton count={6} />
        </div>

        {/* Right Column Map Skeleton */}
        <div className="hidden lg:block h-full">
          <ExploreMapSkeleton />
        </div>
      </div>
    </div>
  );
}
