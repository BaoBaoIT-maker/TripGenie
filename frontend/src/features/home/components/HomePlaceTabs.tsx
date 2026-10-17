"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PlaceGrid } from "@/components/place/PlaceGrid";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { HOME_CONFIG } from "../config/home.config";
import { homeService } from "../services/home.service";
import { buildExploreHref } from "@/features/map/lib/explore-query";
import { cn } from "@/lib/utils";

export function HomePlaceTabs() {
  const [activeTabId, setActiveTabId] = useState<string>(
    HOME_CONFIG.places.tabs[0].id
  );

  const activeTab =
    HOME_CONFIG.places.tabs.find((t) => t.id === activeTabId) ||
    HOME_CONFIG.places.tabs[0];

  const {
    data: places,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["home-places", activeTab.id, activeTab.audience],
    queryFn: () =>
      homeService.getPlaces(activeTab.audience, HOME_CONFIG.places.limit),
    staleTime: 60 * 1000,
  });

  const exploreAllHref = activeTab.audience
    ? buildExploreHref({ suitableFor: activeTab.audience, sort: "rating" })
    : buildExploreHref({ sort: "rating" });

  return (
    <div className="space-y-6">
      {/* Tab Bar & Explore All Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Accessible Tabs */}
        <div
          role="tablist"
          aria-label="Khám phá theo sở thích"
          className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl overflow-x-auto no-scrollbar max-w-full"
        >
          {HOME_CONFIG.places.tabs.map((tab) => {
            const isSelected = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer",
                  isSelected
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* View All with active tab filter */}
        <Link
          href={exploreAllHref}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors self-start sm:self-auto"
        >
          <span>{HOME_CONFIG.places.viewAllText}</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Tab Panel Content */}
      <div
        role="tabpanel"
        id={`panel-${activeTab.id}`}
        aria-labelledby={`tab-${activeTab.id}`}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: HOME_CONFIG.places.limit }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-muted/30 overflow-hidden flex flex-col h-[340px] animate-pulse"
              >
                <div className="h-44 sm:h-48 w-full bg-muted/80" />
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted/80" />
                    <div className="h-3 w-1/2 rounded bg-muted/60" />
                  </div>
                  <div className="h-3 w-1/3 rounded bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Không thể tải địa điểm"
            message={HOME_CONFIG.places.errorMessage}
            onRetry={() => refetch()}
            className="my-4 py-10"
          />
        ) : !places || places.length === 0 ? (
          <EmptyState
            title="Chưa có địa điểm phù hợp"
            description={HOME_CONFIG.places.emptyMessage}
            actionNode={
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                Khám phá tất cả địa điểm
              </Link>
            }
            className="my-4 py-10"
          />
        ) : (
          <PlaceGrid places={places} columns={4} />
        )}
      </div>
    </div>
  );
}
