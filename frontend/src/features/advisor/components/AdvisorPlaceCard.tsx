'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ADVISOR_UI_CONSTANTS, AdvisorPlaceSummary } from '@/types/advisor';

interface AdvisorPlaceCardProps {
  place: AdvisorPlaceSummary;
  onNavigate?: () => void;
}

export function AdvisorPlaceCard({ place, onNavigate }: AdvisorPlaceCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const priceLabel = place.priceLevel
    ? ADVISOR_UI_CONSTANTS.PRICE_LEVEL_LABELS[place.priceLevel] ||
      place.priceLevel
    : null;

  return (
    <Link
      href={`/places/${place.id}`}
      onClick={onNavigate}
      className="group flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-2.5 text-card-foreground shadow-2xs transition-all duration-200 motion-reduce:transition-none hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {place.primaryImage && !imgError ? (
          <Image
            src={place.primaryImage}
            alt={place.name}
            fill
            sizes="64px"
            unoptimized={
              place.primaryImage.includes('wikimedia.org') ||
              place.primaryImage.includes('wikipedia.org')
            }
            onError={() => setImgError(true)}
            className="object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary text-secondary-foreground">
            <i className="fa-solid fa-map-location-dot text-lg" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <h4 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {place.name}
          </h4>
          <i
            className="fa-solid fa-arrow-up-right-from-square mt-0.5 text-[11px] shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden="true"
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
            {place.categoryName}
          </span>

          {place.ratingAvg > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <i
                className="fa-solid fa-star text-[11px] text-amber-500"
                aria-hidden="true"
              />
              {place.ratingAvg.toFixed(1)}
              {place.reviewCount > 0 && (
                <span className="font-normal text-muted-foreground">
                  ({place.reviewCount})
                </span>
              )}
            </span>
          )}

          {priceLabel && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {priceLabel}
            </span>
          )}
        </div>

        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <i
            className="fa-solid fa-location-dot text-[11px] shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="truncate">{place.address}</span>
        </p>
      </div>
    </Link>
  );
}
