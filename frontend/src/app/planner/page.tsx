'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Plus,
  ArrowRight,
  Compass,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  CheckCheck,
  X,
  Info,
  Search,
  Landmark,
  User,
  Users,
  MoreVertical,
  Eye,
} from 'lucide-react';
import {
  useItinerariesListQuery,
  useDeleteItinerary,
  useBulkDeleteItineraries,
} from '@/features/planner/hooks/use-itinerary-planner';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { toast } from 'sonner';
import ItineraryWizardModal from '@/features/planner/components/ItineraryWizardModal';
import { formatVnd, formatTripDates } from '@/features/planner/model/itinerary-format';
import { getItineraryWeather } from '@/features/planner/services/weather.service';
import { TripCard } from '@/features/planner/components/TripCard';
import { WeatherIcon } from '@/features/planner/components/itinerary/WeatherIcon';
import {
  getDestinationCover,
  ITINERARY_SCOPE_OPTIONS,
  DEFAULT_TRIP_DAYS,
  type ItineraryScope,
} from '@/features/planner/constants/itinerary.constants';
import { useI18n } from '@/i18n';
import type { ItineraryDetail } from '@/types/itinerary';

function isPastTrip(endDate?: string | null, startDate?: string | null): boolean {
  const targetDateStr = endDate || startDate;
  if (!targetDateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripDate = new Date(targetDateStr);
  if (isNaN(tripDate.getTime())) return false;
  tripDate.setHours(23, 59, 59, 999);
  return tripDate < today;
}

export default function PlannerListPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPreselectedDest, setWizardPreselectedDest] = useState<string | undefined>(undefined);

  // Segmented scope filter: 'ALL' | 'OWNED' | 'JOINED'
  const [activeScope, setActiveScope] = useState<ItineraryScope>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Parallel dual-query for instant zero-network-lag tab switching
  const { data: ownedItineraries = [], isLoading: isLoadingOwned } =
    useItinerariesListQuery('OWNED');
  const { data: joinedItineraries = [], isLoading: isLoadingJoined } =
    useItinerariesListQuery('JOINED');
  const isLoading = isLoadingOwned || isLoadingJoined;

  const deleteMutation = useDeleteItinerary();
  const bulkDeleteMutation = useBulkDeleteItineraries();

  const [deletingItin, setDeletingItin] = useState<ItineraryDetail | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleGlobalClick = () => setOpenDropdownId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Merge itineraries for 'ALL'
  const allItineraries = useMemo(() => {
    const map = new Map<string, ItineraryDetail>();
    ownedItineraries.forEach((it) => map.set(it.id, it));
    joinedItineraries.forEach((it) => map.set(it.id, it));
    return Array.from(map.values());
  }, [ownedItineraries, joinedItineraries]);

  // Filter by active scope
  const scopeFilteredItineraries = useMemo(() => {
    if (activeScope === 'OWNED') return ownedItineraries;
    if (activeScope === 'JOINED') return joinedItineraries;
    return allItineraries;
  }, [activeScope, ownedItineraries, joinedItineraries, allItineraries]);

  // Filter by search keyword
  const searchFilteredItineraries = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return scopeFilteredItineraries;
    return scopeFilteredItineraries.filter((it) => {
      const titleMatch = (it.title || '').toLowerCase().includes(kw);
      const destMatch = (it.destination || '').toLowerCase().includes(kw);
      return titleMatch || destMatch;
    });
  }, [scopeFilteredItineraries, searchKeyword]);

  // Chronological partitioning: Upcoming vs Past
  const { upcomingTrips, pastTrips } = useMemo(() => {
    const upcoming: ItineraryDetail[] = [];
    const past: ItineraryDetail[] = [];

    searchFilteredItineraries.forEach((it) => {
      if (isPastTrip(it.endDate, it.startDate)) {
        past.push(it);
      } else {
        upcoming.push(it);
      }
    });

    // Sort upcoming ascending by startDate (soonest trip first)
    upcoming.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.localeCompare(b.startDate);
    });

    // Sort past descending by endDate || startDate (most recent first)
    past.sort((a, b) => {
      const dateA = a.endDate || a.startDate || '';
      const dateB = b.endDate || b.startDate || '';
      return dateB.localeCompare(dateA);
    });

    return { upcomingTrips: upcoming, pastTrips: past };
  }, [searchFilteredItineraries]);

  // Spotlight Hero: The nearest upcoming trip
  const spotlightTrip = upcomingTrips[0] ?? null;
  const otherUpcomingTrips = spotlightTrip ? upcomingTrips.slice(1) : upcomingTrips;

  const handleDelete = async () => {
    if (!deletingItin) return;
    try {
      await deleteMutation.mutateAsync(deletingItin.id);
      toast.success(t('planner.page.deleteSuccessNamed', { title: deletingItin.title }));
      setDeletingItin(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('planner.page.deleteError');
      toast.error(msg);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  const handleToggleSelectId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === searchFilteredItineraries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(searchFilteredItineraries.map((i) => i.id));
    }
  };

  const handleOpenSelectModeWithId = (id: string) => {
    setIsSelectMode(true);
    setSelectedIds([id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const countToDelete = selectedIds.length;
      await bulkDeleteMutation.mutateAsync(selectedIds);
      toast.success(t('planner.page.bulkDeleteSuccess', { count: countToDelete }));
      setSelectedIds([]);
      setIsSelectMode(false);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('planner.page.bulkDeleteError');
      toast.error(msg);
    }
  };

  function handleOpenWizard(dest?: string) {
    if (!user) {
      toast.error(t('planner.page.loginCreateError'));
      router.push('/login');
      return;
    }
    setWizardPreselectedDest(dest);
    setIsWizardOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-20 selection:bg-[#0194F3] selection:text-white">
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            1. CLEAN EDITORIAL HEADER
            ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <span>{t('planner.page.title')}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {t('planner.page.tripsCount', { count: allItineraries.length })}
              </span>
              {isSelectMode && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0194F3] text-white animate-in fade-in">
                  {t('planner.page.selectedFraction', {
                    selected: selectedIds.length,
                    total: searchFilteredItineraries.length,
                  })}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              {t('planner.page.subtitle')}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {!isLoading && allItineraries.length > 0 && (
              <>
                {isSelectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1.5 h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <CheckCheck className="size-3.5 text-[#0194F3]" />
                      <span>
                        {selectedIds.length === searchFilteredItineraries.length
                          ? t('planner.page.deselectAll')
                          : t('planner.page.selectAll', { count: searchFilteredItineraries.length })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      className="inline-flex items-center gap-1.5 h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <X className="size-3.5" />
                      <span>{t('planner.page.cancelSelect')}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={toggleSelectMode}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <CheckSquare className="size-4 text-[#0194F3]" />
                    <span>{t('planner.page.selectMultiple')}</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => handleOpenWizard()}
              className="inline-flex items-center gap-2 h-10 px-5 bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs shadow-blue-500/20 shrink-0 cursor-pointer active:scale-95"
            >
              <Plus className="size-4" />
              <span>{t('planner.page.createTripBtn')}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. SPOTLIGHT HERO: CHUYẾN ĐI SẮP TỚI GẦN NHẤT (Vibrant, airy travel visuals)
            ========================================================================= */}
        {!isLoading && spotlightTrip && !searchKeyword && (
          <section className="relative group">
            <div
              onClick={(e) => {
                if (isSelectMode) {
                  handleToggleSelectId(spotlightTrip.id, e);
                } else {
                  router.push(`/itineraries/${spotlightTrip.id}`);
                }
              }}
              className={`relative w-full rounded-3xl overflow-hidden bg-slate-900 border transition-all cursor-pointer min-h-[350px] sm:min-h-[310px] flex flex-col justify-between ${
                isSelectMode && selectedIds.includes(spotlightTrip.id)
                  ? 'border-[#0194F3] ring-2 ring-[#0194F3] shadow-lg'
                  : 'border-white/10 shadow-lg'
              }`}
            >
              {/* Cinematic Banner Image with deeper gradient for WCAG 2.2 AA contrast on mobile */}
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <img
                  src={spotlightTrip.coverPhoto || getDestinationCover(spotlightTrip.destination)}
                  alt={spotlightTrip.title}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700 ease-out"
                />
                {/* Natural, breathable scrim gradient: deeper on mobile to guarantee crystal-clear text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
              </div>

              {/* Spotlight Content Container (Relative z-10 for natural flex flow without height-clipping) */}
              <div className="relative z-10 p-5 sm:p-8 flex flex-col justify-between flex-1 gap-5 sm:gap-6 text-white">
                {/* Top Row: Duration Pill + Semantic Dynamic Weather + 3-dots */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    {isSelectMode && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectId(spotlightTrip.id, e)}
                        className={`size-8 rounded-xl backdrop-blur-md flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                          selectedIds.includes(spotlightTrip.id)
                            ? 'bg-[#0194F3] text-white ring-2 ring-white'
                            : 'bg-black/50 text-white hover:bg-black/70 border border-white/20'
                        }`}
                      >
                        {selectedIds.includes(spotlightTrip.id) ? (
                          <CheckSquare className="size-4" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    )}

                    <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/15">
                      {t('planner.common.durationCompact', {
                        days: spotlightTrip.totalDays || spotlightTrip.days?.length || DEFAULT_TRIP_DAYS,
                        nights: Math.max(
                          0,
                          (spotlightTrip.totalDays || spotlightTrip.days?.length || DEFAULT_TRIP_DAYS) - 1
                        ),
                      })}
                    </span>

                    {/* Semantic Dynamic Weather Tag */}
                    {(() => {
                      const weather = getItineraryWeather(
                        spotlightTrip.destination,
                        spotlightTrip.startDate,
                        locale
                      );
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border shadow-2xs ${weather.heroBadgeClass}`}
                        >
                          <WeatherIcon
                            condition={weather.condition}
                            size={16}
                            className="w-4 h-4 object-contain shrink-0"
                          />
                          <span>
                            {spotlightTrip.destination || t('planner.common.destinationFallback')} • {weather.label}
                          </span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* 3-dots dropdown */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId((prev) =>
                          prev === spotlightTrip.id ? null : spotlightTrip.id
                        );
                      }}
                      className="size-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all border border-white/20 cursor-pointer"
                      title={t('planner.page.optionsTitle')}
                    >
                      <MoreVertical className="size-4" />
                    </button>

                    {openDropdownId === spotlightTrip.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                      >
                        <Link
                          href={`/itineraries/${spotlightTrip.id}`}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-sky-50 hover:text-[#0194F3] transition-colors"
                        >
                          <Eye className="size-3.5 text-slate-400" />
                          <span>{t('planner.tripCard.viewDetail')}</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenDropdownId(null);
                            handleOpenSelectModeWithId(spotlightTrip.id);
                          }}
                          className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-sky-50 hover:text-[#0194F3] transition-colors cursor-pointer"
                        >
                          <CheckSquare className="size-3.5 text-slate-400" />
                          <span>{t('planner.page.selectThisTrip')}</span>
                        </button>

                        {(spotlightTrip.isOwner !== false ||
                          spotlightTrip.viewerRole === 'OWNER') && (
                          <>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownId(null);
                                setDeletingItin(spotlightTrip);
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

                {/* Bottom Section: Title, Date, Budget, Landmarks, Action CTA & Companions */}
                <div className="space-y-4 max-w-3xl">
                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md leading-snug line-clamp-2">
                      {spotlightTrip.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-200">
                      <span>
                        {t('planner.page.spotlightDatesLabel')}{' '}
                        <span className="text-white font-medium">
                          {formatTripDates(spotlightTrip.startDate, spotlightTrip.endDate, locale)}
                        </span>
                      </span>
                      <span className="text-white/40 hidden sm:inline">•</span>
                      <span>
                        {t('planner.page.spotlightBudgetLabel')}{' '}
                        <span className="text-white font-medium">
                          {spotlightTrip.budgetBreakdown?.totalEstimated
                            ? formatVnd(spotlightTrip.budgetBreakdown.totalEstimated)
                            : t('planner.common.actualCostFallback')}
                        </span>
                      </span>
                    </div>

                    {/* Tourist attractions */}
                    {(() => {
                      const totalActivities =
                        spotlightTrip.days?.reduce(
                          (sum, d) => sum + (d.activities?.length || 0),
                          0
                        ) || 0;
                      const samplePlaces =
                        spotlightTrip.days
                          ?.flatMap((d) => d.activities?.map((a) => a.placeName) || [])
                          .slice(0, 4) || [];
                      if (totalActivities === 0) return null;
                      return (
                        <div className="flex items-center gap-2 text-xs text-slate-300 pt-0.5">
                          <Landmark className="size-3.5 text-sky-400 shrink-0" />
                          <span className="font-semibold text-white shrink-0">
                            {t('planner.page.spotlightAttractions', { count: totalActivities })}
                          </span>
                          {samplePlaces.length > 0 && (
                            <span className="text-slate-200 truncate">
                              {samplePlaces.join(', ')}...
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Action CTA & Companions: Stacked thumb-friendly on mobile, side-by-side on desktop */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 sm:pt-1 border-t border-white/10 sm:border-0">
                    {/* Companions Badge */}
                    {(() => {
                      const isSharedRole =
                        spotlightTrip.viewerRole === 'EDITOR' || spotlightTrip.viewerRole === 'VIEWER';
                      const memberCount =
                        spotlightTrip.memberCount ||
                        spotlightTrip.members?.length ||
                        (isSharedRole ? 2 : 1);
                      const isShared = memberCount > 1 || isSharedRole;
                      const members = spotlightTrip.members || [];

                      if (isShared) {
                        return (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 self-start sm:self-auto">
                            {members.length > 0 ? (
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {members.slice(0, 3).map((m, idx) => (
                                  <div
                                    key={m.userId || idx}
                                    className="inline-flex size-5 rounded-full ring-1 ring-white/50 overflow-hidden bg-white/20 text-[9px] font-bold text-white items-center justify-center shrink-0"
                                  >
                                    {m.avatarUrl ? (
                                      <img
                                        src={m.avatarUrl}
                                        alt={m.fullName || t('planner.common.memberFallback')}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      (m.fullName?.[0] || 'U').toUpperCase()
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Users className="size-3.5 text-white/80" />
                            )}
                            <span className="text-xs font-medium text-slate-200">
                              {isSharedRole
                                ? spotlightTrip.viewerRole === 'EDITOR'
                                  ? t('planner.page.sharedEditorBadge', { count: memberCount })
                                  : t('planner.page.sharedViewerBadge', { count: memberCount })
                                : t('planner.page.groupTripBadge', { count: memberCount })}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 self-start sm:self-auto">
                          <User className="size-3.5 text-white/80" />
                          <span className="text-xs font-medium text-slate-200">
                            {t('planner.page.soloTripBadge')}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Action CTA Button */}
                    <Link
                      href={`/itineraries/${spotlightTrip.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/25 cursor-pointer w-full sm:w-auto shrink-0"
                    >
                      <span>{t('planner.page.viewDetailCta')}</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            3. UNIFIED TOOLBAR: SEGMENTED SCOPE FILTER + INSTANT SEARCH
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1">
          {/* Segmented Scope Filter */}
          <div className="inline-flex p-1 bg-slate-200/60 rounded-xl text-xs font-semibold self-start sm:self-auto">
            {ITINERARY_SCOPE_OPTIONS.map((opt) => {
              const count =
                opt.key === 'OWNED'
                  ? ownedItineraries.length
                  : opt.key === 'JOINED'
                  ? joinedItineraries.length
                  : allItineraries.length;
              const isActive = activeScope === opt.key;

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setActiveScope(opt.key)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{t(`planner.scopes.${opt.key}`)}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-sky-50 text-[#0194F3]'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={t('planner.page.searchPlaceholder')}
              className="w-full h-9 pl-9 pr-8 rounded-xl text-xs sm:text-sm bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/20 focus:border-[#0194F3] transition-all placeholder:text-slate-400 shadow-2xs"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                aria-label={t('planner.page.clearSearch')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            4. LOADING SKELETON
            ========================================================================= */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse flex flex-col h-[280px]"
              >
                <div className="h-40 bg-slate-200" />
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================================================
            5. EMPTY STATE: Khi không có dữ liệu nào
            ========================================================================= */}
        {!isLoading && allItineraries.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4 my-8">
            <div className="size-16 rounded-2xl bg-sky-50 text-[#0194F3] mx-auto flex items-center justify-center text-2xl shadow-xs">
              <Compass className="size-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {t('planner.page.emptyAllTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                {t('planner.page.emptyAllDesc')}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenWizard()}
                className="px-5 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs sm:text-sm font-bold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="size-4" />
                <span>{t('planner.page.emptyAiBtn')}</span>
              </button>
              <Link
                href="/community"
                className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
              >
                {t('planner.page.exploreCommunityBtn')}
              </Link>
            </div>
          </div>
        )}

        {/* =========================================================================
            6. EMPTY SEARCH RESULT: Khi tìm kiếm không ra kết quả
            ========================================================================= */}
        {!isLoading &&
          allItineraries.length > 0 &&
          upcomingTrips.length === 0 &&
          pastTrips.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto space-y-3 my-6">
              <Search className="size-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                {t('planner.page.emptySearchNamed', { keyword: searchKeyword })}
              </p>
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
              >
                {t('planner.page.clearSearchViewAll')}
              </button>
            </div>
          )}

        {/* =========================================================================
            7. SECTION 1: CHUYẾN ĐI SẮP TỚI
            ========================================================================= */}
        {!isLoading && (upcomingTrips.length > 0 || !searchKeyword) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
              <h2 className="text-base font-bold text-slate-800">
                {t('planner.page.upcomingSectionTitle')}
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0194F3] border border-sky-200">
                {upcomingTrips.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* If search keyword is active, render spotlightTrip as regular card too */}
              {searchKeyword && spotlightTrip && (
                <TripCard
                  key={spotlightTrip.id}
                  itin={spotlightTrip}
                  isSelected={selectedIds.includes(spotlightTrip.id)}
                  isSelectMode={isSelectMode}
                  onSelect={handleToggleSelectId}
                  onDeleteRequest={(it) => setDeletingItin(it)}
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                  onOpenSelectModeWithId={handleOpenSelectModeWithId}
                />
              )}

              {/* Remaining upcoming trips */}
              {otherUpcomingTrips.map((itin) => (
                <TripCard
                  key={itin.id}
                  itin={itin}
                  isSelected={selectedIds.includes(itin.id)}
                  isSelectMode={isSelectMode}
                  onSelect={handleToggleSelectId}
                  onDeleteRequest={(it) => setDeletingItin(it)}
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                  onOpenSelectModeWithId={handleOpenSelectModeWithId}
                />
              ))}

              {/* Quick Launch Canvas Card */}
              <div
                onClick={() => handleOpenWizard()}
                className="group flex flex-col justify-center items-center p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#0194F3] bg-white/70 hover:bg-sky-50/40 transition-all duration-300 cursor-pointer min-h-[260px]"
              >
                <div className="size-12 rounded-2xl bg-sky-50 text-[#0194F3] group-hover:bg-[#0194F3] group-hover:text-white flex items-center justify-center text-lg transition-all shadow-2xs group-hover:scale-110 mb-3">
                  <Plus className="size-6" />
                </div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-[#0194F3] transition-colors text-center">
                  {t('planner.page.quickCardTitle')}
                </div>
                <p className="text-xs text-slate-400 text-center mt-1 max-w-[180px] leading-relaxed">
                  {t('planner.page.quickCardDesc')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            8. SECTION 2: KỶ NIỆM CÁC CHUYẾN ĐI TRƯỚC
            ========================================================================= */}
        {!isLoading && pastTrips.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
              <h2 className="text-base font-bold text-slate-800">
                {t('planner.page.pastSectionTitle')}
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {pastTrips.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pastTrips.map((itin) => (
                <TripCard
                  key={itin.id}
                  itin={itin}
                  isSelected={selectedIds.includes(itin.id)}
                  isSelectMode={isSelectMode}
                  onSelect={handleToggleSelectId}
                  onDeleteRequest={(it) => setDeletingItin(it)}
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                  onOpenSelectModeWithId={handleOpenSelectModeWithId}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          9. FLOATING BULK ACTION BAR
          ========================================================================= */}
      {isSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <span className="size-6 rounded-full bg-[#0194F3] text-white font-bold flex items-center justify-center text-xs">
              {selectedIds.length}
            </span>
            <span>{t('planner.page.selectedCount', { count: selectedIds.length })}</span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              {t('planner.page.deselectShort')}
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/30 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="size-3.5" />
              <span>
                {t('planner.page.deleteShort')} {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          10. BULK DELETE CONFIRMATION MODAL (CLONE-SAFE)
          ========================================================================= */}
      {showBulkDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !bulkDeleteMutation.isPending && setShowBulkDeleteModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="size-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                {t('planner.page.bulkDeleteModalTitle', { count: selectedIds.length })}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {t('planner.page.bulkDeleteModalDescBefore')}{' '}
                <strong className="text-slate-900 font-semibold">
                  {t('planner.page.bulkDeleteModalDescCount', { count: selectedIds.length })}
                </strong>{' '}
                {t('planner.page.bulkDeleteModalDescAfter')}
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-[#0194F3] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>{t('planner.page.bulkDeleteSafeLabel')}</strong>{' '}
                  {t('planner.page.bulkDeleteSafeBefore')}{' '}
                  <strong>{t('planner.page.bulkDeleteSafeHighlight')}</strong>.
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {t('planner.view.cancelAction')}
              </button>
              <button
                type="button"
                disabled={bulkDeleteMutation.isPending}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{t('planner.page.bulkDeleting', { count: selectedIds.length })}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>{t('planner.page.confirmBulkDelete', { count: selectedIds.length })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          11. SINGLE DELETE CONFIRMATION MODAL (CLONE-SAFE)
          ========================================================================= */}
      {deletingItin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !deleteMutation.isPending && setDeletingItin(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="size-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                {t('planner.page.deleteModalTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {t('planner.page.deleteModalDesc')}{' '}
                <strong className="text-slate-900 font-semibold">
                  &quot;{deletingItin.title}&quot;
                </strong>
                ?
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-[#0194F3] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>{t('planner.view.deleteModalNoticeLabel')}</strong>{' '}
                  {t('planner.view.deleteModalNoticeBefore')}{' '}
                  <strong>{t('planner.view.deleteModalNoticeHighlight')}</strong>.
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setDeletingItin(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {t('planner.view.cancelAction')}
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{t('planner.page.deleting')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>{t('planner.page.confirmDelete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          12. CREATION WIZARD MODAL
          ========================================================================= */}
      <ItineraryWizardModal
        isOpen={isWizardOpen}
        initialDestination={wizardPreselectedDest}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardPreselectedDest(undefined);
        }}
      />
    </div>
  );
}
