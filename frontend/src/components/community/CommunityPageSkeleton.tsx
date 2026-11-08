import React from "react";

export function CommunityFeedCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
      {/* Author Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3.5 w-36 rounded-md bg-slate-200" />
            <div className="h-3 w-28 rounded-md bg-slate-100" />
          </div>
        </div>
        <div className="size-6 rounded-full bg-slate-100" />
      </div>

      {/* Title & Caption Skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-4/5 rounded-md bg-slate-200" />
        <div className="h-3.5 w-full rounded-md bg-slate-100" />
        <div className="h-3.5 w-2/3 rounded-md bg-slate-100" />
      </div>

      {/* Tags Skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded-md bg-[#F0F7FF]" />
        <div className="h-5 w-20 rounded-md bg-[#F0F7FF]" />
        <div className="h-5 w-14 rounded-md bg-slate-100" />
      </div>

      {/* Media Collage Skeleton */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-2 h-[260px] rounded-[16px] overflow-hidden">
        <div className="h-full w-full bg-slate-200" />
        <div className="grid grid-rows-2 gap-2 h-full">
          <div className="h-full w-full bg-slate-200" />
          <div className="h-full w-full bg-slate-200" />
        </div>
      </div>

      {/* Itinerary Strip Skeleton */}
      <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
        <div className="flex items-center gap-3 flex-1">
          <div className="size-11 rounded-[12px] bg-slate-200 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-2.5 w-36 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-9 w-36 rounded-[10px] bg-slate-200 shrink-0" />
      </div>

      {/* Footer Skeleton */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-5 w-14 rounded bg-slate-100" />
          <div className="h-5 w-24 rounded bg-slate-100" />
          <div className="h-6 w-28 rounded-full bg-[#F0F7FF]" />
        </div>
        <div className="h-5 w-16 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function CommunityPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải không gian cộng đồng TripGenie..."
      className="w-full bg-[#F8FAFC] lg:h-[calc(100vh-70px)] lg:overflow-hidden"
    >
      <div className="max-w-[1320px] mx-auto px-4 pt-4 pb-12 lg:pb-0 lg:h-full">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_310px] gap-6 lg:h-full items-start lg:items-stretch">
          {/* Left Sidebar Skeleton */}
          <aside className="hidden lg:flex flex-col gap-5 h-full overflow-hidden pr-1">
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-36 rounded bg-slate-200" />
                <div className="h-3 w-12 rounded bg-slate-100" />
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-[14px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-[42px] rounded-[12px] bg-slate-200 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-28 rounded bg-slate-200" />
                        <div className="h-2.5 w-24 rounded bg-slate-100" />
                      </div>
                    </div>
                    <div className="h-3 w-5 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-44 w-full rounded-[12px] bg-slate-200" />
            </div>
          </aside>

          {/* Center Main Feed Skeleton */}
          <section className="flex flex-col gap-5 lg:h-full lg:overflow-hidden">
            {/* Quick Composer Skeleton */}
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 sm:px-5 shadow-[0_2px_6px_rgba(0,0,0,0.02)] animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-200 shrink-0" />
                <div className="h-11 flex-1 rounded-[14px] bg-slate-100" />
              </div>
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-16 rounded-[10px] bg-slate-100" />
                  <div className="h-8 w-24 rounded-[10px] bg-slate-100" />
                  <div className="h-8 w-24 rounded-[10px] bg-slate-100" />
                </div>
                <div className="h-9 w-28 rounded-full bg-slate-200" />
              </div>
            </div>

            {/* Sort & Search Toolbar Skeleton */}
            <div className="flex items-center justify-between gap-3 bg-white p-2 px-3 rounded-[16px] border border-[#E2E8F0] animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-9 w-24 rounded-[10px] bg-slate-200" />
                <div className="h-9 w-24 rounded-[10px] bg-slate-100" />
                <div className="h-9 w-36 rounded-[10px] bg-slate-100" />
              </div>
              <div className="h-9 w-[220px] rounded-[10px] bg-slate-100" />
            </div>

            {/* Post Card Skeletons */}
            <div className="space-y-6">
              <CommunityFeedCardSkeleton />
              <CommunityFeedCardSkeleton />
            </div>
          </section>

          {/* Right Sidebar Skeleton */}
          <aside className="hidden lg:flex flex-col gap-5 h-full overflow-hidden pr-1">
            {/* Top Cloned Skeleton */}
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
              <div className="h-3.5 w-32 rounded bg-slate-200" />
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-[14px] border border-[#E2E8F0] space-y-2"
                >
                  <div className="flex justify-between">
                    <div className="h-3 w-24 rounded bg-slate-100" />
                    <div className="h-3 w-12 rounded bg-slate-100" />
                  </div>
                  <div className="h-4 w-full rounded bg-slate-200" />
                  <div className="flex justify-between pt-1">
                    <div className="h-3 w-24 rounded bg-slate-100" />
                    <div className="h-3 w-16 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>

            {/* Stories 9:16 Skeleton */}
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
              <div className="flex justify-between">
                <div className="h-3.5 w-32 rounded bg-slate-200" />
                <div className="h-3.5 w-14 rounded bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-[180px] rounded-[14px] bg-slate-200" />
                <div className="h-[180px] rounded-[14px] bg-slate-200" />
              </div>
            </div>

            {/* Top Creators Skeleton */}
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] animate-pulse">
              <div className="flex justify-between">
                <div className="h-3.5 w-28 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-100" />
              </div>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-slate-200" />
                      <div className="h-2.5 w-28 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-7 w-20 rounded-[10px] bg-slate-100" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      <span className="sr-only">Đang tải bài viết và lộ trình cộng đồng...</span>
    </div>
  );
}
