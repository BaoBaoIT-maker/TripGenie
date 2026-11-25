'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { pickLocalizedName, useI18n } from '@/i18n';
import { placeService } from '@/services/place.service';
import { fetchDailyRouteSegments, type Coordinate } from '@/services/routing.service';
import { getDayColor, type DiscoveryPlace, type ItineraryPathSegment } from '@/features/map/types';
import {
  DEFAULT_MAP_CENTER,
  PARTY_SIZE_BOUNDS,
  getDestinationCover,
  type WorkspaceTabKey,
} from '../../constants/itinerary.constants';
import {
  useAddDestination,
  useApplyProposal,
  useCloneItinerary,
  useCopilotChat,
  useCopilotHistory,
  useDeleteItinerary,
  useDirectSwapActivity,
  useItineraryQuery,
  useItineraryWeatherQuery,
  useMoveDestination,
  useRemoveDestination,
  useUpdateCoverPhoto,
  useUpdateDestination,
  useUpdateItineraryMeta,
  useUpdateTourBriefing,
  useUpdateTransitMode,
} from '../../hooks/use-itinerary-planner';
import { useTripCompanions } from '../../hooks/use-trip-companions';
import { useCreateGroupProposal, useTripProposals } from '../../hooks/use-trip-proposals';
import { useItineraryLiveEvents } from '../../hooks/use-itinerary-live-events';
import ItineraryWizardModal from '../ItineraryWizardModal';
import { PlaceSearchDialog, type PlaceSearchMode } from '../PlaceSearchDialog';
import { TripCompanionCard } from '../companions/TripCompanionCard';
import { TripCompanionsPanel } from '../companions/TripCompanionsPanel';
import { TripProposalsPanel } from '../companions/TripProposalsPanel';
import BudgetBreakdownCard from './BudgetBreakdownCard';
import CopilotDrawer, { type CopilotMessageItem, type LocatePlaceTarget } from './CopilotDrawer';
import CoverPhotoModal from './CoverPhotoModal';
import { EditDestinationDialog } from './EditDestinationDialog';
import { EditItineraryMetaDialog } from './EditItineraryMetaDialog';
import { ItineraryHeroHeader } from './ItineraryHeroHeader';
import ItineraryMap from './ItineraryMap';
import { ItineraryPrintSheet } from './ItineraryPrintSheet';
import ItineraryTimeline from './ItineraryTimeline';
import { MobileItineraryMapCarousel, type MobileItineraryStop } from './MobileItineraryMapCarousel';
import { ModalCopilotAssist } from './ModalCopilotAssist';
import PlaceAlternativesModal from './PlaceAlternativesModal';
import { LodgingPickerDialog } from './LodgingPickerDialog';
import { TourBriefingBanner } from './TourBriefingBanner';
import { TourBriefingPrintModal } from './TourBriefingPrintModal';
import {
  DEFAULT_PRINT_SHEET_OPTIONS,
  EMPTY_TOUR_BRIEFING,
  type PrintSheetOptions,
} from './tour-briefing';
import type {
  CopilotProposal,
  ItineraryActivity,
  MoveDirection,
  TourBriefing,
  TransitMode,
  UpdateDestinationRequest,
  UpdateItineraryMetaRequest,
} from '@/types/itinerary';
import type { Place } from '@/types/place';

interface Props {
  id: string;
}

interface PlaceSearchModalState {
  open: boolean;
  mode: PlaceSearchMode;
  dayNumber: number;
  destinationId?: string;
  targetStopName?: string;
}

