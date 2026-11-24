'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Trash2,
  CheckSquare,
  Square,
  Landmark,
  Clock,
  User,
  MoreVertical,
  Eye,
} from 'lucide-react';
import { formatVnd, formatTripDates } from '@/features/planner/model/itinerary-format';
import { getItineraryWeather } from '@/features/planner/services/weather.service';
import { WeatherIcon } from './itinerary/WeatherIcon';
import {
  getDestinationCover,
  DEFAULT_TRIP_DAYS,
} from '@/features/planner/constants/itinerary.constants';
import { useI18n } from '@/i18n';
import type { ItineraryDetail } from '@/types/itinerary';
import type { CommunityLinkedItinerarySummary } from '@/types/community';

export interface TripCardItem {
  id: string;
  title: string;
  destination?: string | null;
  areaName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  coverPhoto?: string | null;
  totalDays?: number;
  totalPlaces?: number;
  estimatedCost?: number | null;
  budgetBreakdown?: {
    totalEstimated?: number;
  };
  days?: Array<{ activities?: any[] }>;
  viewerRole?: string | null;
  memberCount?: number;
  members?: Array<{ userId: string; fullName?: string | null; avatarUrl?: string | null; role?: string }>;
  isOwner?: boolean;
}

export interface TripCardProps {
  itin: ItineraryDetail | CommunityLinkedItinerarySummary | TripCardItem;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onSelect?: (id: string, e?: React.MouseEvent) => void;
  onDeleteRequest?: (itin: ItineraryDetail) => void;
  openDropdownId?: string | null;
  setOpenDropdownId?: React.Dispatch<React.SetStateAction<string | null>>;
  onOpenSelectModeWithId?: (id: string) => void;
  onClone?: (itin: any) => void;
}

