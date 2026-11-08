"use client";

import type { CommunityGroupSummary } from "@/types/community";

interface CommunityLeftSidebarProps {
  groups: CommunityGroupSummary[];
  selectedGroupId: string;
  onSelectGroup: (groupSlugOrId: string) => void;
  onOpenCreatePostWithItinerary: () => void;
  isAdmin?: boolean;
  onOpenCreateGroup?: () => void;
}

const FALLBACK_GROUP_AVATAR =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop";

export function MobileTopicGroupsStrip({
  groups,
  selectedGroupId,
  onSelectGroup,
  isAdmin = false,
  onOpenCreateGroup,
  className = "",
}: Omit<CommunityLeftSidebarProps, "onOpenCreatePostWithItinerary"> & {
  className?: string;
}) {
  const topicGroups = groups.filter((g) => !g.isDefault);
  const displayGroups = topicGroups.length > 0 ? topicGroups : groups;

  if (displayGroups.length === 0) return null;

  const isAllSelected =
    !selectedGroupId || selectedGroupId === "cong-dong-chung";

  return (
    <div
      className={`min-w-0 max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSelectGroup("")}
        className={`h-8 px-3 rounded-[10px] border text-[12px] font-bold shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
          isAllSelected
            ? "bg-[#0194F3] border-[#0194F3] text-white"
            : "bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]"
        }`}
      >
        <i className="fa-solid fa-layer-group text-[11px]" aria-hidden="true" />
        <span>Tất cả chủ đề</span>
      </button>

      {displayGroups.map((group) => {
        const isSelected =
          selectedGroupId === group.slug || selectedGroupId === group.id;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(isSelected ? "" : group.slug)}
            className={`h-8 pl-1.5 pr-3 rounded-[10px] border text-[12px] font-bold shrink-0 inline-flex items-center gap-2 transition-colors cursor-pointer ${
              isSelected
                ? "bg-[#F0F7FF] border-[#0194F3] text-[#007FE3]"
                : "bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                group.iconUrl ||
                group.coverUrl ||
                group.coverImageUrl ||
                FALLBACK_GROUP_AVATAR
              }
              alt={group.name}
              loading="lazy"
              decoding="async"
              className="size-5 rounded-[6px] object-cover shrink-0 border border-[#E2E8F0]"
            />
            <span className="truncate max-w-[150px]">{group.name}</span>
            <span
              className={`text-[10px] font-bold ${
                isSelected ? "text-[#0194F3]" : "text-[#94A3B8]"
              }`}
            >
              {group.postCount}
            </span>
          </button>
        );
      })}

      {isAdmin && onOpenCreateGroup && (
        <button
          type="button"
          onClick={onOpenCreateGroup}
          className="h-8 px-3 rounded-[10px] border border-dashed border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[11px] font-bold text-[#475569] shrink-0 cursor-pointer"
        >
          + Tạo nhóm
        </button>
      )}
    </div>
  );
}

export function CommunityLeftSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  onOpenCreatePostWithItinerary,
  isAdmin = false,
  onOpenCreateGroup,
}: CommunityLeftSidebarProps) {
  const topicGroups = groups.filter((g) => !g.isDefault);
  const displayGroups = topicGroups.length > 0 ? topicGroups : groups;

  return (
    <aside className="sidebar-sticky hidden lg:flex flex-col gap-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:pb-8 community-sidebar-scroll">
      {/* BLOCK 1: CHỦ ĐỀ & CẢM HỨNG (TOP CATEGORIES / COMMUNITY GROUPS) */}
      <div className="shrink-0 rounded-[20px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-black tracking-[0.06em] uppercase text-[#0F172A]">
            <i
              className="fa-solid fa-layer-group mr-1.5 text-[#0194F3]"
              aria-hidden="true"
            />
            Chủ Đề &amp; Điểm Đến
          </h3>

          <div className="flex items-center gap-2">
            {isAdmin && onOpenCreateGroup && (
              <button
                type="button"
                onClick={onOpenCreateGroup}
                title="Quản trị viên tạo nhóm cộng đồng mới"
                className="text-[11px] font-bold text-[#64748B] hover:text-[#0F172A] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                + Tạo nhóm
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectGroup("")}
              className={`text-[11px] font-bold cursor-pointer bg-transparent border-none transition-colors ${
                !selectedGroupId || selectedGroupId === "cong-dong-chung"
                  ? "text-[#0194F3] underline underline-offset-4"
                  : "text-[#0194F3] hover:text-[#007FE3]"
              }`}
            >
              Tất cả
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {displayGroups.map((group) => {
            const isSelected =
              selectedGroupId === group.slug || selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() =>
                  onSelectGroup(isSelected ? "" : group.slug)
                }
                title={`Khám phá nhóm ${group.name}`}
                className={`w-full flex items-center justify-between py-2 px-2.5 rounded-[14px] border transition-all cursor-pointer text-left group/cat ${
                  isSelected
                    ? "bg-[#F0F7FF] border-[#BAE0FD]"
                    : "bg-transparent border-transparent hover:bg-[#F0F7FF] hover:border-[#BAE0FD]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      group.iconUrl ||
                      group.coverUrl ||
                      group.coverImageUrl ||
                      FALLBACK_GROUP_AVATAR
                    }
                    alt={group.name}
                    className="w-[42px] h-[42px] rounded-[12px] object-cover shrink-0 border border-[#E2E8F0] transition-all duration-200 group-hover/cat:scale-[1.06] group-hover/cat:shadow-[0_4px_10px_rgba(0,0,0,0.08)]"
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-[12px] font-extrabold truncate ${
                        isSelected ? "text-[#007FE3]" : "text-[#0F172A]"
                      }`}
                    >
                      {group.name}
                    </div>
                    {group.subtitle && (
                      <div className="text-[10px] text-[#64748B] font-medium truncate">
                        {group.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold shrink-0 ml-2 ${
                    isSelected ? "text-[#0194F3]" : "text-[#94A3B8]"
                  }`}
                >
                  {group.postCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BLOCK 2: BANNER TẠO BÀI VIẾT (STATIC CAMPER VAN ILLUSTRATION - OPTION A) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenCreatePostWithItinerary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenCreatePostWithItinerary();
          }
        }}
        title="Nhấp để tạo bài viết chia sẻ chuyến đi"
        className="rounded-[20px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] cursor-pointer flex flex-col gap-2.5 transition-all group/banner"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 text-[#0194F3] group-hover/banner:text-[#007FE3] text-[13px] font-extrabold uppercase tracking-[0.04em] transition-colors">
            <span>Chia sẻ ngay</span>
            <i
              className="fa-solid fa-arrow-right text-[11px] transition-transform duration-200 group-hover/banner:translate-x-[3px]"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Artwork Xe Van Cắm Trại "Good Vibes" (Tĩnh sắc nét + Hover Zoom mượt mà) */}
        <div className="w-full rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#F1F5F9] bg-[#0284C7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/community/camper-van-banner.png"
            alt="Chia sẻ lộ trình chuyến đi cùng cộng đồng TripGenie"
            loading="lazy"
            className="w-full h-auto block transition-transform duration-300 group-hover/banner:scale-[1.03]"
          />
        </div>
      </div>

      {/* MINI FOOTER */}
      <div className="px-2 text-[11px] text-[#94A3B8] leading-[1.6]">
        <p>
          © 2026 TripGenie Vietnam.
          <br />
          Review thật • Lộ trình có thể nhân bản.
        </p>
      </div>
    </aside>
  );
}
