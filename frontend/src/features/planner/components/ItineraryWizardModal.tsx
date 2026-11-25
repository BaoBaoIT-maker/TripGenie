'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CommunityModalPortal } from '@/components/community/CommunityModalPortal';
import { useGenerateItinerary, useTransitPreview } from '../hooks/use-itinerary-planner';
import { placeService } from '@/services/place.service';
import { ApiError } from '@/services/itinerary-planner.service';
import { useUserPreferences } from '@/features/preferences/hooks/use-user-preferences';
import TransitRouteBreakdown from './itinerary/TransitRouteBreakdown';
import type { TransitMode, IntracityMode, BudgetLevel, TravelPace } from '@/types/itinerary';
import { getTourDates, getTourPrompt, type TourTemplate } from '../config/tour-templates';
import { PACE_OPTIONS, MAX_TRIP_DAYS } from '../config/itinerary-wizard-options';
import {
  WIZARD_DEFAULTS,
  VEHICLE_OPTIONS,
  INTRACITY_OPTIONS,
  BUDGET_OPTIONS,
  TRAVEL_STYLE_TAGS,
  STYLE_PROFILE_MAP,
} from '../constants/wizard.constants';
import { PARTY_SIZE_BOUNDS } from '../constants/itinerary.constants';
import {
  calculateTripDays,
  formatWeekdayShort,
  getMaxTripEndDate,
  normalizeTripDateRange,
  toLocalDateString,
} from '../model/itinerary-format';
import { pickLocalizedName, useI18n } from '@/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialDestination?: string;
  initialTemplate?: TourTemplate;
}

interface LocationSelection {
  areaId: number | null;
  areaSlug: string | null;
  customText: string | null;
  fromProp?: boolean;
}

function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function getTransitIcon(mode: TransitMode) {
  switch (mode) {
    case 'FLIGHT':
      return <i className="fa-solid fa-plane text-sm shrink-0" aria-hidden="true" />;
    case 'TRAIN':
      return <i className="fa-solid fa-train text-sm shrink-0" aria-hidden="true" />;
    case 'SLEEPER_BUS':
      return <i className="fa-solid fa-bus text-sm shrink-0" aria-hidden="true" />;
    case 'PERSONAL_MOTORBIKE':
    default:
      return <i className="fa-solid fa-car text-sm shrink-0" aria-hidden="true" />;
  }
}

