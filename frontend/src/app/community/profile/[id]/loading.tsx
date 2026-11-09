export default function CreatorProfileLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans flex flex-col">
      {/* Top Navigation Skeleton */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="h-5 w-40 rounded-[6px] bg-slate-200 animate-pulse" />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[960px] mx-auto w-full px-4 sm:px-6 py-6 pb-20 flex-1">
        {/* Profile Header Skeleton Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 sm:p-8 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col items-center max-w-[600px] mx-auto">
            {/* Avatar Skeleton (100px rounded full) */}
            <div className="size-[100px] rounded-full bg-slate-200 animate-pulse mb-3.5" />

            {/* Username Skeleton */}
            <div className="h-6 w-36 rounded-[6px] bg-slate-200 animate-pulse mb-1.5" />

            {/* Full Name Skeleton */}
            <div className="h-4 w-44 rounded-[6px] bg-slate-200 animate-pulse mb-2.5" />

            {/* Bio Skeleton */}
            <div className="h-3.5 w-[320px] max-w-full rounded-[6px] bg-slate-200 animate-pulse mb-1.5" />
            <div className="h-3.5 w-[240px] max-w-full rounded-[6px] bg-slate-200 animate-pulse mb-5" />

            {/* 3-Stats Box Skeleton */}
            <div className="w-full max-w-[440px] h-[64px] rounded-[14px] bg-slate-200 animate-pulse mb-5" />

            {/* Action Buttons Skeleton (2 long buttons + 2 square icon buttons) */}
            <div className="flex items-center justify-center gap-2 w-full max-w-[460px]">
              <div className="flex-1 h-[38px] rounded-[10px] bg-slate-200 animate-pulse" />
              <div className="flex-1 h-[38px] rounded-[10px] bg-slate-200 animate-pulse" />
              <div className="size-[38px] shrink-0 rounded-[10px] bg-slate-200 animate-pulse" />
              <div className="size-[38px] shrink-0 rounded-[10px] bg-slate-200 animate-pulse" />
            </div>
          </div>
        </section>

        {/* Tabs & Grid Skeleton */}
        <section className="bg-white border border-[#E2E8F0] rounded-[20px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[460px]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-6 w-28 rounded-[6px] bg-slate-200 animate-pulse" />
              <div className="h-6 w-36 rounded-[6px] bg-slate-200 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded-[8px] bg-slate-200 animate-pulse" />
          </div>

          {/* 3-Column Square Grid Skeleton */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2 rounded-[12px] overflow-hidden">
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
            <div className="aspect-square bg-slate-200 animate-pulse rounded-[8px]" />
          </div>
        </section>
      </main>
    </div>
  );
}
