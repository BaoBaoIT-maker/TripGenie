'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Sparkles,
  Share2,
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
  Check,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useItineraryQuery,
  useDeleteItinerary,
  useCloneItinerary,
  useUpdateTransitMode,
  useUpdateCoverPhoto,
  useCopilotChat,
  useCopilotHistory,
  useDirectSwapActivity,
  useApplyProposal,
} from '../../hooks/use-itinerary-planner';
import ItineraryTimeline from './ItineraryTimeline';
import BudgetBreakdownCard from './BudgetBreakdownCard';
import ItineraryMap from './ItineraryMap';
import PlaceAlternativesModal from './PlaceAlternativesModal';
import CoverPhotoModal from './CoverPhotoModal';
import ItineraryWizardModal from '../ItineraryWizardModal';
import CopilotDrawer, { LocatePlaceTarget } from './CopilotDrawer';
import { placeService } from '@/services/place.service';
import { fetchMultiStopRoute, fetchRoute, Coordinate } from '@/services/routing.service';
import type { ItineraryDetail, ItineraryActivity, ItineraryDay, TransitMode, CopilotProposal } from '@/types/itinerary';
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
  const updateCoverMutation = useUpdateCoverPhoto(id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

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

  const handleSaveCoverPhoto = async (newCoverUrl: string) => {
    try {
      await updateCoverMutation.mutateAsync(newCoverUrl);
      toast.success('Đã cập nhật ảnh bìa lịch trình thành công!');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật ảnh bìa. Vui lòng thử lại!');
      throw err;
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

  // Copilot mutations and history
  const chatMutation = useCopilotChat(id);
  const directSwapMutation = useDirectSwapActivity(id);
  const applyProposalMutation = useApplyProposal(id);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const { data: historyMessages } = useCopilotHistory(id, sessionId);

  // Modal states for 1-click swap and wizard
  const [selectedActivityForSwap, setSelectedActivityForSwap] = useState<ItineraryActivity | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPrefilledDestination, setWizardPrefilledDestination] = useState<string>('');
  // Copilot Drawer state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{
      sender: 'ai' | 'user';
      text: string;
      action?: {
        type: 'CREATE_NEW_TRIP';
        destination: string;
      };
      appliedTool?: {
        name: string;
        resultMessage: string;
      };
      proposal?: CopilotProposal;
      proposalStatus?: 'PENDING' | 'APPLIED' | 'REJECTED';
    }>
  >([
    {
      sender: 'ai',
      text: 'Chào bạn! Tôi là Genie Copilot. Tôi có thể giúp bạn đề xuất đổi quán ăn/điểm tham quan, hoán đổi thứ tự ngày hoặc giải đáp mọi thắc mắc về lịch trình!',
    },
  ]);
  const [copilotInput, setCopilotInput] = useState('');

  const isHistoryLoadedRef = useRef(false);

  // Sync historical messages if existing (only once on initial load, prevent overwriting active conversation)
  useEffect(() => {
    if (!isHistoryLoadedRef.current && historyMessages && historyMessages.length > 0) {
      isHistoryLoadedRef.current = true;
      setCopilotMessages(
        historyMessages.map((m) => ({
          sender: m.sender === 'user' ? 'user' : 'ai',
          text: m.content,
          proposal: m.proposal,
          proposalStatus: m.proposalStatus || (m.proposal ? 'PENDING' : undefined),
        }))
      );
    }
  }, [historyMessages]);

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

  // Preview place for map inspection (from Copilot proposals or chat place cards)
  const [previewPlace, setPreviewPlace] = useState<DiscoveryPlace | null>(null);

  const finalMapPlaces = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return mapPlaces;
    if (mapPlaces.some((p) => p.id === previewPlace.id)) return mapPlaces;
    return [...mapPlaces, previewPlace];
  }, [mapPlaces, previewPlace, selectedPlaceId]);

  const finalMarkerLabels = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return markerLabels;
    return { ...markerLabels, [previewPlace.id]: '✨' };
  }, [markerLabels, previewPlace, selectedPlaceId]);

  const finalMarkerColors = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return markerColors;
    return { ...markerColors, [previewPlace.id]: '#0D9488' };
  }, [markerColors, previewPlace, selectedPlaceId]);

  const mapCenter = useMemo(() => {
    return finalMapPlaces[0]
      ? { latitude: finalMapPlaces[0].latitude, longitude: finalMapPlaces[0].longitude }
      : { latitude: 16.0544, longitude: 108.2022 };
  }, [finalMapPlaces]);

  const transitName = data?.intercityTransit?.mode
    ? TRANSIT_MODE_LABELS[data.intercityTransit.mode] || data.intercityTransit.mode
    : 'Máy bay';

  // Micro-AI handlers
  function handleSwapPlace(placeId: string, activity?: ItineraryActivity) {
    const act =
      activity ||
      days.flatMap((d) => d.activities).find((a) => a.placeId === placeId) ||
      null;
    setSelectedActivityForSwap(act);
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

  async function handleSendCopilot(textToSend?: string) {
    const msg = (textToSend || copilotInput).trim();
    if (!msg || chatMutation.isPending) return;

    setCopilotMessages((prev) => [...prev, { sender: 'user', text: msg }]);
    setCopilotInput('');

    try {
      const res = await chatMutation.mutateAsync({ message: msg, sessionId });
      if (res.sessionId) {
        setSessionId(res.sessionId);
      }

      if (res.modified && res.itinerary?.days) {
        setDays(res.itinerary.days);
        toast.success('AI đã tự động cập nhật lịch trình của bạn!');
      }

      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.reply,
          action: res.action,
          appliedTool: res.appliedTool
            ? {
                name: res.appliedTool.name,
                resultMessage: res.appliedTool.resultMessage,
              }
            : undefined,
          proposal: res.proposal,
          proposalStatus: res.proposal ? 'PENDING' : undefined,
        },
      ]);
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi khi trò chuyện với Genie Copilot.');
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Xin lỗi bạn, kết nối tới Genie AI đang gặp sự cố. Vui lòng thử lại sau giây lát!',
        },
      ]);
    }
  }

  const handleConfirmProposal = async (msgIndex: number, proposal: CopilotProposal) => {
    try {
      setApplyingProposalId(proposal.id);
      const res = await applyProposalMutation.mutateAsync({
        toolName: proposal.toolName,
        args: proposal.args,
        proposalId: proposal.id,
      });

      if (res.itinerary?.days) {
        setDays(res.itinerary.days);
      }
      toast.success(res.message || 'Đã cập nhật lịch trình thành công!');

      setCopilotMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex ? { ...msg, proposalStatus: 'APPLIED' } : msg
        )
      );
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật lịch trình. Vui lòng thử lại!');
    } finally {
      setApplyingProposalId(null);
    }
  };

  const handleRejectProposal = (msgIndex: number) => {
    setCopilotMessages((prev) =>
      prev.map((msg, idx) =>
        idx === msgIndex ? { ...msg, proposalStatus: 'REJECTED' } : msg
      )
    );
    toast.info('Đã giữ nguyên lịch trình hiện tại.');
  };

  const handleResetSession = () => {
    setSessionId(undefined);
    setCopilotMessages([
      {
        sender: 'ai',
        text: 'Chào bạn! Tôi là Genie Copilot. Tôi có thể giúp bạn đề xuất đổi quán ăn/điểm tham quan, hoán đổi thứ tự ngày hoặc giải đáp mọi thắc mắc về lịch trình!',
      },
    ]);
    toast.info('Đã làm mới phiên trò chuyện Copilot.');
  };

  const handleLocatePlaceOnMap = async (target: LocatePlaceTarget) => {
    const cleanName = target.name.toLowerCase().trim();

    // 1. Check if place already exists in visible days (mapPlaces)
    const existing = mapPlaces.find(
      (p) =>
        (target.id && p.id === target.id) ||
        p.name.toLowerCase().includes(cleanName) ||
        cleanName.includes(p.name.toLowerCase())
    );

    if (existing) {
      setSelectedPlaceId(existing.id);
      if (mobileTab === 'timeline') setMobileTab('map');
      toast.success(`Đang mở vị trí "${existing.name}" trên bản đồ!`);
      return;
    }

    // 2. If target has exact coordinates (e.g. from Copilot proposal)
    if (target.latitude && target.longitude) {
      const previewId = target.id || `preview-${Date.now()}`;
      const previewItem: DiscoveryPlace = {
        id: previewId,
        slug: previewId,
        name: target.name,
        category: 'itinerary',
        categoryLabel: target.categoryName || 'Đề xuất đổi',
        areaSlug: '',
        areaName: data?.destination || '',
        address: target.address || '',
        latitude: target.latitude,
        longitude: target.longitude,
        rating: target.rating ?? 4.8,
        reviewCount: 60,
        priceLevel: 2,
        isOpenNow: true,
        primaryImage: target.imageUrl || null,
        images: target.imageUrl ? [target.imageUrl] : [],
        phone: null,
        website: null,
        openingHours: null,
        tags: [],
      };
      setPreviewPlace(previewItem);
      setSelectedPlaceId(previewId);
      if (mobileTab === 'timeline') setMobileTab('map');
      toast.success(`Đang mở vị trí "${target.name}" trên bản đồ!`);
      return;
    }

    // 3. Fallback: Search in backend places database by name
    try {
      const res = await placeService.searchPlaces({ keyword: target.name, limit: 1 });
      if (res.places && res.places.length > 0) {
        const found = res.places[0];
        const previewItem: DiscoveryPlace = {
          id: found.id,
          slug: found.slug,
          name: found.name,
          category: found.category || 'itinerary',
          categoryLabel: found.categoryLabel || 'Điểm đến',
          areaSlug: '',
          areaName: found.city || data?.destination || '',
          address: found.address || '',
          latitude: found.latitude,
          longitude: found.longitude,
          rating: found.rating ?? 4.8,
          reviewCount: found.reviewCount ?? 50,
          priceLevel: found.priceLevel ?? 2,
          isOpenNow: true,
          primaryImage: found.coverImage || null,
          images: found.images || [],
          phone: found.phone || null,
          website: found.website || null,
          openingHours: found.openingHoursText || null,
          tags: found.tags || [],
        };
        setPreviewPlace(previewItem);
        setSelectedPlaceId(found.id);
        if (mobileTab === 'timeline') setMobileTab('map');
        toast.success(`Đang mở vị trí "${found.name}" trên bản đồ!`);
      } else {
        toast.info(`Chưa có tọa độ chính xác của "${target.name}".`);
      }
    } catch {
      toast.info(`Đang cập nhật vị trí "${target.name}"...`);
    }
  };

  const handleSelectPlace = (placeId: string | null) => {
    setSelectedPlaceId(placeId);
    if (!placeId || (previewPlace && placeId !== previewPlace.id)) {
      setPreviewPlace(null);
    }
  };

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

  const fallbackCoverPhoto =
    data.destination?.toLowerCase().includes('đà lạt')
      ? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80'
      : data.destination?.toLowerCase().includes('phú quốc')
      ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80';
  const activeCoverPhoto = data.coverPhoto || fallbackCoverPhoto;

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
              src={activeCoverPhoto}
              alt={data.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />

            <Link
              href="/planner"
              className="absolute top-4 left-4 size-9 rounded-full bg-white/90 backdrop-blur text-slate-700 hover:text-slate-950 hover:bg-white flex items-center justify-center transition-all shadow-sm z-10"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="size-5" />
            </Link>

            {/* Edit Cover Photo Button */}
            <button
              type="button"
              onClick={() => setIsCoverModalOpen(true)}
              className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md text-xs font-semibold shadow-md transition-all cursor-pointer border border-white/20 hover:scale-105 active:scale-95 z-10"
              title="Chỉnh sửa ảnh bìa lịch trình"
            >
              <Camera className="size-3.5" />
              <span>Đổi ảnh bìa</span>
            </button>

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

            {/* Timeline Stream */}
            <ItineraryTimeline
              days={visibleDays}
              transit={data.intercityTransit}
              startDate={data.startDate}
              endDate={data.endDate}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={(placeId) => {
                handleSelectPlace(placeId);
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
                  places={finalMapPlaces}
                  center={mapCenter}
                  markerLabels={finalMarkerLabels}
                  markerColors={finalMarkerColors}
                  pathLine={roadPolyline.length > 0 ? roadPolyline : pathLine}
                  pathSegments={pathSegments}
                  selectedPlaceId={selectedPlaceId}
                  hoveredPlaceId={hoveredPlaceId}
                  onSelectPlace={handleSelectPlace}
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
      {/* Floating Copilot Bubble Launcher (Messenger Style) */}
      {!isCopilotOpen && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            type="button"
            onClick={() => setIsCopilotOpen(true)}
            className="relative size-14 sm:size-15 rounded-full bg-gradient-to-tr from-teal-500 via-emerald-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-teal-600/30 hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white/90"
            aria-label="Mở Genie Copilot"
          >
            {/* Ambient Animated Glow Ring */}
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-teal-400 to-indigo-400 opacity-60 blur-xs group-hover:opacity-90 animate-pulse" />

            {/* Inner Content */}
            <div className="relative flex items-center justify-center">
              <Bot className="size-7 transition-transform group-hover:scale-110" />
              <Sparkles className="size-3.5 absolute -top-1.5 -right-1.5 text-amber-300 animate-spin" />
            </div>

            {/* Active Online Pulse Indicator */}
            <span className="absolute top-0 right-0 size-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs flex items-center justify-center">
              <span className="size-2 rounded-full bg-white animate-ping" />
            </span>
          </button>

          {/* Floating Pill Label Tooltip on Hover */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Genie Copilot
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-slate-900/90" />
          </div>
        </div>
      )}

      {/* Modern Slide-over AI Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        destination={data.destination || 'Đà Nẵng'}
        messages={copilotMessages}
        isPending={chatMutation.isPending}
        onSendMessage={handleSendCopilot}
        onConfirmProposal={handleConfirmProposal}
        onRejectProposal={handleRejectProposal}
        applyingProposalId={applyingProposalId}
        onOpenWizard={(dest) => {
          setWizardPrefilledDestination(dest);
          setIsWizardOpen(true);
        }}
        onResetSession={handleResetSession}
        prefilledInput={copilotInput}
        onClearPrefilledInput={() => setCopilotInput('')}
        onLocatePlaceOnMap={handleLocatePlaceOnMap}
      />

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

      {/* 1-Click Alternative Places Modal (Hybrid Model) */}
      <PlaceAlternativesModal
        itineraryId={id}
        activity={selectedActivityForSwap}
        isOpen={Boolean(selectedActivityForSwap)}
        onClose={() => setSelectedActivityForSwap(null)}
        onSelectAlternative={async (newPlaceId) => {
          if (!selectedActivityForSwap) return;
          const destId = selectedActivityForSwap.id || selectedActivityForSwap.placeId;
          try {
            const updated = await directSwapMutation.mutateAsync({
              destinationId: destId,
              newPlaceId,
            });
            if (updated?.days) {
              setDays(updated.days);
            }
            toast.success('Đã đổi địa điểm thành công!');
            setSelectedActivityForSwap(null);
          } catch (err: any) {
            toast.error(err?.message || 'Không thể đổi địa điểm. Vui lòng thử lại!');
          }
        }}
        onAskCopilot={(placeName) => {
          setSelectedActivityForSwap(null);
          setIsCopilotOpen(true);
          setCopilotInput(`Gợi ý cho tôi địa điểm tương đương để thay thế cho "${placeName}"`);
        }}
      />

      {/* New Trip Wizard Modal (Triggered by Copilot when changing destination) */}
      <ItineraryWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        initialDestination={wizardPrefilledDestination}
      />

      {/* Cover Photo Customization Modal */}
      <CoverPhotoModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        currentCover={activeCoverPhoto}
        onSave={handleSaveCoverPhoto}
        isSaving={updateCoverMutation.isPending}
      />
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
