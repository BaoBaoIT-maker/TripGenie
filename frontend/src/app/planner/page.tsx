'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  MapPin,
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
import { formatVnd, formatDateVi, formatTripDates } from '@/features/planner/model/itinerary-format';
import { getItineraryWeather } from '@/features/planner/services/weather.service';
import { TripCard } from '@/features/planner/components/TripCard';
import { WeatherIcon } from '@/features/planner/components/itinerary/WeatherIcon';
import {
  getDestinationCover,
  ITINERARY_SCOPE_OPTIONS,
  DEFAULT_TRIP_DAYS,
  DEFAULT_BUDGET_FALLBACK_TEXT,
  type ItineraryScope,
} from '@/features/planner/constants/itinerary.constants';
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
      toast.success(`Đã xóa lịch trình "${deletingItin.title}" thành công!`);
      setDeletingItin(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xóa lịch trình. Vui lòng thử lại!';
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
      toast.success(`Đã xóa thành công ${countToDelete} lịch trình!`);
      setSelectedIds([]);
      setIsSelectMode(false);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể xóa các lịch trình đã chọn. Vui lòng thử lại!';
      toast.error(msg);
    }
  };

  function handleOpenWizard(dest?: string) {
    if (!user) {
      toast.error('Vui lòng đăng nhập để tạo và lưu trữ lịch trình cá nhân!');
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
              <span>Lịch trình của bạn</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {allItineraries.length} chuyến đi
              </span>
              {isSelectMode && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0194F3] text-white animate-in fade-in">
                  Đã chọn {selectedIds.length}/{searchFilteredItineraries.length}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Quản lý toàn bộ hành trình du lịch cá nhân và các chuyến đi đồng hành cùng bạn bè.
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
                          ? 'Bỏ chọn tất cả'
                          : `Chọn tất cả (${searchFilteredItineraries.length})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      className="inline-flex items-center gap-1.5 h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <X className="size-3.5" />
                      <span>Hủy chọn</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={toggleSelectMode}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <CheckSquare className="size-4 text-[#0194F3]" />
                    <span>Chọn nhiều</span>
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
              <span>Tạo chuyến đi mới</span>
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
              className={`relative w-full rounded-3xl overflow-hidden bg-slate-900 border transition-all cursor-pointer ${
                isSelectMode && selectedIds.includes(spotlightTrip.id)
                  ? 'border-[#0194F3] ring-2 ring-[#0194F3] shadow-lg'
                  : 'border-white/10 shadow-lg'
              }`}
            >
              {/* Cinematic Banner Image */}
              <div className="relative h-[280px] sm:h-[310px] w-full overflow-hidden">
                <img
                  src={spotlightTrip.coverPhoto || getDestinationCover(spotlightTrip.destination)}
                  alt={spotlightTrip.title}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700 ease-out"
                />
                {/* Natural, breathable scrim gradient: Keeps photos vibrant while guaranteeing WCAG 2.2 text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Spotlight Content Overlay */}
              <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between text-white z-10">
                {/* Top Row: Duration Pill + Semantic Dynamic Weather + 3-dots */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
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
                      {spotlightTrip.totalDays || spotlightTrip.days?.length || DEFAULT_TRIP_DAYS}N
                      {Math.max(
                        0,
                        (spotlightTrip.totalDays || spotlightTrip.days?.length || DEFAULT_TRIP_DAYS) - 1
                      )}
                      Đ
                    </span>

                    {/* Semantic Dynamic Weather Tag */}
                    {(() => {
                      const weather = getItineraryWeather(
                        spotlightTrip.destination,
                        spotlightTrip.startDate
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
                            {spotlightTrip.destination || 'Điểm đến'} • {weather.label}
                          </span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* 3-dots dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId((prev) =>
                          prev === spotlightTrip.id ? null : spotlightTrip.id
                        );
                      }}
                      className="size-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all border border-white/20 cursor-pointer"
                      title="Tùy chọn"
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
                          <span>Xem chi tiết</span>
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
                          <span>Chọn chuyến đi này</span>
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
                              <span>Xóa lịch trình</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Location, Title, Date, Budget, Landmarks, Action CTA */}
                <div className="space-y-3.5 max-w-2xl">
                  <div className="space-y-1.5">
                    {spotlightTrip.destination && (
                      <div className="flex items-center gap-2 text-white/90 font-medium text-xs sm:text-sm">
                        <MapPin className="size-3.5 text-sky-400" />
                        <span>{spotlightTrip.destination}</span>
                      </div>
                    )}

                    <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md leading-tight">
                      {spotlightTrip.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-200 font-normal">
                      Thời gian:{' '}
                      <span className="text-white font-medium">
                        {formatTripDates(spotlightTrip.startDate, spotlightTrip.endDate)}
                      </span>
                      {' • '}Dự toán:{' '}
                      <span className="text-white font-medium">
                        {spotlightTrip.budgetBreakdown?.totalEstimated
                          ? formatVnd(spotlightTrip.budgetBreakdown.totalEstimated)
                          : DEFAULT_BUDGET_FALLBACK_TEXT}
                      </span>
                    </p>

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
                          <Landmark className="size-3.5 text-white/80 shrink-0" />
                          <span className="font-medium text-white">
                            {totalActivities} điểm tham quan nổi bật:
                          </span>
                          {samplePlaces.length > 0 && (
                            <span className="text-slate-200 truncate max-w-md">
                              {samplePlaces.join(', ')}...
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Action CTA & Companions */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <Link
                      href={`/itineraries/${spotlightTrip.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                    >
                      <span>Xem lịch trình chi tiết</span>
                      <ArrowRight className="size-3.5" />
                    </Link>

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
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
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
                                        alt={m.fullName || 'Thành viên'}
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
                                  ? `Đồng hành (${memberCount} người - Có quyền sửa)`
                                  : `Đồng hành (${memberCount} người - Chỉ xem)`
                                : `Chuyến đi nhóm (${memberCount} người đi)`}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                          <User className="size-3.5 text-white/80" />
                          <span className="text-xs font-medium text-slate-200">
                            Chuyến đi cá nhân
                          </span>
                        </div>
                      );
                    })()}
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
                  <span>{opt.label}</span>
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
              placeholder="Tìm theo tên chuyến đi, điểm đến..."
              className="w-full h-9 pl-9 pr-8 rounded-xl text-xs sm:text-sm bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/20 focus:border-[#0194F3] transition-all placeholder:text-slate-400 shadow-2xs"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
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
                Chưa có kế hoạch chuyến đi nào
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                Bắt đầu hành trình tiếp theo của bạn ngay hôm nay! Hãy để Genie AI thiết kế lộ trình
                thông minh chỉ trong vài giây.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenWizard()}
                className="px-5 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs sm:text-sm font-bold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="size-4" />
                <span>Tạo lịch trình với AI</span>
              </button>
              <Link
                href="/community"
                className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
              >
                Khám phá Cộng đồng
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
                Không tìm thấy chuyến đi nào với từ khóa &quot;{searchKeyword}&quot;
              </p>
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
              >
                Xóa tìm kiếm để xem tất cả
              </button>
            </div>
          )}

        {/* =========================================================================
            7. SECTION 1: CHUYẾN ĐI SẮP TỚI
            ========================================================================= */}
        {!isLoading && (upcomingTrips.length > 0 || !searchKeyword) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
              <h2 className="text-base font-bold text-slate-800">Chuyến đi sắp tới</h2>
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
                  Lập kế hoạch mới
                </div>
                <p className="text-xs text-slate-400 text-center mt-1 max-w-[180px] leading-relaxed">
                  Tạo nhanh bằng Genie AI hoặc xếp lịch thủ công
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
              <h2 className="text-base font-bold text-slate-800">Kỷ niệm các chuyến đi trước</h2>
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
            <span>Đã chọn {selectedIds.length} lịch trình</span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              Bỏ chọn
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/30 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
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
                Xóa hàng loạt {selectedIds.length} lịch trình?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa{' '}
                <strong className="text-slate-900 font-semibold">
                  {selectedIds.length} lịch trình
                </strong>{' '}
                đã chọn? Hành động này sẽ gỡ bỏ chúng khỏi danh sách của bạn.
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-[#0194F3] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Bảo vệ bản sao (Clone-safe):</strong> Nếu bất kỳ lịch trình nào trong số
                  này đã được người khác sao chép (clone) về chuyến đi của họ, thì bản sao của họ{' '}
                  <strong>hoàn toàn an toàn và không bị ảnh hưởng</strong>.
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
                Hủy bỏ
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
                    <span>Đang xóa {selectedIds.length} mục...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Xác nhận xóa ({selectedIds.length})</span>
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
              <h3 className="text-lg font-bold text-slate-900">Xóa lịch trình chuyến đi?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa chuyến đi{' '}
                <strong className="text-slate-900 font-semibold">
                  &quot;{deletingItin.title}&quot;
                </strong>
                ?
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-[#0194F3] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Lưu ý:</strong> Chuyến đi sẽ được gỡ khỏi danh sách của bạn. Nếu có người
                  khác đã sao chép (clone) lịch trình này về tài khoản của họ thì bản sao của họ{' '}
                  <strong>hoàn toàn không bị mất</strong>.
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
                Hủy bỏ
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
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Xác nhận xóa</span>
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