const PRICE_LEVEL_NUMERIC: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  LUXURY: 4,
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
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { data, isLoading, error } = useItineraryQuery(id);
  const { data: weatherData } = useItineraryWeatherQuery(id);

  // Live real-time collaboration events stream
  useItineraryLiveEvents(id, user?.id, Boolean(data));

  // Access rights & collaborative roles
  const isOwner = Boolean(data?.isOwner);
  const canEdit = Boolean(data?.canEdit ?? isOwner);
  const canManageMembers = Boolean(data?.canManageMembers ?? isOwner);
  const isMemberOrOwner = Boolean(isOwner || data?.viewerRole);

  const { data: companionsData } = useTripCompanions(id, isMemberOrOwner);
  const { data: proposalsData } = useTripProposals(id, isMemberOrOwner);

  // Mutations
  const deleteMutation = useDeleteItinerary();
  const cloneMutation = useCloneItinerary();
  const updateTransitMutation = useUpdateTransitMode();
  const updateCoverMutation = useUpdateCoverPhoto(id);
  const updateTourBriefingMutation = useUpdateTourBriefing(id);
  const updateMetaMutation = useUpdateItineraryMeta(id);
  const moveDestinationMutation = useMoveDestination(id);
  const updateDestinationMutation = useUpdateDestination(id);
  const createProposalMutation = useCreateGroupProposal(id);
  const chatMutation = useCopilotChat(id);
  const directSwapMutation = useDirectSwapActivity(id);
  const applyProposalMutation = useApplyProposal(id);
  const addDestinationMutation = useAddDestination(id);
  const removeDestinationMutation = useRemoveDestination(id);

  // Workspace & navigation state
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('itinerary');
  const effectiveTab: WorkspaceTabKey =
    !isMemberOrOwner && (activeTab === 'voting' || activeTab === 'group') ? 'itinerary' : activeTab;
  const [dayScope, setDayScope] = useState<'all' | number>('all');
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [movingStopId, setMovingStopId] = useState<string | null>(null);

  // Modals & Drawers state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);
  const [isHeaderCompanionsOpen, setIsHeaderCompanionsOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<ItineraryActivity | null>(null);
  const [selectedActivityForSwap, setSelectedActivityForSwap] = useState<ItineraryActivity | null>(null);
  const [placeSearchState, setPlaceSearchState] = useState<PlaceSearchModalState | null>(null);
  const [lodgingPickerNight, setLodgingPickerNight] = useState<number | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPrefilledDestination, setWizardPrefilledDestination] = useState('');

  // Print & Tour Briefing Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [draftOverride, setDraftOverride] = useState<TourBriefing | null>(null);
  const [printOptions, setPrintOptions] = useState<PrintSheetOptions>(DEFAULT_PRINT_SHEET_OPTIONS);
  const draftBriefing = draftOverride ?? data?.tourBriefing ?? EMPTY_TOUR_BRIEFING;

  // Copilot state
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const { data: historyMessages } = useCopilotHistory(id, sessionId, isMemberOrOwner);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessageItem[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const isHistoryLoadedRef = useRef(false);

  const displayedCopilotMessages: CopilotMessageItem[] = useMemo(() => {
    if (copilotMessages.length > 0) return copilotMessages;
    return [{ sender: 'ai', text: t('planner.view.initialCopilotGreeting') }];
  }, [copilotMessages, t]);

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

  useEffect(() => {
    if (!selectedPlaceId || effectiveTab !== 'itinerary') return;
    const cardEl = document.getElementById(`itinerary-activity-${selectedPlaceId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPlaceId, effectiveTab]);

  const days = useMemo(() => data?.days ?? [], [data?.days]);
  const totalDays = data?.totalDays || days.length || 3;
  const totalNights = Math.max(0, totalDays - 1);

  const visibleDays = useMemo(
    () => (dayScope === 'all' ? days : days.filter((d) => d.dayNumber === dayScope)),
    [days, dayScope]
  );

  // Members & pending group proposals derived counts
  const members = companionsData?.members?.length
    ? companionsData.members
    : (data?.members ?? []);
  const memberCount = data?.memberCount ?? (members.length || 1);

  const { pendingProposalsCount, pendingProposalCountByStop } = useMemo(() => {
    const list = proposalsData?.proposals ?? [];
    const byStop: Record<string, number> = {};
    let pendingCount = 0;

    for (const proposal of list) {
      if (proposal.status !== 'PENDING') continue;
      pendingCount += 1;
      if (proposal.destinationId) {
        byStop[proposal.destinationId] = (byStop[proposal.destinationId] ?? 0) + 1;
      }
    }

    return {
      pendingProposalsCount: pendingCount,
      pendingProposalCountByStop: byStop,
    };
  }, [proposalsData?.proposals]);

  // Road Routing Segments per day (OSRM)
  const [pathSegments, setPathSegments] = useState<ItineraryPathSegment[]>([]);
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    let active = true;

    async function computeDailySegments() {
      const dayInputs = visibleDays.map((day) => {
        const stopCoords: Coordinate[] = day.activities
          .filter((a): a is ItineraryActivity => a.latitude != null && a.longitude != null)
          .map((a) => ({ latitude: Number(a.latitude), longitude: Number(a.longitude) }));

        const lodgingCoord: Coordinate | null =
          day.lodging &&
          Number.isFinite(Number(day.lodging.latitude)) &&
          Number.isFinite(Number(day.lodging.longitude))
            ? {
                latitude: Number(day.lodging.latitude),
                longitude: Number(day.lodging.longitude),
              }
            : null;

        const coords: Coordinate[] = [
          ...(lodgingCoord && stopCoords.length > 0 ? [lodgingCoord] : []),
          ...stopCoords,
          ...(lodgingCoord && !day.lodging?.isCheckOutDay && stopCoords.length > 0
            ? [lodgingCoord]
            : []),
        ];

        const unique: Coordinate[] = [];
        for (const c of coords) {
          const prev = unique[unique.length - 1];
          if (
            !prev ||
            Math.abs(prev.latitude - c.latitude) > 0.0002 ||
            Math.abs(prev.longitude - c.longitude) > 0.0002
          ) {
            unique.push(c);
          }
        }

        return {
          dayNumber: day.dayNumber,
          color: getDayColor(day.dayNumber),
          points: unique,
        };
      });

      const colorByDay = new Map(dayInputs.map((d) => [d.dayNumber, d.color]));
      const resolvedRoutes = await fetchDailyRouteSegments(dayInputs, 'motorcycle');

      if (!active) return;

      const segments: ItineraryPathSegment[] = [];
      const flatCoords: [number, number][] = [];
      for (const route of resolvedRoutes) {
        segments.push({
          dayNumber: route.dayNumber,
          color: colorByDay.get(route.dayNumber) ?? getDayColor(route.dayNumber),
          coordinates: route.coordinates,
        });
        flatCoords.push(...route.coordinates);
      }

      setPathSegments(segments);
      setRoadPolyline(flatCoords);
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

    const addedLodgingIds = new Set<string>();
    visibleDays.forEach((d) => {
      const dayColor = getDayColor(d.dayNumber);
      if (
        d.lodging &&
        !addedLodgingIds.has(d.lodging.placeId) &&
        Number.isFinite(Number(d.lodging.latitude)) &&
        Number.isFinite(Number(d.lodging.longitude))
      ) {
        addedLodgingIds.add(d.lodging.placeId);
        labels[d.lodging.placeId] = 'H';
        colors[d.lodging.placeId] = '#0194F3';
        places.push({
          id: d.lodging.placeId,
          slug: d.lodging.placeId,
          name: d.lodging.name,
          category: 'stay',
          categoryLabel: t('planner.lodging.dialogTitle'),
          areaSlug: '',
          areaName: data?.destination || '',
          address: d.lodging.address ?? '',
          latitude: Number(d.lodging.latitude),
          longitude: Number(d.lodging.longitude),
          rating: d.lodging.ratingAvg ?? null,
          reviewCount: d.lodging.reviewCount ?? 0,
          priceLevel: d.lodging.priceLevel
            ? (PRICE_LEVEL_NUMERIC[d.lodging.priceLevel] ?? 2)
            : null,
          isOpenNow: true,
          primaryImage: d.lodging.imageUrl,
          images: d.lodging.imageUrl ? [d.lodging.imageUrl] : [],
          phone: null,
          website: null,
          openingHours: null,
          tags: [],
        });
      }
      d.activities.forEach((a) => {
        if (a.latitude != null && a.longitude != null) {
          labels[a.placeId] = String(counter++);
          colors[a.placeId] = dayColor;
          places.push({
            id: a.placeId,
            slug: a.placeId,
            name: a.placeName,
            category: 'itinerary',
            categoryLabel: a.categoryName ?? t('planner.common.destinationFallback'),
            areaSlug: '',
            areaName: data?.destination || '',
            address: a.address ?? '',
            latitude: Number(a.latitude),
            longitude: Number(a.longitude),
            rating: a.ratingAvg ?? null,
            reviewCount: a.reviewCount ?? 0,
            priceLevel: a.priceLevel ? (PRICE_LEVEL_NUMERIC[a.priceLevel] ?? 2) : null,
            isOpenNow: a.openingStatus ? a.openingStatus.state === 'OPEN' : null,
            primaryImage: a.thumbnailUrl ?? a.imageUrl,
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
  }, [visibleDays, data?.destination, t]);

  // Preview place for map inspection (Copilot proposals or chat place cards)
  const [previewPlace, setPreviewPlace] = useState<DiscoveryPlace | null>(null);

  const finalMapPlaces = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return mapPlaces;
    if (mapPlaces.some((p) => p.id === previewPlace.id)) return mapPlaces;
    return [...mapPlaces, previewPlace];
  }, [mapPlaces, previewPlace, selectedPlaceId]);

  const finalMarkerLabels = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return markerLabels;
    return { ...markerLabels, [previewPlace.id]: '★' };
  }, [markerLabels, previewPlace, selectedPlaceId]);

  const finalMarkerColors = useMemo(() => {
    if (!previewPlace || selectedPlaceId !== previewPlace.id) return markerColors;
    return { ...markerColors, [previewPlace.id]: '#0194F3' };
  }, [markerColors, previewPlace, selectedPlaceId]);

  const mapCenter = useMemo(
    () =>
      finalMapPlaces[0]
        ? { latitude: finalMapPlaces[0].latitude, longitude: finalMapPlaces[0].longitude }
        : DEFAULT_MAP_CENTER,
    [finalMapPlaces]
  );

  const finalPathLine = useMemo(
    () => (roadPolyline.length > 0 ? roadPolyline : pathLine),
    [roadPolyline, pathLine]
  );

  // Synchronized stop list for mobile map carousel preview
  const mobileMapStops: MobileItineraryStop[] = useMemo(() => {
    const list: MobileItineraryStop[] = [];
    visibleDays.forEach((d) => {
      d.activities.forEach((act) => {
        if (act.latitude != null && act.longitude != null) {
          list.push({
            placeId: act.placeId,
            placeName: act.placeName,
            categoryLabel: act.categoryName || t('planner.common.destinationFallback'),
            address: act.address ?? '',
            imageUrl: act.thumbnailUrl ?? act.imageUrl,
            rating: act.ratingAvg,
            stopNumber: finalMarkerLabels[act.placeId] || '',
            stopColor: finalMarkerColors[act.placeId] || '#0194F3',
            timeSlot: act.startTime && act.endTime ? `${act.startTime} – ${act.endTime}` : undefined,
            dayNumber: d.dayNumber,
          });
        }
      });
    });
    return list;
  }, [visibleDays, finalMarkerLabels, finalMarkerColors, t]);

  const transitName = data?.intercityTransit?.mode
    ? t(`planner.transitModes.${data.intercityTransit.mode}`)
    : t('planner.transitModes.FLIGHT');

  // Core Itinerary Handlers
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('planner.view.toasts.deleteSuccess'));
      router.push('/planner');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.deleteError'));
    }
  };

  const handleClone = async () => {
    if (!user) {
      toast.error(t('planner.view.toasts.cloneLoginRequired'));
      router.push('/login');
      return;
    }
    try {
      const cloned = await cloneMutation.mutateAsync(id);
      setShowCloneModal(false);
      toast.success(t('planner.view.toasts.cloneSuccess'));
      router.push(`/itineraries/${cloned.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.cloneError'));
    }
  };

  const { mutateAsync: updateTransitAsync } = updateTransitMutation;
  const handleUpdateTransitMode = useCallback(
    async (newMode: TransitMode) => {
      try {
        await updateTransitAsync({ id, transitMode: newMode });
        toast.success(t('planner.view.toasts.transitUpdated'));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.transitError'));
      }
    },
    [id, updateTransitAsync, t]
  );

  const handleSaveCoverPhoto = async (newCoverUrl: string) => {
    try {
      await updateCoverMutation.mutateAsync(newCoverUrl);
      toast.success(t('planner.view.toasts.coverUpdated'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.coverError'));
      throw err;
    }
  };

  const handleSaveTourBriefing = async (briefing: TourBriefing) => {
    await updateTourBriefingMutation.mutateAsync(briefing);
    setDraftOverride(null);
  };

  const handleClosePrintModal = () => {
    setIsPrintModalOpen(false);
    setDraftOverride(null);
  };

  const { mutateAsync: updateMetaAsync, isPending: isUpdatingMeta } = updateMetaMutation;
  const handleUpdatePartySize = useCallback(
    async (nextSize: number) => {
      if (!isOwner || isUpdatingMeta) return;
      const clamped = Math.min(PARTY_SIZE_BOUNDS.MAX, Math.max(PARTY_SIZE_BOUNDS.MIN, nextSize));
      try {
        await updateMetaAsync({ partySize: clamped });
        toast.success(t('planner.view.toasts.partySizeUpdated', { count: clamped }));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.partySizeError'));
      }
    },
    [isOwner, isUpdatingMeta, updateMetaAsync, t]
  );

  const handleSubmitEditMeta = useCallback(
    async (dto: UpdateItineraryMetaRequest) => {
      setIsEditMetaOpen(false);
      setIsRefreshingSchedule(true);
      try {
        await updateMetaAsync(dto);
        toast.success(t('planner.view.toasts.metaUpdated'));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.metaError'));
        throw err;
      } finally {
        setIsRefreshingSchedule(false);
      }
    },
    [updateMetaAsync, t]
  );

  const { mutateAsync: updateDestinationAsync } = updateDestinationMutation;
  const handleSubmitEditDestination = useCallback(
    async (destinationId: string, dto: UpdateDestinationRequest) => {
      try {
        await updateDestinationAsync({ destinationId, dto });
        toast.success(t('planner.view.toasts.stopUpdated'));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.stopUpdateError'));
        throw err;
      }
    },
    [updateDestinationAsync, t]
  );

  const { mutateAsync: moveDestinationAsync } = moveDestinationMutation;
  const handleMoveStop = useCallback(
    async (destinationId: string, direction: MoveDirection) => {
      if (movingStopId) return;
      setMovingStopId(destinationId);
      try {
        await moveDestinationAsync({ destinationId, direction });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.stopMoveError'));
      } finally {
        setMovingStopId(null);
      }
    },
    [moveDestinationAsync, movingStopId, t]
  );

  // Stop Swap / Delete / Add / Propose Handlers
  const handleSwapPlace = useCallback(
    (placeId: string, activity?: ItineraryActivity) => {
      const act =
        activity || days.flatMap((d) => d.activities).find((a) => a.placeId === placeId) || null;
      setSelectedActivityForSwap(act);
    },
    [days]
  );

  const { mutateAsync: removeDestinationAsync } = removeDestinationMutation;
  const handleDeletePlace = useCallback(
    async (placeId: string, activity?: ItineraryActivity) => {
      const act =
        activity || days.flatMap((d) => d.activities).find((a) => a.placeId === placeId);
      if (!act) return;
      if (!act.id) {
        toast.error(t('planner.view.toasts.stopNoRecordDelete'));
        return;
      }
      if (
        !window.confirm(
          t('planner.view.toasts.stopDeleteConfirm', {
            name: act.placeName || t('planner.copilot.assist.thisStopFallback'),
          })
        )
      ) {
        return;
      }
      try {
        await removeDestinationAsync(act.id);
        toast.success(t('planner.view.toasts.stopDeleted', { name: act.placeName }));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('planner.view.toasts.stopDeleteError'));
      }
    },
    [days, removeDestinationAsync, t]
  );

  const handleAddPlace = useCallback((dayNumber: number) => {
    setPlaceSearchState({ open: true, mode: 'add', dayNumber });
  }, []);

  const handleProposeNewForDay = useCallback((dayNumber: number) => {
    setPlaceSearchState({ open: true, mode: 'propose-new', dayNumber });
  }, []);

  const handleProposeSwap = useCallback(
    (placeId: string, activity?: ItineraryActivity) => {
      const act =
        activity || days.flatMap((d) => d.activities).find((a) => a.placeId === placeId);
      if (!act?.id) {
        toast.error(t('planner.view.toasts.stopNoRecordVote'));
        return;
      }
      const ownerDay = days.find((d) =>
        d.activities.some((a) => a.id === act.id || a.placeId === act.placeId)
      );
      setPlaceSearchState({
        open: true,
        mode: 'propose-swap',
        dayNumber: ownerDay?.dayNumber ?? 1,
        destinationId: act.id,
        targetStopName: act.placeName,
      });
    },
    [days, t]
  );

  const handleDirectAddPlace = async (place: Place) => {
    const dayNumber = placeSearchState?.dayNumber ?? days[0]?.dayNumber ?? 1;
    try {
      await addDestinationMutation.mutateAsync({ placeId: place.id, dayNumber });
      toast.success(t('planner.view.toasts.stopAdded', { name: place.name, day: dayNumber }));
      setPlaceSearchState(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.stopAddError'));
    }
  };

  const handleCreateProposalFromSearch = async (payload: {
    place: Place;
    dayNumber: number;
    proposedStartTime?: string;
    notes?: string;
  }) => {
    if (!placeSearchState) return;
    const isSwap = placeSearchState.mode === 'propose-swap' && Boolean(placeSearchState.destinationId);
    await createProposalMutation.mutateAsync({
      placeId: payload.place.id,
      destinationId: isSwap ? placeSearchState.destinationId : undefined,
      dayNumber: payload.dayNumber,
      proposedStartTime: payload.proposedStartTime,
      notes: payload.notes,
    });
    setPlaceSearchState(null);
  };

  const handleAskCopilotFromModal = useCallback((prompt: string) => {
    setSelectedActivityForSwap(null);
    setPlaceSearchState(null);
    setIsCopilotOpen(true);
    setCopilotInput(prompt);
  }, []);

  // Copilot Drawer Handlers
  async function handleSendCopilot(textToSend?: string) {
    const msg = (textToSend || copilotInput).trim();
    if (!msg || chatMutation.isPending) return;

    setCopilotMessages((prev) => [
      ...(prev.length > 0 ? prev : [{ sender: 'ai' as const, text: t('planner.view.initialCopilotGreeting') }]),
      { sender: 'user', text: msg },
    ]);
    setCopilotInput('');

    try {
      const res = await chatMutation.mutateAsync({
        message: msg,
        sessionId,
        autoApply: canEdit,
      });
      if (res.sessionId) {
        setSessionId(res.sessionId);
      }

      if (res.modified && res.itinerary?.days) {
        toast.success(t('planner.view.toasts.copilotAutoUpdated'));
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.copilotError'));
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: t('planner.view.toasts.copilotFallbackReply'),
        },
      ]);
    }
  }

  const handleConfirmProposal = async (msgIndex: number, proposal: CopilotProposal) => {
    try {
      setApplyingProposalId(proposal.id);
      await applyProposalMutation.mutateAsync({
        toolName: proposal.toolName,
        args: proposal.args,
        proposalId: proposal.id,
      });

      toast.success(t('planner.view.toasts.proposalApplied'));

      setCopilotMessages((prev) =>
        prev.map((msg, idx) => (idx === msgIndex ? { ...msg, proposalStatus: 'APPLIED' } : msg))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('planner.view.toasts.proposalApplyError'));
    } finally {
      setApplyingProposalId(null);
    }
  };

  const handleRejectProposal = (msgIndex: number) => {
    setCopilotMessages((prev) =>
      prev.map((msg, idx) => (idx === msgIndex ? { ...msg, proposalStatus: 'REJECTED' } : msg))
    );
    toast.info(t('planner.view.toasts.proposalRejected'));
  };

  const handleResetSession = () => {
    setSessionId(undefined);
    setCopilotMessages([]);
    toast.info(t('planner.view.toasts.sessionReset'));
  };

  // Map inspection & jump handlers
  const handleSelectPlace = useCallback((placeId: string | null) => {
    setSelectedPlaceId(placeId);
    setPreviewPlace((prev) => (prev && (!placeId || placeId !== prev.id) ? null : prev));
  }, []);

  const handleSelectTimelinePlace = useCallback(
    (placeId: string) => {
      handleSelectPlace(placeId);
      setMobileTab((prev) => (prev === 'timeline' ? 'map' : prev));
    },
    [handleSelectPlace]
  );

  const handleJumpToStop = useCallback((placeId: string) => {
    setActiveTab('itinerary');
    setDayScope('all');
    setSelectedPlaceId(placeId);
    setMobileTab('timeline');
  }, []);

  const handleLocatePlaceOnMap = async (target: LocatePlaceTarget) => {
    const cleanName = target.name.toLowerCase().trim();

    const existing = mapPlaces.find(
      (p) =>
        (target.id && p.id === target.id) ||
        p.name.toLowerCase().includes(cleanName) ||
        cleanName.includes(p.name.toLowerCase())
    );

    if (existing) {
      setActiveTab('itinerary');
      setSelectedPlaceId(existing.id);
      if (mobileTab === 'timeline') setMobileTab('map');
      toast.success(t('planner.view.toasts.openingOnMap', { name: existing.name }));
      return;
    }

    if (target.latitude && target.longitude) {
      const previewId = target.id || `preview-${Date.now()}`;
      const previewItem: DiscoveryPlace = {
        id: previewId,
        slug: previewId,
        name: target.name,
        category: 'itinerary',
        categoryLabel: target.categoryName || t('planner.view.proposedSwapLabel'),
        areaSlug: '',
        areaName: data?.destination || '',
        address: target.address || '',
        latitude: target.latitude,
        longitude: target.longitude,
        rating: target.rating ?? null,
        reviewCount: 0,
        priceLevel: null,
        isOpenNow: null,
        primaryImage: target.imageUrl || null,
        images: target.imageUrl ? [target.imageUrl] : [],
        phone: null,
        website: null,
        openingHours: null,
        tags: [],
      };
      setPreviewPlace(previewItem);
      setActiveTab('itinerary');
      setSelectedPlaceId(previewId);
      if (mobileTab === 'timeline') setMobileTab('map');
      toast.success(t('planner.view.toasts.openingOnMap', { name: target.name }));
      return;
    }

    try {
      const res = await placeService.searchPlaces({ keyword: target.name, limit: 1 });
      if (res.places && res.places.length > 0) {
        const found = res.places[0];
        const previewItem: DiscoveryPlace = {
          id: found.id,
          slug: found.slug,
          name: found.name,
          category: found.category || 'itinerary',
          categoryLabel: found.categoryLabel || t('planner.common.destinationFallback'),
          areaSlug: '',
          areaName: found.city || data?.destination || '',
          address: found.address || '',
          latitude: found.latitude,
          longitude: found.longitude,
          rating: found.rating ?? null,
          reviewCount: found.reviewCount ?? 0,
          priceLevel: found.priceLevel ?? null,
          isOpenNow: null,
          primaryImage: found.coverImage || null,
          images: found.images || [],
          phone: found.phone || null,
          website: found.website || null,
          openingHours: found.openingHoursText || null,
          tags: found.tags || [],
        };
        setPreviewPlace(previewItem);
        setActiveTab('itinerary');
        setSelectedPlaceId(found.id);
        if (mobileTab === 'timeline') setMobileTab('map');
        toast.success(t('planner.view.toasts.openingOnMap', { name: found.name }));
      } else {
        toast.info(t('planner.view.toasts.noExactCoords', { name: target.name }));
      }
    } catch {
      toast.info(t('planner.view.toasts.updatingLocation', { name: target.name }));
    }
  };

  function handleShareLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('planner.view.toasts.linkCopied'));
    }
  }

  if (isLoading || isRefreshingSchedule) return <ItineraryViewSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8 bg-[#F8FAFC]">
        <ErrorState
          title={t('planner.view.notFoundTitle')}
          message={error instanceof Error ? error.message : t('planner.view.notFoundMessage')}
          onRetry={() => {
            router.push('/planner');
          }}
        />
      </div>
    );
  }

  const activeCoverPhoto = data.coverPhoto || getDestinationCover(data.destination);
  const hasTourBriefing = Boolean(
    data.tourBriefing &&
      (data.tourBriefing.leaderName ||
        data.tourBriefing.leaderPhone ||
        data.tourBriefing.meetingPoint ||
        data.tourBriefing.notes)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#10243A] pb-24 lg:pb-10 print:min-h-0 print:bg-white print:pb-0">
      <main className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-5 print:hidden">
        {/* 1. Hero Header & 4 Workspace Tabs */}
        <ItineraryHeroHeader
          data={data}
          activeCoverPhoto={activeCoverPhoto}
          totalDays={totalDays}
          totalNights={totalNights}
          isOwner={isOwner}
          canEdit={canEdit}
          isMemberOrOwner={isMemberOrOwner}
          memberCount={memberCount}
          members={members}
          pendingProposalsCount={pendingProposalsCount}
          activeTab={effectiveTab}
          onSelectTab={setActiveTab}
          onBack={() => router.push('/planner')}
          onOpenCoverModal={() => setIsCoverModalOpen(true)}
          onOpenEditMetaModal={() => setIsEditMetaOpen(true)}
          onOpenCompanionsModal={() => setIsHeaderCompanionsOpen(true)}
          onOpenPrintModal={() => setIsPrintModalOpen(true)}
          onShare={handleShareLink}
          onClone={() => setShowCloneModal(true)}
          onOpenDeleteModal={() => setShowDeleteModal(true)}
          onUpdatePartySize={handleUpdatePartySize}
          isCloning={cloneMutation.isPending}
          isUpdatingMeta={isUpdatingMeta}
        />

        {/* Public Viewer Notice */}
        {!isMemberOrOwner && (
          <div className="px-4 py-3 rounded-2xl bg-[#F0F7FF] border border-[#D0E7FF] flex flex-wrap items-center justify-between gap-2 text-xs text-[#10243A]">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-eye text-[#0194F3]" aria-hidden="true" />
              <span>
                {t('planner.view.publicReadOnlyPrefix')}{' '}
                <button
                  type="button"
                  onClick={() => setShowCloneModal(true)}
                  className="font-bold underline text-[#0194F3] hover:text-[#007AD0] cursor-pointer"
                >
                  {t('planner.view.publicReadOnlyCta')}
                </button>{' '}
                {t('planner.view.publicReadOnlySuffix')}
              </span>
            </span>
          </div>
        )}

        {/* 2. Workspace Tab Views */}
        {effectiveTab === 'itinerary' && (
          <div
            role="tabpanel"
            aria-label={t('planner.view.itineraryMapAria')}
            className="space-y-4"
          >
            {/* Sticky Day Selector Rail (Universal: visible across both timeline & map on mobile and desktop) */}
            <div className="sticky top-[66px] z-20 py-2 bg-[#F8FAFC]/95 backdrop-blur-md">
              <div
                role="tablist"
                aria-label={t('planner.view.daySelectorAria')}
                className="inline-flex items-center gap-1 p-1 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs max-w-full overflow-x-auto no-scrollbar"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={dayScope === 'all'}
                  onClick={() => setDayScope('all')}
                  className={`h-9 px-3.5 rounded-xl text-xs shrink-0 cursor-pointer inline-flex items-center gap-1.5 transition-all duration-150 select-none ${
                    dayScope === 'all'
                      ? 'bg-[#0194F3] text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-semibold'
                  }`}
                >
                  <span>{t('planner.view.allDays')}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums transition-colors ${
                      dayScope === 'all'
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-slate-100 text-slate-500 font-medium'
                    }`}
                  >
                    {t('planner.common.daysCount', { count: days.length })}
                  </span>
                </button>

                {days.map((day, idx) => {
                  const active = dayScope === day.dayNumber;
                  const shortDate = formatShortDate(data.startDate, idx);
                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDayScope(day.dayNumber)}
                      className={`h-9 px-3.5 rounded-xl text-xs shrink-0 cursor-pointer inline-flex items-center gap-1.5 transition-all duration-150 select-none ${
                        active
                          ? 'bg-[#0194F3] text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-semibold'
                      }`}
                    >
                      <span>{t('planner.common.day', { n: day.dayNumber })}</span>
                      {shortDate && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums transition-colors ${
                            active
                              ? 'bg-white/20 text-white font-bold'
                              : 'bg-slate-100 text-slate-500 font-medium'
                          }`}
                        >
                          {shortDate}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Timeline Stream */}
              <div
                className={`lg:col-span-6 space-y-4 ${
                  mobileTab === 'map' ? 'hidden lg:block' : 'block'
                }`}
              >
                <ItineraryTimeline
                  days={visibleDays}
                  transit={data.intercityTransit}
                  destination={pickLocalizedName(
                    {
                      name: data.areaName,
                      nameVi: data.areaNameVi,
                      translations: data.areaTranslations,
                    },
                    locale,
                    data.destination || '',
                  )}
                  startDate={data.startDate}
                  endDate={data.endDate}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={handleSelectTimelinePlace}
                  onSwapPlace={canEdit ? handleSwapPlace : undefined}
                  onDeletePlace={canEdit ? handleDeletePlace : undefined}
                  onAddPlace={canEdit ? handleAddPlace : undefined}
                  onChangeTransitMode={canEdit ? handleUpdateTransitMode : undefined}
                  isUpdatingTransitMode={updateTransitMutation.isPending}
                  weatherData={weatherData}
                  isCollapsibleDays={dayScope === 'all'}
                  isMemberOrOwner={isMemberOrOwner}
                  onEditStop={canEdit ? (act) => setEditingDestination(act) : undefined}
                  onMoveStop={canEdit ? handleMoveStop : undefined}
                  movingStopId={movingStopId}
                  onProposeSwap={isMemberOrOwner ? handleProposeSwap : undefined}
                  onProposeNewForDay={isMemberOrOwner ? handleProposeNewForDay : undefined}
                  pendingProposalCountByStop={pendingProposalCountByStop}
                  onOpenVotingTab={isMemberOrOwner ? () => setActiveTab('voting') : undefined}
                  onOpenLodgingPicker={
                    canEdit ? (night) => setLodgingPickerNight(night) : undefined
                  }
                />
              </div>

              {/* Right Column: Sticky Interactive Map */}
              <div
                className={`lg:col-span-6 lg:sticky lg:top-[128px] ${
                  mobileTab === 'timeline' ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="bg-white rounded-3xl border border-slate-200 p-2.5 shadow-xs">
                  <div className="relative w-full h-[620px] lg:h-[calc(100vh-190px)] min-h-[520px] rounded-2xl overflow-hidden">
                    <ItineraryMap
                      places={finalMapPlaces}
                      center={mapCenter}
                      markerLabels={finalMarkerLabels}
                      markerColors={finalMarkerColors}
                      pathLine={finalPathLine}
                      pathSegments={pathSegments}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={handleSelectPlace}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Map Carousel Overlay (Active only in mobile map view when stops exist) */}
        {effectiveTab === 'itinerary' && mobileTab === 'map' && mobileMapStops.length > 0 && (
          <div className="fixed bottom-20 inset-x-0 z-30 lg:hidden pointer-events-none">
            <MobileItineraryMapCarousel
              stops={mobileMapStops}
              selectedPlaceId={selectedPlaceId}
              onSelectStop={handleSelectPlace}
              onJumpToTimeline={handleJumpToStop}
              onNavigateDetail={(placeId) => router.push(`/places/${placeId}`)}
            />
          </div>
        )}

        {effectiveTab === 'budget' && (
          <div role="tabpanel" aria-label={t('planner.view.budgetAria')} className="max-w-5xl">
            {data.budgetBreakdown ? (
              <BudgetBreakdownCard
                breakdown={data.budgetBreakdown}
                days={days}
                transitModeName={transitName}
                totalDays={totalDays}
                isOwner={isOwner}
                isUpdatingPartySize={isUpdatingMeta}
                onUpdatePartySize={handleUpdatePartySize}
                onJumpToStop={handleJumpToStop}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <div className="size-11 rounded-2xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center mx-auto">
                  <i className="fa-solid fa-wallet text-base" aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-[#10243A]">{t('planner.view.noBudgetTitle')}</p>
                <p className="text-xs text-slate-500">{t('planner.view.noBudgetDesc')}</p>
              </div>
            )}
          </div>
        )}

        {effectiveTab === 'voting' && isMemberOrOwner && (
          <div role="tabpanel" aria-label={t('planner.view.votingAria')} className="max-w-4xl">
            <TripProposalsPanel
              itineraryId={id}
              days={days}
              canEdit={canEdit}
              isMemberOrOwner={isMemberOrOwner}
              currentUser={
                user
                  ? { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }
                  : null
              }
              onOpenCreateProposal={() =>
                setPlaceSearchState({
                  open: true,
                  mode: 'propose-new',
                  dayNumber: typeof dayScope === 'number' ? dayScope : (days[0]?.dayNumber ?? 1),
                })
              }
              onOpenCompanionsModal={() => setIsHeaderCompanionsOpen(true)}
            />
          </div>
        )}

        {effectiveTab === 'group' && isMemberOrOwner && (
          <div
            role="tabpanel"
            aria-label={t('planner.view.groupAria')}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            <div className="lg:col-span-7">
              {hasTourBriefing || isOwner ? (
                <TourBriefingBanner
                  briefing={data.tourBriefing}
                  isOwner={isOwner}
                  onOpenModal={() => setIsPrintModalOpen(true)}
                />
              ) : (
                <section
                  aria-label={t('planner.view.noBriefingAria')}
                  className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2.5"
                >
                  <div className="size-11 rounded-2xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-clipboard-list text-base" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('planner.view.noBriefingTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {t('planner.view.noBriefingDesc')}
                  </p>
                </section>
              )}
            </div>
            <div className="lg:col-span-5">
              <TripCompanionCard
                itineraryId={id}
                canManageMembers={canManageMembers}
                currentUserId={user?.id}
                isMemberOrOwner={isMemberOrOwner}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Copilot Bubble Launcher (Group Members & Owner) */}
      {isMemberOrOwner && !isCopilotOpen && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-40 group print:hidden">
          <button
            type="button"
            onClick={() => setIsCopilotOpen(true)}
            className="relative size-12 sm:size-14 rounded-full bg-[#0194F3] hover:bg-[#007AD0] text-white flex items-center justify-center shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3]"
            aria-label={t('planner.view.openCopilotAria')}
          >
            <i className="fa-solid fa-robot text-lg sm:text-xl" aria-hidden="true" />
          </button>

          <div className="hidden lg:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-[#10243A] text-white text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Genie Copilot
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-[#10243A]" />
          </div>
        </div>
      )}

      {/* Slide-over AI Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        destination={data.destination || 'Đà Nẵng'}
        days={days}
        messages={displayedCopilotMessages}
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
        canEdit={canEdit}
      />

      {/* Floating Mobile Toggle Button (Explore-style single toggle: Timeline ⇄ Map) */}
      {effectiveTab === 'itinerary' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setMobileTab((prev) => (prev === 'timeline' ? 'map' : 'timeline'))}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs shadow-lg hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            aria-label={
              mobileTab === 'timeline'
                ? t('planner.view.switchToMapAria')
                : t('planner.view.switchToTimelineAria')
            }
          >
            {mobileTab === 'timeline' ? (
              <>
                <i className="fa-solid fa-map text-xs text-white" aria-hidden="true" />
                <span>{t('planner.view.mapButton')}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-list text-xs text-white" aria-hidden="true" />
                <span>{t('planner.view.timelineButton')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Companion Management Panel */}
      <TripCompanionsPanel
        open={isHeaderCompanionsOpen}
        onClose={() => setIsHeaderCompanionsOpen(false)}
        itineraryId={id}
        canManageMembers={canManageMembers}
        currentUserId={user?.id}
      />

      {/* Delete Confirmation Modal (Portal + ESC + Scroll Lock) */}
      <AppModalPortal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        disableClose={deleteMutation.isPending}
        ariaLabelledBy="delete-itinerary-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full p-6 space-y-5">
          <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <i className="fa-solid fa-trash-can text-lg" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h3 id="delete-itinerary-modal-title" className="text-base font-bold text-slate-900">
              {t('planner.view.deleteModalTitle')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('planner.view.deleteModalQuestion')}{' '}
              <strong className="text-[#10243A] font-semibold">&quot;{data.title}&quot;</strong>?
            </p>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-2">
              <i
                className="fa-solid fa-circle-info text-[#0194F3] shrink-0 mt-0.5 text-sm"
                aria-hidden="true"
              />
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
              onClick={() => setShowDeleteModal(false)}
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
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                  <span>{t('planner.page.deleting')}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash-can text-xs" aria-hidden="true" />
                  <span>{t('planner.page.confirmDelete')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </AppModalPortal>

      {/* Clone Confirmation Modal (Portal + ESC + Scroll Lock) */}
      <AppModalPortal
        open={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        disableClose={cloneMutation.isPending}
        ariaLabelledBy="clone-itinerary-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full p-6 space-y-5">
          <div className="size-12 rounded-2xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center">
            <i className="fa-regular fa-clone text-lg" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h3 id="clone-itinerary-modal-title" className="text-base font-bold text-slate-900">
              {t('planner.view.cloneModalTitle')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('planner.view.cloneModalQuestion')}{' '}
              <strong className="text-[#10243A] font-semibold">&quot;{data.title}&quot;</strong>{' '}
              {t('planner.view.cloneModalQuestionSuffix')}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={cloneMutation.isPending}
              onClick={() => setShowCloneModal(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={cloneMutation.isPending}
              onClick={handleClone}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {cloneMutation.isPending ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                  <span>{t('planner.view.cloning')}</span>
                </>
              ) : (
                <>
                  <i className="fa-regular fa-clone text-xs" aria-hidden="true" />
                  <span>{t('planner.common.confirm')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </AppModalPortal>

      {/* Edit Metadata Dialog (Title & Description) */}
      <EditItineraryMetaDialog
        open={isEditMetaOpen}
        onClose={() => setIsEditMetaOpen(false)}
        title={data.title}
        description={data.description}
        startDate={data.startDate}
        endDate={data.endDate}
        totalDays={totalDays}
        onSubmit={handleSubmitEditMeta}
        isSubmitting={isUpdatingMeta}
        onAskCopilot={handleAskCopilotFromModal}
      />

      {/* Edit Stop Time/Day/Notes Dialog */}
      <EditDestinationDialog
        open={Boolean(editingDestination)}
        onClose={() => setEditingDestination(null)}
        activity={editingDestination}
        days={days}
        onSubmit={handleSubmitEditDestination}
        isSubmitting={updateDestinationMutation.isPending}
        canEdit={canEdit}
        onAskCopilot={handleAskCopilotFromModal}
      />

      {/* Place Search Dialog (Direct Add or Group Proposal) */}
      <PlaceSearchDialog
        open={Boolean(placeSearchState?.open)}
        onOpenChange={(open: boolean) => {
          if (!open) setPlaceSearchState(null);
        }}
        onSelectPlace={handleDirectAddPlace}
        mode={placeSearchState?.mode ?? 'add'}
        days={days}
        selectedDayNumber={placeSearchState?.dayNumber ?? days[0]?.dayNumber ?? 1}
        onChangeDayNumber={(dayNumber: number) =>
          setPlaceSearchState((prev) => (prev ? { ...prev, dayNumber } : prev))
        }
        targetStopName={placeSearchState?.targetStopName}
        destinationCity={data.destination}
        onProposePlace={handleCreateProposalFromSearch}
        isSubmittingProposal={createProposalMutation.isPending}
        copilotAssist={
          isMemberOrOwner ? (
            <ModalCopilotAssist
              context={
                placeSearchState?.mode === 'propose-swap'
                  ? 'swap'
                  : placeSearchState?.mode === 'propose-new'
                    ? 'propose'
                    : 'add'
              }
              placeName={placeSearchState?.targetStopName}
              dayNumber={placeSearchState?.dayNumber}
              canEdit={canEdit}
              onAskCopilot={handleAskCopilotFromModal}
            />
          ) : undefined
        }
      />

      {/* 1-Click Alternative Places Modal */}
      <PlaceAlternativesModal
        itineraryId={id}
        activity={selectedActivityForSwap}
        isOpen={Boolean(selectedActivityForSwap)}
        onClose={() => setSelectedActivityForSwap(null)}
        canEdit={canEdit}
        isMemberOrOwner={isMemberOrOwner}
        onSelectAlternative={async (newPlaceId) => {
          if (!selectedActivityForSwap) return;
          const destId = selectedActivityForSwap.id || selectedActivityForSwap.placeId;
          try {
            await directSwapMutation.mutateAsync({
              destinationId: destId,
              newPlaceId,
            });
            toast.success(t('planner.view.toasts.swapSuccess'));
            setSelectedActivityForSwap(null);
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('planner.view.toasts.swapError'));
          }
        }}
        onProposeAlternative={async (newPlaceId) => {
          if (!selectedActivityForSwap?.id) {
            toast.error(t('planner.view.toasts.swapVoteUnsupported'));
            return;
          }
          const ownerDay = days.find((d) =>
            d.activities.some(
              (a) => a.id === selectedActivityForSwap.id || a.placeId === selectedActivityForSwap.placeId
            )
          );
          await createProposalMutation.mutateAsync({
            placeId: newPlaceId,
            destinationId: selectedActivityForSwap.id,
            dayNumber: ownerDay?.dayNumber ?? 1,
          });
          setSelectedActivityForSwap(null);
        }}
        onAskCopilot={handleAskCopilotFromModal}
      />

      {/* Lodging Picker Dialog */}
      <LodgingPickerDialog
        open={lodgingPickerNight !== null}
        onClose={() => setLodgingPickerNight(null)}
        itineraryId={id}
        initialNight={lodgingPickerNight ?? 1}
        totalNights={totalNights}
        budgetLevel={data.budgetLevel}
        destinationCity={data.destination}
        days={days}
      />

      {/* New Trip Wizard Modal */}
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

      {/* Tour Briefing Setup & Live A4 Print Preview Modal */}
      <TourBriefingPrintModal
        isOpen={isPrintModalOpen}
        onClose={handleClosePrintModal}
        data={{ ...data, days }}
        isOwner={isOwner}
        transitName={transitName}
        draftBriefing={draftBriefing}
        onChangeDraftBriefing={setDraftOverride}
        printOptions={printOptions}
        onChangePrintOptions={setPrintOptions}
        onSaveBriefing={handleSaveTourBriefing}
        isSaving={updateTourBriefingMutation.isPending}
        onTriggerPrint={() => window.print()}
      />

      {/* Top-Level A4 Print Target */}
      <div className="hidden print:block">
        <ItineraryPrintSheet
          data={{ ...data, days }}
          briefing={draftBriefing}
          options={printOptions}
          transitName={transitName}
        />
      </div>
    </div>
  );
}

function ItineraryViewSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">
        <Skeleton className="h-56 w-full rounded-3xl bg-white border border-slate-200" />
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
