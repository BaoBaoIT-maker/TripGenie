'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Sparkles,
  Share2,
  Edit3,
  Send,
  X,
  MessageSquare,
  MapPin,
  Bot,
  Map as MapIcon,
  List,
  Trash2,
  Copy,
  Loader2,
  Calendar,
  Users,
  Bike,
  Gauge,
  UtensilsCrossed,
  Coffee,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useItineraryQuery,
  useDeleteItinerary,
  useCloneItinerary,
  useUpdateTransitMode,
} from '../../hooks/use-itinerary-planner';
import ItineraryTimeline from './ItineraryTimeline';
import BudgetBreakdownCard from './BudgetBreakdownCard';
import ItineraryMap from './ItineraryMap';
import { fetchMultiStopRoute, fetchRoute, Coordinate } from '@/services/routing.service';
import type { ItineraryDetail, ItineraryActivity, ItineraryDay, TransitMode } from '@/types/itinerary';
import { getDayColor, type ItineraryPathSegment, type DiscoveryPlace } from '@/features/map/types';

interface Props {
  id: string;
}

const BUDGET_LABEL: Record<string, string> = {
  LOW: 'Tiết kiệm',
  MEDIUM: 'Tiêu chuẩn',
  HIGH: 'Cao cấp',
  LUXURY: 'Hạng sang',
};

const PRICE_LEVEL_NUMERIC: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  LUXURY: 4,
};

const TRANSIT_MODE_LABELS: Record<string, string> = {
  FLIGHT: 'Máy bay',
  SLEEPER_BUS: 'Xe khách',
  TRAIN: 'Tàu hỏa',
  PERSONAL_CAR: 'Ô tô cá nhân',
  PERSONAL_MOTORBIKE: 'Xe máy',
};

function formatShortDate(isoString: string | null | undefined, dayIndex: number): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    d.setDate(d.getDate() + dayIndex);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return '';
  }
}

