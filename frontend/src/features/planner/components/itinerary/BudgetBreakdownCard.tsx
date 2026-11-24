'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { formatVnd, isDiningActivity } from '../../model/itinerary-format';
import { BUDGET_BUFFER_RATIO, PARTY_SIZE_BOUNDS } from '../../constants/itinerary.constants';
import type { BudgetBreakdown, ItineraryActivity, ItineraryDay } from '@/types/itinerary';

interface Props {
  breakdown: BudgetBreakdown;
  days?: ItineraryDay[];
  transitModeName?: string;
  totalDays?: number;
  isOwner?: boolean;
  isUpdatingPartySize?: boolean;
  onUpdatePartySize?: (nextSize: number) => void;
  onJumpToStop?: (placeId: string) => void;
}

interface ExpandableStopItem {
  dayNumber: number;
  activity: ItineraryActivity;
}

interface LedgerRowConfig {
  id: 'transit' | 'hotel' | 'food' | 'tickets' | 'local';
  iconClass: string;
  title: string;
  subtitle: string;
  amount: number;
  stops?: ExpandableStopItem[];
}

export default function BudgetBreakdownCard({
  breakdown,
  days = [],
  transitModeName,
  totalDays = 3,
  isOwner = false,
  isUpdatingPartySize = false,
  onUpdatePartySize,
  onJumpToStop,
}: Props) {
  const { t } = useI18n();
  const [expandedRow, setExpandedRow] = useState<'food' | 'tickets' | null>(null);

  const nights = Math.max(1, totalDays - 1);
  const partySize = Math.max(PARTY_SIZE_BOUNDS.MIN, breakdown.partySize ?? PARTY_SIZE_BOUNDS.DEFAULT);
  const roomsNeeded = Math.max(1, Math.ceil(partySize / 2));
  const total = Math.max(1, breakdown.totalEstimated);
  const perPerson = breakdown.perPersonEstimated ?? Math.round(breakdown.totalEstimated / partySize);
  const contingencyAmount = Math.round(breakdown.totalEstimated * BUDGET_BUFFER_RATIO);
  const recommendedTotal = breakdown.totalEstimated + contingencyAmount;

  const { foodStops, ticketStops } = useMemo(() => {
    const food: ExpandableStopItem[] = [];
    const tickets: ExpandableStopItem[] = [];

    for (const day of days) {
      for (const activity of day.activities) {
        if (activity.estimatedCost == null || activity.estimatedCost <= 0) continue;
        if (isDiningActivity(activity.categoryName, activity.placeName)) {
          food.push({ dayNumber: day.dayNumber, activity });
        } else {
          tickets.push({ dayNumber: day.dayNumber, activity });
        }
      }
    }

    return { foodStops: food, ticketStops: tickets };
  }, [days]);

  const rows: LedgerRowConfig[] = [
    {
      id: 'transit',
      iconClass: 'fa-solid fa-plane',
      title: t('planner.budget.transitRowTitle', {
        mode: transitModeName?.toLowerCase() || t('planner.budget.transitFallbackName'),
      }),
      subtitle:
        partySize > 1
          ? t('planner.budget.transitSubGroup', { count: partySize })
          : t('planner.budget.transitSubSolo'),
      amount: breakdown.transitRoundTrip,
    },
    {
      id: 'hotel',
      iconClass: 'fa-solid fa-bed',
      title: t('planner.budget.hotelRowTitle', { nights, rooms: roomsNeeded }),
      subtitle: t('planner.budget.hotelRowSub'),
      amount: breakdown.accommodation,
    },
    {
      id: 'food',
      iconClass: 'fa-solid fa-utensils',
      title: t('planner.budget.foodRowTitle', { days: totalDays }),
      subtitle: t('planner.budget.foodRowSub'),
      amount: breakdown.food,
      stops: foodStops,
    },
    {
      id: 'tickets',
      iconClass: 'fa-solid fa-ticket',
      title: t('planner.budget.ticketsRowTitle'),
      subtitle: t('planner.budget.ticketsRowSub'),
      amount: breakdown.tickets,
      stops: ticketStops,
    },
    {
      id: 'local',
      iconClass: 'fa-solid fa-car',
      title: t('planner.budget.localRowTitle', { days: totalDays }),
      subtitle: t('planner.budget.localRowSub'),
      amount: breakdown.localTransit,
    },
  ];

  const handleStepPartySize = (delta: number) => {
    if (!onUpdatePartySize || isUpdatingPartySize) return;
    const next = Math.min(PARTY_SIZE_BOUNDS.MAX, Math.max(PARTY_SIZE_BOUNDS.MIN, partySize + delta));
    if (next !== partySize) {
      onUpdatePartySize(next);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Clean Monochrome Ledger */}
      <section
        aria-label={t('planner.budget.ledgerAria')}
        className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden"
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {partySize > 1
                ? t('planner.budget.totalHeaderGroup', { count: partySize })
                : t('planner.budget.totalHeaderTrip')}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
              ~{formatVnd(breakdown.totalEstimated)}
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              {t('planner.budget.avgPrefix')}
              <strong className="text-slate-900 font-semibold">{formatVnd(perPerson)}</strong>
              {t('planner.common.perPerson')}
              {' · '}
              {t('planner.budget.roomsLabel', { count: roomsNeeded })}
            </p>
          </div>

          {isOwner && onUpdatePartySize ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-semibold text-slate-500">
                {t('planner.budget.pricingScaleLabel')}
              </span>
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  aria-label={t('planner.budget.decreaseGroupAria')}
                  disabled={isUpdatingPartySize || partySize <= PARTY_SIZE_BOUNDS.MIN}
                  onClick={() => handleStepPartySize(-1)}
                  className="size-8 rounded-lg bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <i className="fa-solid fa-minus text-[10px]" aria-hidden="true" />
                </button>
                <span className="px-3 text-xs font-bold text-[#10243A] tabular-nums min-w-[64px] text-center">
                  {t('planner.common.peopleCount', { count: partySize })}
                </span>
                <button
                  type="button"
                  aria-label={t('planner.budget.increaseGroupAria')}
                  disabled={isUpdatingPartySize || partySize >= PARTY_SIZE_BOUNDS.MAX}
                  onClick={() => handleStepPartySize(1)}
                  className="size-8 rounded-lg bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <i className="fa-solid fa-plus text-[10px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-[#F5F9FF] border border-[#D0E7FF] text-xs font-bold text-[#0194F3] tabular-nums">
              {t('planner.budget.peopleRoomsSummary', { people: partySize, rooms: roomsNeeded })}
            </span>
          )}
        </div>

        {/* 5 Monochrome Pricing Rows */}
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const pct = Math.round((row.amount / total) * 100);
            const isExpandable = (row.id === 'food' || row.id === 'tickets') && (row.stops?.length ?? 0) > 0;
            const isExpanded = expandedRow === row.id;

            return (
              <div key={row.id} className="px-5 sm:px-6 py-4 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-slate-100 text-[#10243A] flex items-center justify-center shrink-0 mt-0.5">
                      <i className={`${row.iconClass} text-xs`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs sm:text-[13px] font-bold text-[#10243A]">
                        {row.title}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{row.subtitle}</p>
                      {isExpandable && (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedRow((curr) =>
                              curr === row.id ? null : (row.id as 'food' | 'tickets'),
                            )
                          }
                          className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0194F3] hover:underline cursor-pointer"
                        >
                          <span className="tabular-nums">
                            {isExpanded
                              ? t('planner.budget.hideStopDetails')
                              : t('planner.budget.showStopDetails', { count: row.stops!.length })}
                          </span>
                          <i
                            className={`fa-solid fa-chevron-down text-[9px] transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-xs sm:text-sm font-bold text-[#10243A] tabular-nums">
                      {formatVnd(row.amount)}
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {t('planner.budget.percentOfTotal', { pct })}
                    </div>
                  </div>
                </div>

                {/* Single subtle monochrome proportion bar */}
                <div className="pl-12">
                  <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0194F3]/75 transition-all duration-300"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Accordion Traceability Stops */}
                {isExpandable && isExpanded && row.stops && (
                  <div className="ml-12 mt-2 rounded-xl border border-slate-200/80 bg-slate-50/70 divide-y divide-slate-200/60 overflow-hidden">
                    {row.stops.map(({ dayNumber, activity }, idx) => (
                      <button
                        key={`${activity.id || activity.placeId}-${idx}`}
                        type="button"
                        onClick={() => onJumpToStop?.(activity.placeId)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#F0F7FF] transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#10243A] group-hover:text-[#0194F3] truncate">
                            {activity.placeName}
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {t('planner.common.day', { n: dayNumber })}
                            {activity.startTime ? ` · ${activity.startTime}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-[#10243A] tabular-nums">
                            ~{formatVnd(activity.estimatedCost ?? 0)}{t('planner.common.perPerson')}
                          </span>
                          {onJumpToStop && (
                            <i
                              className="fa-solid fa-arrow-right text-[10px] text-slate-400 group-hover:text-[#0194F3]"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Right: Split Summary & Contingency Reserve */}
      <aside className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-receipt text-[#0194F3]" aria-hidden="true" />
            <span>{t('planner.budget.splitSummaryTitle')}</span>
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-600">
                {t('planner.budget.baseEstimateLabel', { count: partySize })}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatVnd(breakdown.totalEstimated)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-600">{t('planner.budget.equalSplitLabel')}</span>
              <span className="font-bold text-[#0194F3] tabular-nums">
                ~{formatVnd(perPerson)}{t('planner.common.perPerson')}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 tabular-nums">
                {t('planner.budget.contingencyLabel', { pct: Math.round(BUDGET_BUFFER_RATIO * 100) })}
              </span>
              <span className="font-semibold text-slate-700 tabular-nums">
                +{formatVnd(contingencyAmount)}
              </span>
            </div>

            <div className="pt-3 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {t('planner.budget.recommendedTotalLabel')}
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                ~{formatVnd(recommendedTotal)}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F5F9FF] border border-[#D0E7FF] p-3.5 text-[11px] text-slate-600 flex items-start gap-2.5 leading-relaxed">
            <i className="fa-solid fa-circle-info text-[#0194F3] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('planner.budget.autoCalculatedNote')}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