export function TripCard({
  itin,
  isSelected = false,
  isSelectMode = false,
  onSelect,
  onDeleteRequest,
  openDropdownId,
  setOpenDropdownId,
  onOpenSelectModeWithId,
  onClone,
}: TripCardProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const item = itin as TripCardItem;

  const totalDays =
    item.totalDays ||
    item.days?.length ||
    (item.startDate && item.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 86400000
          ) + 1
        )
      : DEFAULT_TRIP_DAYS);
  const totalNights = Math.max(0, totalDays - 1);

  const budgetText = item.budgetBreakdown?.totalEstimated
    ? formatVnd(item.budgetBreakdown.totalEstimated)
    : item.estimatedCost
    ? formatVnd(item.estimatedCost)
    : t('planner.common.actualCostFallback');

  const destinationName = item.destination || item.areaName || t('planner.common.vietnamFallback');
  const imageUrl = item.coverPhoto || getDestinationCover(destinationName);
  const dateText = formatTripDates(item.startDate, item.endDate, locale);
  const weather = getItineraryWeather(destinationName, item.startDate, locale);
  const totalActivities =
    item.days?.reduce((sum: number, d: { activities?: any[] }) => sum + (d.activities?.length || 0), 0) ||
    item.totalPlaces ||
    0;

  // Real member count calculation: if tripGroup has joined members or viewer has shared role
  const isSharedRole = item.viewerRole === 'EDITOR' || item.viewerRole === 'VIEWER';
  const memberCount = item.memberCount || item.members?.length || (isSharedRole ? 2 : 1);
  const isShared = memberCount > 1 || isSharedRole;
  const isMenuOpen = openDropdownId === item.id;

  return (
    <div
      onClick={(e) => {
        if (isSelectMode && onSelect) {
          onSelect(item.id, e);
        } else {
          router.push(`/itineraries/${item.id}`);
        }
      }}
      className="trip-card group flex flex-col cursor-pointer"
    >
      {/* 16:11 Aspect Ratio Container */}
      <div
        className={`relative aspect-[16/11] w-full rounded-2xl overflow-hidden bg-slate-100 transition-all duration-300 border ${
          isSelected
            ? 'ring-2 ring-[#0194F3] border-[#0194F3] shadow-md'
            : 'border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] group-hover:shadow-md group-hover:border-[#0194F3]/40 group-hover:-translate-y-1'
        }`}
      >
        <img
          src={imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent pointer-events-none" />

        {/* Top-Left: Duration Pill or Select Checkbox */}
        <div className="absolute top-3 left-3 z-10">
          {isSelectMode && onSelect ? (
            <button
              type="button"
              onClick={(e) => onSelect(item.id, e)}
              aria-label={
                isSelected ? t('planner.tripCard.deselectAria') : t('planner.tripCard.selectTripAria')
              }
              className={`size-7 rounded-lg backdrop-blur-md flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                isSelected
                  ? 'bg-[#0194F3] text-white ring-2 ring-white'
                  : 'bg-black/50 text-white hover:bg-black/70 border border-white/20'
              }`}
            >
              {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white text-[11px] font-semibold shadow-xs backdrop-blur-md border border-white/20 flex items-center gap-1.5">
              <Clock className="size-3 text-white/80" />
              <span>
                {t('planner.common.durationCompact', { days: totalDays, nights: totalNights })}
              </span>
            </span>
          )}
        </div>

        {/* Top-Right: 3-Dots Menu & Optional Role Badge */}
        {!onClone && setOpenDropdownId && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            {isSharedRole && (
              <span
                className={`px-2 py-0.5 rounded-md backdrop-blur-md text-[10px] font-bold shadow-xs ${
                  item.viewerRole === 'EDITOR'
                    ? 'bg-[#0194F3] text-white'
                    : 'bg-slate-800/90 text-white'
                }`}
              >
                {item.viewerRole === 'EDITOR'
                  ? t('planner.tripCard.canEditBadge')
                  : t('planner.roles.VIEWER')}
              </span>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdownId((prev) => (prev === item.id ? null : item.id));
                }}
                className="size-8 rounded-full bg-black/40 hover:bg-black/65 text-white backdrop-blur-md flex items-center justify-center transition-all border border-white/20 cursor-pointer active:scale-90"
                title={t('planner.page.optionsTitle')}
              >
                <MoreVertical className="size-3.5" />
              </button>

              {isMenuOpen && onOpenSelectModeWithId && onDeleteRequest && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                >
                  <Link
                    href={`/itineraries/${item.id}`}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-sky-50 hover:text-[#0194F3] transition-colors"
                  >
                    <Eye className="size-3.5 text-slate-400" />
                    <span>{t('planner.tripCard.viewDetail')}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdownId(null);
                      onOpenSelectModeWithId(item.id);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-sky-50 hover:text-[#0194F3] transition-colors cursor-pointer"
                  >
                    <CheckSquare className="size-3.5 text-slate-400" />
                    <span>{t('planner.page.selectThisTrip')}</span>
                  </button>

                  {(item.isOwner !== false || item.viewerRole === 'OWNER') && (
                    <>
                      <div className="h-px bg-slate-100 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdownId(null);
                          onDeleteRequest(item as ItineraryDetail);
                        }}
                        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                        <span>{t('planner.tripCard.delete')}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Body Card */}
      <div className="pt-3.5 space-y-2">
        {/* Row 1: Location & Semantic Dynamic Weather */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3 text-[#0194F3] shrink-0" />
            <span className="font-semibold text-slate-700 truncate max-w-[130px] sm:max-w-[150px]">
              {destinationName}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${weather.badgeClass}`}
          >
            <WeatherIcon
              condition={weather.condition}
              size={14}
              className="w-3.5 h-3.5 object-contain shrink-0"
            />
            <span>{weather.label}</span>
          </span>
        </div>

        {/* Row 2: Title */}
        <h3 className="font-bold text-slate-900 text-[15px] sm:text-base leading-snug line-clamp-1 group-hover:text-[#0194F3] transition-colors">
          {item.title}
        </h3>

        {/* Row 3: Dates & Landmark Count */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3 text-slate-400 shrink-0" />
            <span>{dateText}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600">
            <Landmark className="size-3 text-slate-400 shrink-0" />
            <span>
              {totalActivities > 0
                ? t('planner.tripCard.stopsLabel', { count: totalActivities })
                : t('planner.tripCard.flexibleStops')}
            </span>
          </div>
        </div>

        {/* Row 4: Budget & Companions / Action Footer */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <strong className="font-bold text-slate-800">{budgetText}</strong>

          {onClone ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClone(item);
              }}
              className="h-7 px-3 rounded-lg bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <span>{t('planner.tripCard.useTemplate')}</span>
            </button>
          ) : isShared ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center -space-x-1.5">
                {item.members && item.members.length > 0 ? (
                  <>
                    {item.members.slice(0, 3).map((m: { userId: string; fullName?: string | null; avatarUrl?: string | null; role?: string }, idx: number) =>
                      m.avatarUrl ? (
                        <img
                          key={m.userId}
                          src={m.avatarUrl}
                          alt={m.fullName || `${t('planner.common.memberFallback')} ${idx + 1}`}
                          title={m.fullName || `${t('planner.common.memberFallback')} ${idx + 1}`}
                          className="w-5 h-5 rounded-full ring-2 ring-white object-cover shadow-2xs"
                        />
                      ) : (
                        <span
                          key={m.userId}
                          title={m.fullName || t('planner.common.memberFallback')}
                          className={`w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold shadow-2xs ${
                            m.role === 'OWNER'
                              ? 'bg-[#0194F3] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {(m.fullName || 'U').charAt(0).toUpperCase()}
                        </span>
                      )
                    )}
                    {item.members.length > 3 && (
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 ring-2 ring-white flex items-center justify-center text-[9px] font-bold shadow-2xs">
                        +{item.members.length - 3}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-5 h-5 rounded-full bg-[#0194F3] text-white ring-2 ring-white flex items-center justify-center text-[9px] font-bold shadow-2xs">
                      {item.viewerRole === 'EDITOR' ? 'E' : 'O'}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 ring-2 ring-white flex items-center justify-center text-[9px] font-bold shadow-2xs">
                      +{Math.max(1, memberCount - 1)}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-600">
                {memberCount > 1
                  ? t('planner.tripCard.travelersGoing', { count: memberCount })
                  : t('planner.tripCard.companionLabel')}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <User className="size-3 text-slate-400" />
              <span>{t('planner.tripCard.soloLabel')}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