export default function ItineraryView({ id }: Props) {
  const router = useRouter();
  const { data, isLoading, error } = useItineraryQuery(id);
  const deleteMutation = useDeleteItinerary();
  const cloneMutation = useCloneItinerary();
  const updateTransitMutation = useUpdateTransitMode();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Đã xóa lịch trình thành công!');
      router.push('/planner');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa lịch trình. Vui lòng thử lại!');
    }
  };

  const handleClone = async () => {
    try {
      const cloned = await cloneMutation.mutateAsync(id);
      toast.success('Đã sao chép lịch trình thành công vào chuyến đi của bạn!');
      router.push(`/itineraries/${cloned.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể sao chép lịch trình. Vui lòng thử lại!');
    }
  };

  const handleUpdateTransitMode = async (newMode: TransitMode) => {
    try {
      await updateTransitMutation.mutateAsync({ id, transitMode: newMode });
      toast.success('Đã cập nhật phương tiện di chuyển và tính lại chi phí!');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật phương tiện di chuyển. Vui lòng thử lại!');
    }
  };

  const [dayScope, setDayScope] = useState<'all' | number>('all');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);

  // Auto-scroll timeline to selected activity
  useEffect(() => {
    if (!selectedPlaceId) return;
    const cardEl = document.getElementById(`itinerary-activity-${selectedPlaceId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPlaceId]);

  // Local state for interactive editing (Micro-AI swap, delete, add)
  const [days, setDays] = useState<ItineraryDay[]>([]);

  // Copilot Drawer state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{ sender: 'ai' | 'user'; text: string }>
  >([
    {
      sender: 'ai',
      text: 'Chào bạn! Lịch trình đã được tối ưu cung đường. Bạn có muốn đổi quán ăn trưa hay tìm thêm quán cafe view sông không?',
    },
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [quickAiPrompt, setQuickAiPrompt] = useState('');

  // Mobile View Switch (Timeline vs Map)
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline');

  // Road Routing Segments per day (OSRM)
  const [pathSegments, setPathSegments] = useState<ItineraryPathSegment[]>([]);
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    if (data?.days) {
      setDays(data.days);
    }
  }, [data]);

  const totalDays = data?.totalDays || days.length || 3;
  const totalNights = Math.max(0, totalDays - 1);

  const visibleDays = useMemo(() => {
    return dayScope === 'all' ? days : days.filter((d) => d.dayNumber === dayScope);
  }, [days, dayScope]);

  // Road Route computation per day using real OSRM road geometry
  useEffect(() => {
    let active = true;

    async function computeDailySegments() {
      const segments: ItineraryPathSegment[] = [];
      const flatCoords: [number, number][] = [];

      for (const day of visibleDays) {
        const coords: Coordinate[] = day.activities
          .filter((a): a is ItineraryActivity => a.latitude != null && a.longitude != null)
          .map((a) => ({ latitude: Number(a.latitude), longitude: Number(a.longitude) }));

        // Deduplicate consecutive identical coordinates
        const unique: Coordinate[] = [];
        for (const c of coords) {
          const prev = unique[unique.length - 1];
          if (!prev || Math.abs(prev.latitude - c.latitude) > 0.0002 || Math.abs(prev.longitude - c.longitude) > 0.0002) {
            unique.push(c);
          }
        }

        const color = getDayColor(day.dayNumber);

        if (unique.length < 2) {
          const dayPts = unique.map((c) => [c.longitude, c.latitude] as [number, number]);
          segments.push({
            dayNumber: day.dayNumber,
            color,
            coordinates: dayPts,
          });
          flatCoords.push(...dayPts);
          continue;
        }

        let dayGeometry: [number, number][] | null = null;
        try {
          const res = await fetchMultiStopRoute(unique, 'motorcycle');
          if (res.geometry?.coordinates && res.geometry.coordinates.length > 0) {
            dayGeometry = res.geometry.coordinates as [number, number][];
          }
        } catch {
          // Multi-stop failed, try pair-by-pair fallback
          try {
            const pairPoints: [number, number][] = [];
            for (let i = 0; i < unique.length - 1; i++) {
              const seg = await fetchRoute(unique[i], unique[i + 1], 'motorcycle');
              if (seg.geometry?.coordinates) {
                pairPoints.push(...(seg.geometry.coordinates as [number, number][]));
              }
            }
            if (pairPoints.length > 0) {
              dayGeometry = pairPoints;
            }
          } catch {
            // fallback below
          }
        }

        const finalCoords = dayGeometry && dayGeometry.length >= 2
          ? dayGeometry
          : unique.map((c) => [c.longitude, c.latitude] as [number, number]);

        segments.push({
          dayNumber: day.dayNumber,
          color,
          coordinates: finalCoords,
        });
        flatCoords.push(...finalCoords);
      }

      if (active) {
        setPathSegments(segments);
        setRoadPolyline(flatCoords);
      }
    }

    computeDailySegments();

    return () => {
      active = false;
    };
  }, [visibleDays]);

  // Map markers preparation with per-day signature colors
  const { mapPlaces, markerLabels, markerColors, pathLine } = useMemo(() => {
    let counter = 1;
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};
    const places: DiscoveryPlace[] = [];

    visibleDays.forEach((d) => {
      const dayColor = getDayColor(d.dayNumber);
      d.activities.forEach((a) => {
        if (a.latitude != null && a.longitude != null) {
          labels[a.placeId] = String(counter++);
          colors[a.placeId] = dayColor;
          places.push({
            id: a.placeId,
            slug: a.placeId,
            name: a.placeName,
            category: 'itinerary',
            categoryLabel: a.categoryName ?? 'Điểm đến',
            areaSlug: '',
            areaName: data?.destination || '',
            address: a.address ?? '',
            latitude: Number(a.latitude),
            longitude: Number(a.longitude),
            rating: a.ratingAvg ?? 4.7,
            reviewCount: a.reviewCount ?? 120,
            priceLevel: a.priceLevel ? (PRICE_LEVEL_NUMERIC[a.priceLevel] ?? 2) : null,
            isOpenNow: true,
            primaryImage: a.imageUrl,
            images: a.imageUrl ? [a.imageUrl] : [],
            phone: null,
            website: null,
            openingHours: null,
            tags: [],
          });
        }
      });
    });

    const fallbackLine: [number, number][] = visibleDays
      .flatMap((d) => d.activities)
      .filter((a): a is ItineraryActivity => a.latitude != null && a.longitude != null)
      .map((a) => [Number(a.longitude), Number(a.latitude)]);

    return { mapPlaces: places, markerLabels: labels, markerColors: colors, pathLine: fallbackLine };
  }, [visibleDays, data?.destination]);

  const mapCenter = useMemo(() => {
    return mapPlaces[0]
      ? { latitude: mapPlaces[0].latitude, longitude: mapPlaces[0].longitude }
      : { latitude: 16.0544, longitude: 108.2022 };
  }, [mapPlaces]);

  const transitName = data?.intercityTransit?.mode
    ? TRANSIT_MODE_LABELS[data.intercityTransit.mode] || data.intercityTransit.mode
    : 'Máy bay';

  // Micro-AI handlers
  function handleSwapPlace(placeId: string) {
    const act = days.flatMap((d) => d.activities).find((a) => a.placeId === placeId);
    const custom = window.prompt(
      `Đổi địa điểm "${act?.placeName || ''}" sang địa điểm nào? (Bấm OK để AI đổi sang điểm tương đương):`,
      ''
    );
    if (custom === null) return;
    const newName = custom.trim() ? custom.trim() : `${act?.placeName || 'Địa điểm'} (Phương án thay thế AI)`;

    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        activities: d.activities.map((a) => {
          if (a.placeId !== placeId) return a;
          return {
            ...a,
            placeName: newName,
            notes: 'AI đã cập nhật sang địa điểm tương đương, tối ưu lại cung đường.',
          };
        }),
      }))
    );
  }

  function handleDeletePlace(placeId: string) {
    const act = days.flatMap((d) => d.activities).find((a) => a.placeId === placeId);
    if (window.confirm(`Bạn có chắc muốn xóa "${act?.placeName || 'địa điểm này'}" khỏi lịch trình?`)) {
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          activities: d.activities.filter((a) => a.placeId !== placeId),
        }))
      );
    }
  }

  function handleAddPlace(dayNumber: number) {
    const input = window.prompt(`Nhập tên địa điểm bạn muốn thêm vào Ngày ${dayNumber}:`, '');
    if (input === null) return;
    const placeName = input.trim() || `Điểm tham quan mới Ngày ${dayNumber}`;
    const newAct: ItineraryActivity = {
      placeId: `custom-add-${Date.now()}`,
      placeName,
      startTime: '16:00',
      endTime: '17:30',
      durationMinutes: 90,
      visitOrder: 99,
      notes: 'Địa điểm được bổ sung vào lịch trình.',
      latitude: mapCenter.latitude + (Math.random() * 0.008 - 0.004),
      longitude: mapCenter.longitude + (Math.random() * 0.008 - 0.004),
      address: `${data?.destination || 'Khu vực trung tâm'}, Việt Nam`,
      imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&auto=format&fit=crop&q=80',
      categoryName: 'Điểm tham quan',
      distanceToNextKm: null,
    };

    setDays((prev) =>
      prev.map((d) => {
        if (d.dayNumber !== dayNumber) return d;
        return {
          ...d,
          activities: [...d.activities, newAct],
        };
      })
    );
  }

  function handleSendCopilot(textToSend?: string) {
    const msg = textToSend || copilotInput;
    if (!msg.trim()) return;

    setCopilotMessages((prev) => [...prev, { sender: 'user', text: msg }]);
    setCopilotInput('');

    setTimeout(() => {
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Đã ghi nhận yêu cầu: "${msg}". Tôi đã tối ưu lại thời gian và cập nhật địa điểm tương ứng trên Timeline cho bạn!`,
        },
      ]);
    }, 700);
  }

  function handleSendQuickAi() {
    if (!quickAiPrompt.trim()) return;
    setIsCopilotOpen(true);
    handleSendCopilot(quickAiPrompt);
    setQuickAiPrompt('');
  }

  function handleShareLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('Đã sao chép liên kết chuyến đi vào bộ nhớ tạm!');
    }
  }

  if (isLoading) return <ItineraryViewSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8 bg-[#F8FAFC]">
        <ErrorState
          title="Không tìm thấy lịch trình"
          message={error instanceof Error ? error.message : 'Lịch trình không tồn tại hoặc đã bị xóa.'}
          onRetry={() => (window.location.href = '/planner')}
        />
      </div>
    );
  }

  const coverPhoto =
    data.destination?.toLowerCase().includes('đà lạt')
      ? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80'
      : data.destination?.toLowerCase().includes('phú quốc')
      ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 lg:pb-10">
      <main className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-5">
        {/* =========================================================================
            1. HERO TRIP HEADER (Matches Figma Prompt Screen 2 Item 1)
            ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
          {/* Panoramic Cover Image */}
          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-100">
            <img
              src={coverPhoto}
              alt={data.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />

            <Link
              href="/planner"
              className="absolute top-4 left-4 size-9 rounded-full bg-white/90 backdrop-blur text-slate-700 hover:text-slate-950 hover:bg-white flex items-center justify-center transition-all shadow-sm"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="size-5" />
            </Link>

            <div className="absolute bottom-4 left-5 right-5 text-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 bg-teal-600/95 backdrop-blur text-white text-[11px] font-bold rounded-md shadow-xs">
                  {totalDays} Ngày {totalNights} Đêm
                </span>
                <span className="px-2.5 py-0.5 bg-white/90 backdrop-blur text-slate-900 text-[11px] font-bold rounded-md shadow-xs">
                  {BUDGET_LABEL[data.budgetLevel] || 'Tiêu chuẩn'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {data.title || `Hành trình khám phá ${data.destination || 'Việt Nam'}`}
              </h1>
            </div>
          </div>

          {/* Meta Bar & Quick Action Buttons */}
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-600 font-medium flex items-center gap-3 flex-wrap">
              {data.startDate && data.endDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5 text-slate-400" aria-hidden="true" />
                  <span>{data.startDate} – {data.endDate}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5 text-slate-400" aria-hidden="true" />
                <span>2 người lớn</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Bike className="size-3.5 text-slate-400" aria-hidden="true" />
                <span>Di chuyển: {transitName}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Gauge className="size-3.5 text-slate-400" aria-hidden="true" />
                <span>Nhịp độ: Cân bằng</span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleShareLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Share2 className="size-3.5 text-teal-600" />
                <span>Chia sẻ link</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="size-3.5 text-slate-500" />
                <span>Xuất PDF/In</span>
              </button>
              <button
                type="button"
                onClick={handleClone}
                disabled={cloneMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {cloneMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-teal-600" />
                ) : (
                  <Copy className="size-3.5 text-teal-600" />
                )}
                <span>Sao chép</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Xóa</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCopilotOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Edit3 className="size-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SPLIT LAYOUT (50% Timeline, 50% Sticky Map)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: TIMELINE (Width: 6 cols on Large Screens) */}
          <div
            className={`lg:col-span-6 space-y-5 ${
              mobileTab === 'map' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Sticky Day Tabs (tripplanner style) */}
            <div className="sticky top-16 z-20 bg-[#F8FAFC]/95 backdrop-blur-md pb-2 pt-1 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDayScope('all')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer ${
                  dayScope === 'all'
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                Tất cả các ngày
              </button>

              {days.map((day, idx) => {
                const active = dayScope === day.dayNumber;
                const shortDate = formatShortDate(data.startDate, idx);
                const dayColor = getDayColor(day.dayNumber);
                return (
                  <button
                    key={day.dayNumber}
                    type="button"
                    onClick={() => setDayScope(day.dayNumber)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
                    }`}
                    style={active ? { backgroundColor: dayColor } : {}}
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#ffffff' : dayColor }}
                    />
                    <span>Ngày {day.dayNumber} {shortDate ? `(${shortDate})` : ''}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick AI Prompt Bar (Matches Figma Prompt Screen 2 Item 5) */}
            <div className="flex items-center gap-2 rounded-2xl border-2 border-indigo-200 bg-white p-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <div className="size-8 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="size-4" />
              </div>
              <input
                type="text"
                value={quickAiPrompt}
                onChange={(e) => setQuickAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendQuickAi()}
                placeholder="Ra lệnh cho AI sửa lịch trình: Đổi quán ăn trưa, thêm điểm cafe gần sông..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendQuickAi}
                className="rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs px-4 py-2 transition-all cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
              >
                <span>Gửi</span>
                <Send className="size-3" />
              </button>
            </div>

            {/* Timeline Stream */}
            <ItineraryTimeline
              days={visibleDays}
              transit={data.intercityTransit}
              startDate={data.startDate}
              endDate={data.endDate}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={(placeId) => {
                setSelectedPlaceId(placeId);
                if (mobileTab === 'timeline') {
                  setMobileTab('map');
                }
              }}
              onHoverPlace={setHoveredPlaceId}
              onSwapPlace={handleSwapPlace}
              onDeletePlace={handleDeletePlace}
              onAddPlace={handleAddPlace}
              onChangeTransitMode={handleUpdateTransitMode}
              isUpdatingTransitMode={updateTransitMutation.isPending}
            />

            {/* Professional Cost Breakdown Table Widget */}
            {data.budgetBreakdown && (
              <BudgetBreakdownCard
                breakdown={data.budgetBreakdown}
                transitModeName={transitName}
                totalDays={totalDays}
              />
            )}
          </div>

          {/* RIGHT COLUMN: STICKY MAP (Width: 6 cols on Large Screens) */}
          <div
            className={`lg:col-span-6 lg:sticky lg:top-20 ${
              mobileTab === 'timeline' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="bg-white rounded-3xl border border-slate-200 p-2.5 shadow-xs">
              <div className="relative w-full h-[620px] lg:h-[calc(100vh-140px)] min-h-[520px] rounded-2xl overflow-hidden">
                <ItineraryMap
                  places={mapPlaces}
                  center={mapCenter}
                  markerLabels={markerLabels}
                  markerColors={markerColors}
                  pathLine={roadPolyline.length > 0 ? roadPolyline : pathLine}
                  pathSegments={pathSegments}
                  selectedPlaceId={selectedPlaceId}
                  hoveredPlaceId={hoveredPlaceId}
                  onSelectPlace={setSelectedPlaceId}
                  onHoverPlace={setHoveredPlaceId}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          SCREEN 3: SLIDE-OVER AI COPILOT DRAWER (Matches Figma Prompt Screen 3)
          ========================================================================= */}
      {/* Floating Copilot Button */}
      {!isCopilotOpen && (
        <button
          type="button"
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600 text-white font-extrabold text-xs sm:text-sm px-5 py-3 shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer"
        >
          <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
          <Sparkles className="size-4" />
          <span>Genie Copilot</span>
        </button>
      )}

      {/* Slide-over Drawer */}
      {isCopilotOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Genie Copilot
                </h3>
                <p className="text-[11px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  Trợ lý lịch trình trực tuyến
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCopilotOpen(false)}
              className="size-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
            {copilotMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-teal-600 text-white font-medium rounded-br-xs shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Chip Suggestions (Matches Figma Prompt) */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleSendCopilot('Đổi điểm trưa sang quán ăn đặc sản')}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-[11px] font-semibold rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <UtensilsCrossed className="size-3 text-amber-600" aria-hidden="true" />
              <span>Đổi điểm trưa sang đặc sản</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendCopilot('Tìm cafe ngắm hoàng hôn Hội An')}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-[11px] font-semibold rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Coffee className="size-3 text-amber-700" aria-hidden="true" />
              <span>Cafe ngắm hoàng hôn</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendCopilot('Hỏi kinh nghiệm thuê xe máy')}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-[11px] font-semibold rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Bike className="size-3 text-teal-600" aria-hidden="true" />
              <span>Kinh nghiệm xe máy</span>
            </button>
          </div>

          {/* Bottom Chat Input */}
          <div className="p-3.5 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
              placeholder="Hỏi hoặc ra lệnh cho Genie..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={() => handleSendCopilot()}
              className="size-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: MOBILE FLOATING BOTTOM DOCK (Matches Figma Prompt Screen 4)
          ========================================================================= */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-full p-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('timeline')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            mobileTab === 'timeline'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <List className="size-3.5" />
          <span>Lịch trình</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            mobileTab === 'map'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapIcon className="size-3.5" />
          <span>Bản đồ</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !deleteMutation.isPending && setShowDeleteModal(false)}
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
                Xóa lịch trình chuyến đi?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa chuyến đi <strong className="text-slate-900 font-semibold">&quot;{data?.title}&quot;</strong>?
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                ℹ️ <strong>Lưu ý:</strong> Chuyến đi sẽ được gỡ khỏi danh sách của bạn. Nếu có người khác đã sao chép (clone) lịch trình này về tài khoản của họ thì bản sao của họ <strong>hoàn toàn không bị mất</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setShowDeleteModal(false)}
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
    </div>
  );
}

function ItineraryViewSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">
        <Skeleton className="h-52 w-full rounded-3xl bg-white border border-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-2xl bg-white" />
            <Skeleton className="h-44 w-full rounded-2xl bg-white border border-slate-200" />
            <Skeleton className="h-44 w-full rounded-2xl bg-white border border-slate-200" />
          </div>
          <div className="lg:col-span-6">
            <Skeleton className="h-[620px] w-full rounded-3xl bg-white border border-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
