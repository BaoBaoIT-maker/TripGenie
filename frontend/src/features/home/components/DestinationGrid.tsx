"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import type { BackendTravelAreaItem } from "@/services/place.service";
import { HOME_CONFIG } from "../config/home.config";

interface DestinationGridProps {
  areas: BackendTravelAreaItem[];
}

function DestinationCard({ area, className = "" }: { area: BackendTravelAreaItem; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const displayName = area.nameVi || area.name;
  const imageUrl =
    !imgError && HOME_CONFIG.destinations.imagesBySlug[area.slug]
      ? HOME_CONFIG.destinations.imagesBySlug[area.slug]
      : HOME_CONFIG.destinations.fallbackImage;

  return (
    <Link
      href={`/explore?areaId=${area.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${className}`}
    >
      <div className="relative h-full w-full overflow-hidden bg-muted">
        <Image
          src={imageUrl}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 66vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
          <div className="flex items-center gap-1 text-[11px] font-medium text-white/80 mb-0.5">
            <MapPin className="size-3 text-primary shrink-0" />
            <span>{area.type === "CITY" ? "Thành phố" : "Tỉnh thành"}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white line-clamp-2 group-hover:text-teal-200 transition-colors">
            {displayName}
          </h3>
        </div>
      </div>
    </Link>
  );
}

export function DestinationGrid({ areas }: DestinationGridProps) {
  if (!areas || areas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-muted/20">
        <p className="text-sm text-muted-foreground">
          Chưa có thông tin điểm đến. Bạn có thể{" "}
          <Link href="/explore" className="text-primary font-semibold hover:underline">
            khám phá tất cả địa điểm trên bản đồ
          </Link>
          .
        </p>
      </div>
    );
  }

  const destinations = areas.slice(0, HOME_CONFIG.destinations.limit);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[200px] sm:auto-rows-[220px] gap-4">
      {destinations.map((area, index) => {
        const wide = destinations.length >= 3 && (index === 0 || index === 5);
        const tall = destinations.length >= 4 && (index === 1 || (index === 4 && destinations.length >= 8));

        return (
          <DestinationCard
            key={area.id}
            area={area}
            className={`${wide ? "lg:col-span-2" : ""} ${tall ? "lg:row-span-2" : ""}`}
          />
        );
      })}
    </div>
  );
}