export default function ItineraryWizardModal({
  isOpen,
  onClose,
  initialDestination,
  initialTemplate,
}: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();

  // 1. Form States
  const initialDestText = initialTemplate?.destination || initialDestination || null;
  const [originSel, setOriginSel] = useState<LocationSelection>({
    areaId: null,
    areaSlug: WIZARD_DEFAULTS.ORIGIN_AREA_SLUG,
    customText: null,
  });
  const [destSel, setDestSel] = useState<LocationSelection>(
    initialDestText
      ? { areaId: null, areaSlug: null, customText: initialDestText, fromProp: true }
      : { areaId: null, areaSlug: WIZARD_DEFAULTS.DESTINATION_AREA_SLUG, customText: null }
  );

  const initialDates = useMemo(
    () => getTourDates(initialTemplate?.days.length || WIZARD_DEFAULTS.DEFAULT_DAYS),
    [initialTemplate?.days.length]
  );
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);

  const [transitMode, setTransitMode] = useState<TransitMode>(WIZARD_DEFAULTS.TRANSIT_MODE);
  const [intracityMode, setIntracityMode] = useState<IntracityMode>(WIZARD_DEFAULTS.INTRACITY_MODE);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>(WIZARD_DEFAULTS.BUDGET_LEVEL);
  const [pace, setPace] = useState<TravelPace>(WIZARD_DEFAULTS.PACE);
  const [partySize, setPartySize] = useState<number>(PARTY_SIZE_BOUNDS.MIN);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    initialTemplate?.styles || [
      'Ẩm thực đặc sản',
      'Cafe & Check-in',
      'Văn hóa & Lịch sử',
    ]
  );
  const [customPrompt, setCustomPrompt] = useState(
    initialTemplate ? getTourPrompt(initialTemplate) : ''
  );
  const [serverError, setServerError] = useState<string | null>(null);

  // Autocomplete dropdown state
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const originWrapperRef = useRef<HTMLDivElement>(null);
  const destWrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (originWrapperRef.current && !originWrapperRef.current.contains(e.target as Node)) {
        setShowOriginDropdown(false);
      }
      if (destWrapperRef.current && !destWrapperRef.current.contains(e.target as Node)) {
        setShowDestDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-fill preferences from Taste Profile if user is logged in
  const { data: userPref } = useUserPreferences({ enabled: isOpen });
  useEffect(() => {
    if (userPref) {
      if (userPref.budgetLevel) {
        setBudgetLevel(userPref.budgetLevel as BudgetLevel);
      }
      if (userPref.travelStyle && userPref.travelStyle.length > 0) {
        const mapped = userPref.travelStyle
          .map((s) => STYLE_PROFILE_MAP[s] || s)
          .filter((s) => (TRAVEL_STYLE_TAGS as readonly string[]).includes(s));
        if (mapped.length > 0) {
          setSelectedStyles(mapped);
        }
      }
    }
  }, [userPref]);

  // Update destination if initialDestination changes
  useEffect(() => {
    if (initialDestination) {
      setDestSel({ areaId: null, areaSlug: null, customText: initialDestination, fromProp: true });
    }
  }, [initialDestination]);

  // Fetch travel areas from CSDL for smart autocomplete and coordinate resolution
  const { data: travelAreas = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['travel-areas'],
    queryFn: () => placeService.getTravelAreas(),
    staleTime: 60 * 60 * 1000,
    enabled: isOpen,
  });

  const locations = useMemo(() => {
    return travelAreas.map((a) => {
      const name = pickLocalizedName(a, locale);
      const hubName = a.primaryHub ? pickLocalizedName(a.primaryHub, locale) : null;
      const badge =
        a.primaryHub && hubName
          ? a.primaryHub.hubType === 'AIRPORT'
            ? `${hubName} (${a.primaryHub.id})`
            : hubName
          : name;
      const areaTranslations = a.translations ? Object.values(a.translations) : [];
      const hubTranslations = a.primaryHub?.translations
        ? Object.values(a.primaryHub.translations)
        : [];
      const searchText = removeVietnameseAccents(
        [
          a.name,
          a.nameVi,
          a.slug,
          ...areaTranslations,
          a.primaryHub?.id,
          a.primaryHub?.name,
          ...hubTranslations,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return {
        id: a.id,
        name,
        nameEn: a.name,
        nameVi: a.nameVi,
        translations: a.translations ?? null,
        slug: a.slug,
        badge,
        searchText,
        lat: a.latitude ?? null,
        lng: a.longitude ?? null,
      };
    });
  }, [travelAreas, locale]);

  const defaultLabelForSlug = useCallback(
    (slug: string | null): string => {
      if (slug === WIZARD_DEFAULTS.ORIGIN_AREA_SLUG) return t('planner.wizard.defaultOrigin');
      if (slug === WIZARD_DEFAULTS.DESTINATION_AREA_SLUG) {
        return t('planner.wizard.defaultDestination');
      }
      return '';
    },
    [t]
  );

  const matchLocationExact = useCallback(
    (raw: string) => {
      const clean = removeVietnameseAccents(raw.split('/')[0].trim());
      if (!clean) return null;
      return (
        locations.find((loc) => {
          const candidates = [
            loc.name,
            loc.nameEn,
            loc.nameVi,
            loc.slug,
            ...(loc.translations ? Object.values(loc.translations) : []),
          ].filter(Boolean) as string[];
          return candidates.some((c) => removeVietnameseAccents(c) === clean);
        }) ?? null
      );
    },
    [locations]
  );

  const resolveSelection = useCallback(
    (sel: LocationSelection) => {
      if (sel.areaId !== null || sel.areaSlug) {
        const matched =
          locations.find(
            (loc) =>
              (sel.areaId !== null && loc.id === sel.areaId) ||
              (sel.areaSlug !== null && loc.slug === sel.areaSlug)
          ) ?? null;
        if (matched) return { area: matched, displayText: matched.name };
        return { area: null, displayText: sel.customText ?? defaultLabelForSlug(sel.areaSlug) };
      }
      const text = sel.customText ?? '';
      const matched = matchLocationExact(text);
      // Only auto-localize displayText for prop-seeded values (never rewrite mid-typing)
      if (matched && sel.fromProp && !text.includes('/')) {
        return { area: matched, displayText: matched.name };
      }
      return { area: matched, displayText: text };
    },
    [locations, defaultLabelForSlug, matchLocationExact]
  );

  const resolvedOrigin = useMemo(
    () => resolveSelection(originSel),
    [resolveSelection, originSel]
  );
  const resolvedDest = useMemo(
    () => resolveSelection(destSel),
    [resolveSelection, destSel]
  );
  const originCity = resolvedOrigin.displayText;
  const destinationCity = resolvedDest.displayText;

  // Filtered dropdown suggestions (bilingual match across EN name, VI name, slug, and hub badge)
  const filteredOrigins = useMemo(() => {
    const q = removeVietnameseAccents(originCity.trim());
    if (!q) return locations.slice(0, 8);
    return locations.filter((loc) => loc.searchText.includes(q)).slice(0, 8);
  }, [originCity, locations]);

  const filteredDests = useMemo(() => {
    const q = removeVietnameseAccents(destinationCity.trim());
    if (!q) return locations.slice(0, 8);
    return locations.filter((loc) => loc.searchText.includes(q)).slice(0, 8);
  }, [destinationCity, locations]);

  // Calculate day and night duration in local calendar time
  const todayDate = toLocalDateString(new Date());
  const totalDays = calculateTripDays(startDate, endDate) ?? 1;
  const totalNights = Math.max(0, totalDays - 1);
  const maxEndDate = useMemo(() => getMaxTripEndDate(startDate, MAX_TRIP_DAYS), [startDate]);
  const startWeekday = formatWeekdayShort(startDate, locale);
  const endWeekday = formatWeekdayShort(endDate, locale);

  const handleStartDateChange = useCallback(
    (newStart: string) => {
      const normalized = normalizeTripDateRange(newStart, endDate, MAX_TRIP_DAYS);
      if (!normalized) return;
      setStartDate(normalized.startDate);
      setEndDate(normalized.endDate);
      if (normalized.clamped) {
        toast.info(t('planner.wizard.maxDaysInfo', { max: MAX_TRIP_DAYS }));
      }
    },
    [endDate, t]
  );

  const handleEndDateChange = useCallback(
    (newEnd: string) => {
      const normalized = normalizeTripDateRange(startDate, newEnd, MAX_TRIP_DAYS);
      if (!normalized) return;
      setEndDate(normalized.endDate);
      if (normalized.clamped) {
        toast.info(t('planner.wizard.maxDaysInfo', { max: MAX_TRIP_DAYS }));
      }
    },
    [startDate, t]
  );

  // Debounced input to avoid triggering transit engine requests on every keystroke
  const [debouncedOrigin, setDebouncedOrigin] = useState<string>(originCity);
  const [debouncedDest, setDebouncedDest] = useState<string>(destinationCity);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrigin(originCity.trim());
      setDebouncedDest(destinationCity.split('/')[0].trim());
    }, WIZARD_DEFAULTS.DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [originCity, destinationCity]);

  // Resolve coordinates across EN/VI/localized area names
  const findLocationCoord = useCallback(
    (rawCity: string) => {
      const clean = removeVietnameseAccents(rawCity);
      if (!clean) return null;
      const found = locations.find((l) => {
        const candidates = [l.name, l.nameEn, l.nameVi].filter(Boolean) as string[];
        return candidates.some((c) => {
          const norm = removeVietnameseAccents(c);
          return norm.includes(clean) || clean.includes(norm);
        });
      });
      return found && found.lat && found.lng ? { lat: found.lat, lng: found.lng } : null;
    },
    [locations]
  );

  const originCoord = useMemo(() => {
    if (resolvedOrigin.area?.lat && resolvedOrigin.area?.lng) {
      return { lat: resolvedOrigin.area.lat, lng: resolvedOrigin.area.lng };
    }
    return findLocationCoord(debouncedOrigin);
  }, [resolvedOrigin.area, debouncedOrigin, findLocationCoord]);

  const destCoord = useMemo(() => {
    if (resolvedDest.area?.lat && resolvedDest.area?.lng) {
      return { lat: resolvedDest.area.lat, lng: resolvedDest.area.lng };
    }
    return findLocationCoord(debouncedDest);
  }, [resolvedDest.area, debouncedDest, findLocationCoord]);

  // Instant Transit Preview Query
  const { data: transitPreview, isLoading: isTransitLoading } = useTransitPreview(
    isOpen && debouncedOrigin && debouncedDest
      ? {
          originCity: debouncedOrigin,
          originLat: originCoord?.lat ?? undefined,
          originLng: originCoord?.lng ?? undefined,
          destCity: debouncedDest,
          destLat: destCoord?.lat ?? undefined,
          destLng: destCoord?.lng ?? undefined,
          transitMode,
          departDate: startDate,
          returnDate: endDate,
        }
      : null
  );

  // Swap origin and destination
  const handleSwapLocations = useCallback(() => {
    setOriginSel(destSel);
    setDestSel(originSel);
  }, [originSel, destSel]);

  // Toggle style tags
  const toggleStyle = useCallback((tag: string) => {
    setSelectedStyles((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Submit itinerary generation
  const generate = useGenerateItinerary();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (generate.isPending) return;

      const cleanOrigin = originCity.trim();
      const cleanDest = destinationCity.split('/')[0].trim();

      if (!cleanOrigin || !cleanDest) {
        toast.error(t('planner.wizard.missingLocationsError'));
        return;
      }

      if (totalDays > MAX_TRIP_DAYS) {
        toast.error(t('planner.wizard.maxDaysSubmitError', { max: MAX_TRIP_DAYS }));
        return;
      }

      setServerError(null);

      generate.mutate(
        {
          originCity: cleanOrigin,
          destinationCity: cleanDest,
          destinationAreaId: resolvedDest.area?.id,
          startDate,
          endDate,
          transitMode,
          intracityMode,
          budgetLevel,
          pace,
          partySize,
          travelStyles: selectedStyles,
          customPrompt: customPrompt.trim() || undefined,
        },
        {
          onSuccess: (data) => {
            toast.success(t('planner.wizard.successToast'));
            onClose();
            router.push(`/itineraries/${data.id}`);
          },
          onError: (err) => {
            const errorMsg =
              err instanceof ApiError && err.status === 401
                ? t('planner.wizard.loginError')
                : err instanceof Error
                ? err.message
                : t('planner.wizard.genericError');
            setServerError(errorMsg);
            toast.error(errorMsg);
          },
        }
      );
    },
    [
      generate,
      originCity,
      destinationCity,
      resolvedDest.area?.id,
      startDate,
      endDate,
      totalDays,
      transitMode,
      intracityMode,
      budgetLevel,
      pace,
      partySize,
      selectedStyles,
      customPrompt,
      onClose,
      router,
      t,
    ]
  );

  if (!isOpen) return null;

  return (
    <CommunityModalPortal
      open={isOpen}
      onClose={onClose}
      disableClose={generate.isPending}
      ariaLabelledBy="wizard-modal-title"
      maxWidthClass="max-w-[640px]"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. MODAL HEADER (Electric Sky Blue Identity & Font Awesome)
      ───────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4.5 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div>
          <h2
            id="wizard-modal-title"
            className="text-base font-black text-[#10243A] tracking-tight"
          >
            {t('planner.wizard.title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('planner.wizard.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={generate.isPending}
          className="size-8 rounded-full text-slate-400 hover:bg-[#E2E8F0]/70 hover:text-[#10243A] flex items-center justify-center transition-colors cursor-pointer"
          title={t('common.close')}
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MODAL BODY (Island Chunking: Sáng sủa, Tươi mới, Font Awesome)
      ───────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-[#10243A]">

          {/* ISLAND 1: TUYẾN ĐƯỜNG & LỊCH TRÌNH */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0194F3]">
                {t('planner.wizard.routeSectionTitle')}
              </span>
              <span
                className="text-xs font-bold text-[#0194F3] bg-[#E8F4FD] px-2.5 py-0.5 rounded-full border border-[#D0E7FF]"
                title={t('planner.wizard.durationBadgeTitle', { max: MAX_TRIP_DAYS })}
              >
                {t('planner.wizard.durationBadge', {
                  days: totalDays,
                  nights: totalNights,
                  max: MAX_TRIP_DAYS,
                })}
              </span>
            </div>

            {/* Connected Journey Bar: Origin ⇄ Destination (Traveloka-Style 50/50 Balanced) */}
            <div className="relative grid grid-cols-2 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs divide-x divide-[#F1F5F9]">
              {/* Origin City (50% Width) */}
              <div className="p-3 pr-6 relative" ref={originWrapperRef}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  <i className="fa-solid fa-plane-departure text-[11px] text-[#0194F3]" aria-hidden="true" />
                  <span>{t('planner.wizard.originLabel')}</span>
                </div>
                <input
                  type="text"
                  value={originCity}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  onFocus={() => setShowOriginDropdown(true)}
                  onChange={(e) => {
                    setOriginSel({ areaId: null, areaSlug: null, customText: e.target.value });
                    setShowOriginDropdown(true);
                  }}
                  placeholder={t('planner.wizard.originPlaceholder')}
                  className="w-full bg-transparent text-sm font-bold text-[#10243A] focus:outline-none truncate"
                />

                {/* Autocomplete dropdown */}
                {showOriginDropdown && (
                  <div className="absolute top-full left-0 mt-2 z-50 w-64 bg-white rounded-xl border border-[#E2E8F0] shadow-lg max-h-48 overflow-y-auto divide-y divide-[#F1F5F9] text-xs">
                    {isLoadingAreas ? (
                      <div className="p-3 text-slate-400 text-center">
                        {t('planner.wizard.loadingLocations')}
                      </div>
                    ) : filteredOrigins.length > 0 ? (
                      filteredOrigins.map((loc) => (
                        <div
                          key={`origin-${loc.id}-${loc.name}`}
                          onClick={() => {
                            setOriginSel({ areaId: loc.id, areaSlug: loc.slug, customText: null });
                            setShowOriginDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-[#F0F7FF] hover:text-[#0194F3] cursor-pointer flex items-center justify-between font-semibold text-[#10243A]"
                        >
                          <span>{loc.name}</span>
                          <span className="text-[10px] text-slate-500 bg-[#F1F5F9] px-1.5 py-0.5 rounded font-normal">
                            {loc.badge}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-slate-400 text-center">
                        {t('planner.wizard.noLocationsFound')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Centered Floating Swap Button ⇄ (Mathematically 50% Center) */}
              <button
                type="button"
                onClick={handleSwapLocations}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white border border-[#D0E7FF] text-[#0194F3] hover:bg-[#F0F7FF] hover:border-[#0194F3] shadow-md flex items-center justify-center transition-all cursor-pointer group shrink-0"
                title={t('planner.wizard.swapLocationsTitle')}
              >
                <i className="fa-solid fa-arrow-right-arrow-left text-xs transition-transform duration-300 group-hover:rotate-180" aria-hidden="true" />
              </button>

              {/* Destination City (50% Width) */}
              <div className="p-3 pl-6 relative" ref={destWrapperRef}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  <i className="fa-solid fa-plane-arrival text-[11px] text-[#0194F3]" aria-hidden="true" />
                  <span>{t('planner.wizard.destLabel')}</span>
                </div>
                <input
                  type="text"
                  value={destinationCity}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  onFocus={() => setShowDestDropdown(true)}
                  onChange={(e) => {
                    setDestSel({ areaId: null, areaSlug: null, customText: e.target.value });
                    setShowDestDropdown(true);
                  }}
                  placeholder={t('planner.wizard.destPlaceholder')}
                  className="w-full bg-transparent text-sm font-bold text-[#10243A] focus:outline-none truncate"
                />

                {/* Autocomplete dropdown */}
                {showDestDropdown && (
                  <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white rounded-xl border border-[#E2E8F0] shadow-lg max-h-48 overflow-y-auto divide-y divide-[#F1F5F9] text-xs">
                    {isLoadingAreas ? (
                      <div className="p-3 text-slate-400 text-center">
                        {t('planner.wizard.loadingLocations')}
                      </div>
                    ) : filteredDests.length > 0 ? (
                      filteredDests.map((loc) => (
                        <div
                          key={`dest-${loc.id}-${loc.name}`}
                          onClick={() => {
                            setDestSel({ areaId: loc.id, areaSlug: loc.slug, customText: null });
                            setShowDestDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-[#F0F7FF] hover:text-[#0194F3] cursor-pointer flex items-center justify-between font-semibold text-[#10243A]"
                        >
                          <span>{loc.name}</span>
                          <span className="text-[10px] text-slate-500 bg-[#F1F5F9] px-1.5 py-0.5 rounded font-normal">
                            {loc.badge}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-slate-400 text-center">
                        {t('planner.wizard.noLocationsFound')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Integrated Schedule Date Range Bar (Traveloka-Style 50/50 Balanced) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-[#F1F5F9]">
              {/* Ngày bắt đầu */}
              <label
                htmlFor="wizard-start-date"
                className="p-3 block cursor-pointer hover:bg-[#F8FAFC] focus-within:bg-[#F8FAFC] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#0194F3]/30 transition-colors rounded-t-xl sm:rounded-tr-none sm:rounded-l-xl"
              >
                <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-regular fa-calendar text-[11px] text-[#0194F3]" aria-hidden="true" />
                    <span>{t('planner.wizard.startDateLabel')}</span>
                  </span>
                  {startWeekday && (
                    <span className="text-[10px] font-semibold normal-case text-[#0194F3]">
                      {startWeekday}
                    </span>
                  )}
                </div>
                <input
                  id="wizard-start-date"
                  type="date"
                  value={startDate}
                  min={todayDate}
                  required
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-[#10243A] focus:outline-none cursor-pointer tabular-nums"
                />
              </label>

              {/* Ngày kết thúc */}
              <label
                htmlFor="wizard-end-date"
                className="p-3 block cursor-pointer hover:bg-[#F8FAFC] focus-within:bg-[#F8FAFC] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#0194F3]/30 transition-colors rounded-b-xl sm:rounded-bl-none sm:rounded-r-xl"
              >
                <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-regular fa-calendar-check text-[11px] text-[#0194F3]" aria-hidden="true" />
                    <span>{t('planner.wizard.endDateLabel')}</span>
                  </span>
                  {endWeekday && (
                    <span className="text-[10px] font-semibold normal-case text-[#0194F3]">
                      {endWeekday}
                    </span>
                  )}
                </div>
                <input
                  id="wizard-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={maxEndDate}
                  required
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-[#10243A] focus:outline-none cursor-pointer tabular-nums"
                />
              </label>
            </div>

            {/* Party Size Stepper */}
            <div className="px-3 py-2.5 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#10243A]">
                  <i className="fa-solid fa-user-group text-[#0194F3] text-xs" aria-hidden="true" />
                  <span>{t('planner.wizard.partySizeLabel')}</span>
                </div>
                <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                  {t('planner.wizard.estimatedRooms', { count: Math.max(1, Math.ceil(partySize / 2)) })}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 shrink-0">
                <button
                  type="button"
                  aria-label={t('planner.wizard.decreasePartySize')}
                  disabled={partySize <= PARTY_SIZE_BOUNDS.MIN}
                  onClick={() => setPartySize((prev) => Math.max(PARTY_SIZE_BOUNDS.MIN, prev - 1))}
                  className="size-8 rounded-lg flex items-center justify-center text-[#10243A] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-minus text-[11px]" aria-hidden="true" />
                </button>
                <span className="min-w-[54px] text-center text-xs font-bold text-[#10243A] tabular-nums">
                  {t('planner.common.peopleCount', { count: partySize })}
                </span>
                <button
                  type="button"
                  aria-label={t('planner.wizard.increasePartySize')}
                  disabled={partySize >= PARTY_SIZE_BOUNDS.MAX}
                  onClick={() => setPartySize((prev) => Math.min(PARTY_SIZE_BOUNDS.MAX, prev + 1))}
                  className="size-8 rounded-lg flex items-center justify-center text-[#10243A] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-plus text-[11px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* ISLAND 2: PHƯƠNG TIỆN LIÊN TỈNH & ĐƯA RƯỚC NỘI THÀNH */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0194F3]">
                {t('planner.wizard.transitSectionTitle')}
              </span>
            </div>

            {/* 4 Intercity Transit Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VEHICLE_OPTIONS.map((v) => {
                const isSelected = transitMode === v.id;
                const vehicleLabel =
                  v.id === 'PERSONAL_MOTORBIKE'
                    ? t('planner.transitModes.PERSONAL_VEHICLE')
                    : t(`planner.transitModes.${v.id}`);

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTransitMode(v.id)}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer relative shadow-2xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-2 border-[#0194F3] bg-white ring-1 ring-[#0194F3]/25 text-[#0194F3]'
                        : 'border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] text-[#10243A]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={isSelected ? 'text-[#0194F3]' : 'text-slate-500'}>
                        {getTransitIcon(v.id)}
                      </span>
                      {isSelected && (
                        <span className="size-4 rounded-full bg-[#0194F3] text-white flex items-center justify-center text-[10px]">
                          <i className="fa-solid fa-check" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-bold">
                      {vehicleLabel}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Transit Route Breakdown / Distance & Safety Notice */}
            {isTransitLoading ? (
              <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] text-xs flex items-center gap-2 text-slate-600">
                <i className="fa-solid fa-circle-notch fa-spin text-[#0194F3] text-sm shrink-0" aria-hidden="true" />
                <span>{t('planner.wizard.calculatingTransit')}</span>
              </div>
            ) : transitPreview ? (
              <TransitRouteBreakdown
                transit={transitPreview}
                originCity={debouncedOrigin}
                destCity={debouncedDest}
              />
            ) : null}

            {/* Intracity Mode / Local Transfer Options */}
            <div className="space-y-1.5 pt-1">
              <span className="block text-xs font-bold text-slate-500">
                {t('planner.wizard.intracityLabel')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {INTRACITY_OPTIONS.map((opt) => {
                  const isSelected = intracityMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIntracityMode(opt.id)}
                      className={`p-2.5 rounded-xl text-left font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#0194F3] bg-white text-[#0194F3] ring-1 ring-[#0194F3]/25'
                          : 'border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] text-[#10243A]'
                      }`}
                    >
                      <div className="text-xs font-bold">
                        {t(`planner.wizard.intracityOptions.${opt.id}.title`)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                        {t(`planner.wizard.intracityOptions.${opt.id}.priceText`)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ISLAND 3: NGÂN SÁCH & GU DU LỊCH (Grid 3×2 Cân Đối Tuyệt Đối) */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0194F3]">
                {t('planner.wizard.budgetSectionTitle')}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {t('planner.wizard.personalizedBadge')}
              </span>
            </div>

            {/* Segmented 3-tier Budget Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white rounded-xl border border-[#E2E8F0] text-xs font-semibold shadow-2xs">
              {BUDGET_OPTIONS.map((b) => {
                const isSelected = budgetLevel === b.id;
                const budgetKey = b.id as 'LOW' | 'MEDIUM' | 'HIGH';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetLevel(b.id)}
                    className={`py-2 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E8F4FD] text-[#0194F3] font-bold shadow-2xs'
                        : 'text-slate-500 hover:text-[#10243A]'
                    }`}
                  >
                    <div className="font-bold">
                      {t(`planner.wizard.budgetOptions.${budgetKey}.title`)}
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      {t(`planner.wizard.budgetOptions.${budgetKey}.dailyCost`)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Segmented 3-tier Travel Pace Switcher */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">
                {t('planner.wizard.paceLabel')}
              </label>
              <div
                role="radiogroup"
                aria-label={t('planner.wizard.paceLabel')}
                className="grid grid-cols-3 gap-1.5 p-1 bg-white rounded-xl border border-[#E2E8F0] text-xs font-semibold shadow-2xs"
              >
                {PACE_OPTIONS.map((opt) => {
                  const isSelected = pace === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setPace(opt.value)}
                      className={`py-2 px-2 rounded-lg text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E8F4FD] text-[#0194F3] font-bold shadow-2xs'
                          : 'text-slate-500 hover:text-[#10243A]'
                      }`}
                    >
                      <div className="font-bold">
                        {t(`planner.wizard.paceOptions.${opt.value}.label`)}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {t(`planner.wizard.paceOptions.${opt.value}.desc`)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Travel Styles: Pure 3x2 Grid */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">
                {t('planner.wizard.stylesLabel')}
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {TRAVEL_STYLE_TAGS.map((tag) => {
                  const isSelected = selectedStyles.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleStyle(tag)}
                      className={`py-2 px-2 rounded-xl text-center transition-all truncate cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#0194F3] bg-[#E8F4FD] text-[#0194F3] font-bold shadow-2xs'
                          : 'border border-[#E2E8F0] bg-white text-slate-600 font-medium hover:border-[#CBD5E1] hover:text-[#10243A]'
                      }`}
                    >
                      {t(`planner.wizard.styleTags.${tag}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={t('planner.wizard.customPromptPlaceholder')}
                className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#10243A] placeholder-slate-400 focus:outline-none focus:border-[#0194F3] focus:ring-1 focus:ring-[#0194F3]"
              />
            </div>
          </div>

          {serverError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
              {serverError}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. MODAL FOOTER (Electric Sky Blue Primary Button)
        ───────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {t('planner.wizard.footerHint')}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={generate.isPending}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] text-xs font-bold text-slate-500 hover:text-[#10243A] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>

            <button
              type="submit"
              disabled={generate.isPending}
              className="px-6 py-2 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] disabled:opacity-50 text-white text-xs font-bold shadow-[0_2px_8px_rgba(1,148,243,0.3)] transition-all cursor-pointer flex items-center gap-2"
            >
              {generate.isPending ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true" />
                  <span>{t('planner.wizard.creating')}</span>
                </>
              ) : (
                <span>{t('planner.wizard.createButton')}</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </CommunityModalPortal>
  );
}
