'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Sparkles,
  MapPin,
  Compass,
  Calendar,
  Plane,
  Bus,
  Train,
  Bike,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Navigation,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useGenerateItinerary, useTransitPreview } from '../hooks/use-itinerary-planner';
import { placeService } from '@/services/place.service';
import { ApiError } from '@/services/itinerary-planner.service';
import TransitRouteBreakdown from './itinerary/TransitRouteBreakdown';
import type { TransitMode, IntracityMode, BudgetLevel, TravelPace } from '@/types/itinerary';
import { getTourDates, getTourPrompt, type TourTemplate } from '../config/tour-templates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialDestination?: string;
  initialTemplate?: TourTemplate;
}

interface PhotoDestination {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

const PHOTO_DESTINATIONS: PhotoDestination[] = [
  {
    id: 'danang',
    name: 'Đà Nẵng',
    subtitle: 'Biển & Cầu Rồng',
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'quangnam',
    name: 'Quảng Nam / Hội An',
    subtitle: 'Phố cổ di sản',
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'dalat',
    name: 'Đà Lạt',
    subtitle: 'Săn mây & Cafe',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'phuquoc',
    name: 'Phú Quốc',
    subtitle: 'Hoàng hôn đảo ngọc',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
  },
];

function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const VEHICLE_OPTIONS: Array<{
  id: TransitMode;
  title: string;
  durationText: string;
  priceText: string;
  icon: typeof Plane;
  iconColor: string;
}> = [
  {
    id: 'FLIGHT',
    title: 'Máy bay',
    durationText: 'Nhanh nhất (~1h20)',
    priceText: 'Từ 1.200k/vé',
    icon: Plane,
    iconColor: 'text-blue-500',
  },
  {
    id: 'SLEEPER_BUS',
    title: 'Xe khách',
    durationText: 'Giường nằm (~16h)',
    priceText: 'Từ 450k/vé',
    icon: Bus,
    iconColor: 'text-amber-500',
  },
  {
    id: 'TRAIN',
    title: 'Tàu hỏa',
    durationText: 'Đường sắt (~17h)',
    priceText: 'Ngắm cảnh Hải Vân',
    icon: Train,
    iconColor: 'text-indigo-500',
  },
  {
    id: 'PERSONAL_MOTORBIKE',
    title: 'Xe máy',
    durationText: 'Phượt đường dài',
    priceText: 'Tiết kiệm xăng',
    icon: Bike,
    iconColor: 'text-rose-500',
  },
];

const INTRACITY_OPTIONS: Array<{
  id: IntracityMode;
  label: string;
}> = [
  { id: 'MOTORBIKE_RENTAL', label: '• Thuê xe máy (~170k/ngày)' },
  { id: 'GRAB_BIKE', label: '○ Xe ôm Grab/Be' },
  { id: 'TAXI_CAR', label: '○ Taxi 4 chỗ' },
];

const BUDGET_LEVEL_OPTIONS: Array<{
  id: BudgetLevel;
  title: string;
  dailyCost: string;
  desc: string;
  isPopular?: boolean;
}> = [
  {
    id: 'LOW',
    title: 'Tiết kiệm',
    dailyCost: '~400k/ngày',
    desc: 'Homestay, quán ăn địa phương',
  },
  {
    id: 'MEDIUM',
    title: 'Tiêu chuẩn',
    dailyCost: '~1.000k/ngày',
    desc: 'Khách sạn 3–4★, ăn uống đa dạng',
    isPopular: true,
  },
  {
    id: 'HIGH',
    title: 'Sang trọng',
    dailyCost: '~2.500k/ngày',
    desc: 'Resort 5★, fine dining & xe riêng',
  },
];

const PACE_OPTIONS: Array<{
  id: TravelPace;
  label: string;
}> = [
  { id: 'RELAXED', label: 'Thư thả (2–3 điểm/ngày)' },
  { id: 'BALANCED', label: '• Cân bằng (4–5 điểm/ngày)' },
  { id: 'PACKED', label: 'Dày đặc (6–7 điểm/ngày)' },
];

const TRAVEL_STYLE_TAGS = [
  'Ẩm thực đặc sản',
  'Cafe chill/check-in',
  'Di tích & Văn hóa',
  'Biển đảo',
  'Chợ đêm',
  'Chữa lành',
  'Nhiếp ảnh sống ảo',
  'Trải nghiệm thủ công',
];

export default function ItineraryWizardModal({ isOpen, onClose, initialDestination, initialTemplate }: Props) {
  const router = useRouter();

  // Wizard Step: 1, 2, 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [originCity, setOriginCity] = useState('TP. Hồ Chí Minh');
  const [destinationCity, setDestinationCity] = useState(initialTemplate?.destination || initialDestination || 'Quảng Nam / Hội An');
  const [tripDates] = useState(() => getTourDates(initialTemplate?.days.length || 3));
  const [startDate, setStartDate] = useState(tripDates.startDate);
  const [endDate, setEndDate] = useState(tripDates.endDate);
  const [transitMode, setTransitMode] = useState<TransitMode>('FLIGHT');
  const [intracityMode, setIntracityMode] = useState<IntracityMode>('MOTORBIKE_RENTAL');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('MEDIUM');
  const [pace, setPace] = useState<TravelPace>('BALANCED');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(initialTemplate?.styles || [
    'Ẩm thực đặc sản',
    'Cafe chill/check-in',
    'Di tích & Văn hóa',
  ]);
  const [customPrompt, setCustomPrompt] = useState(initialTemplate ? getTourPrompt(initialTemplate) : '');

  // Autocomplete dropdown state
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const originWrapperRef = useRef<HTMLDivElement>(null);
  const destWrapperRef = useRef<HTMLDivElement>(null);

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

  // Fetch real travel areas directly from PostgreSQL DB
  const { data: travelAreas = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['travel-areas'],
    queryFn: () => placeService.getTravelAreas(),
    staleTime: 60 * 60 * 1000,
  });

  const locations = useMemo(() => {
    return travelAreas.map((a) => {
      const name = a.nameVi || a.name;
      const badge = a.hubBadge || name;
      return {
        id: a.id,
        name,
        badge,
        lat: a.latitude ?? null,
        lng: a.longitude ?? null,
      };
    });
  }, [travelAreas]);

  const filteredOrigins = useMemo(() => {
    const q = removeVietnameseAccents(originCity.trim());
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        removeVietnameseAccents(loc.name).includes(q) ||
        removeVietnameseAccents(loc.badge).includes(q)
    );
  }, [originCity, locations]);

  const filteredDests = useMemo(() => {
    const q = removeVietnameseAccents(destinationCity.trim());
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        removeVietnameseAccents(loc.name).includes(q) ||
        removeVietnameseAccents(loc.badge).includes(q)
    );
  }, [destinationCity, locations]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(30);
  const [statusMessage, setStatusMessage] = useState(
    'Đang kết nối VietMap Direction API để tính cự ly tối ưu...'
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const generate = useGenerateItinerary();

  // Clean strings for API
  const cleanDest = destinationCity.split('/')[0].trim();
  const cleanOrigin = originCity.trim();

  // Calculate day difference
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const totalDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1);
  const totalNights = Math.max(0, totalDays - 1);

  // Dynamic coordinate lookup from real database locations
  const originCoord = useMemo(() => {
    const clean = removeVietnameseAccents(cleanOrigin);
    const found = locations.find((l) => {
      const locClean = removeVietnameseAccents(l.name);
      return locClean.includes(clean) || clean.includes(locClean);
    });
    return found && found.lat && found.lng ? { lat: found.lat, lng: found.lng } : null;
  }, [cleanOrigin, locations]);

  const destCoord = useMemo(() => {
    const clean = removeVietnameseAccents(cleanDest);
    const found = locations.find((l) => {
      const locClean = removeVietnameseAccents(l.name);
      return locClean.includes(clean) || clean.includes(locClean);
    });
    return found && found.lat && found.lng ? { lat: found.lat, lng: found.lng } : null;
  }, [cleanDest, locations]);

  // Instant Transit Preview Query (with DB coordinates passed to transit engine)
  const { data: transitPreview, isLoading: isTransitLoading } = useTransitPreview({
    originCity: cleanOrigin,
    originLat: originCoord?.lat ?? undefined,
    originLng: originCoord?.lng ?? undefined,
    destCity: cleanDest,
    destLat: destCoord?.lat ?? undefined,
    destLng: destCoord?.lng ?? undefined,
    transitMode,
    departDate: startDate,
    returnDate: endDate,
  });

  useEffect(() => {
    if (initialDestination) {
      setDestinationCity(initialDestination);
    }
  }, [initialDestination]);

  function handleDetectGPS() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setOriginCity('TP. Hồ Chí Minh'),
        () => setOriginCity('TP. Hồ Chí Minh')
      );
    } else {
      setOriginCity('TP. Hồ Chí Minh');
    }
  }

  function toggleStyle(tag: string) {
    setSelectedStyles((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  // Handle Generate Submission
  function handleSubmit() {
    setServerError(null);
    setIsProcessing(true);
    setProgressPercent(30);
    setStatusMessage('Đang kết nối VietMap Direction API để tính cự ly tối ưu...');

    const timer1 = setTimeout(() => {
      setProgressPercent(65);
      setStatusMessage(`Đang lọc 25 địa điểm CSDL phù hợp sở thích tại ${cleanDest}...`);
    }, 1200);

    const timer2 = setTimeout(() => {
      setProgressPercent(90);
      setStatusMessage('Đang tối ưu hóa thứ tự ghé thăm và dự toán chi phí 5 khoản...');
    }, 2400);

    generate.mutate(
      {
        originCity: cleanOrigin,
        destinationCity: cleanDest,
        startDate,
        endDate,
        transitMode,
        intracityMode,
        budgetLevel,
        pace,
        travelStyles: selectedStyles,
        customPrompt,
      },
      {
        onSuccess: (data) => {
          clearTimeout(timer1);
          clearTimeout(timer2);
          setProgressPercent(100);
          setTimeout(() => {
            setIsProcessing(false);
            onClose();
            router.push(`/itineraries/${data.id}`);
          }, 600);
        },
        onError: (err) => {
          clearTimeout(timer1);
          clearTimeout(timer2);
          setIsProcessing(false);
          setServerError(
            err instanceof ApiError && err.status === 401
              ? 'Vui lòng đăng nhập để tạo lịch trình.'
              : err instanceof Error
              ? err.message
              : 'Có lỗi xảy ra khi tạo lịch trình. Vui lòng thử lại.'
          );
        },
      }
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent
        style={{ maxWidth: '920px', width: '95vw' }}
        className="block max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-9 shadow-2xl text-slate-900"
        showCloseButton={false}
      >
        {!isProcessing ? (
          <div className="space-y-6">
            {/* ─────────────────────────────────────────────────────────────
                MODAL TOP HEADER (Matches user uploaded screenshots exactly)
            ───────────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                    Lên kế hoạch chuyến đi mới cùng AI
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tạo lịch trình siêu tốc, tối ưu cung đường & ngân sách
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                STEP STEPPER (1 Điểm đến ─ 2 Phương tiện ─ 3 Ngân sách & Gu)
            ───────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold py-1">
              {/* Step 1 */}
              <div
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 cursor-pointer ${
                  step === 1 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <span
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 1
                      ? 'bg-teal-600 text-white shadow-xs'
                      : step > 1
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  1
                </span>
                <span>Điểm đến</span>
              </div>

              <div
                className={`flex-1 h-0.5 mx-3 sm:mx-6 transition-colors ${
                  step >= 2 ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              />

              {/* Step 2 */}
              <div
                onClick={() => setStep(2)}
                className={`flex items-center gap-2 cursor-pointer ${
                  step === 2
                    ? 'text-teal-700 font-bold'
                    : step > 2
                    ? 'text-teal-600'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 2
                      ? 'bg-teal-600 text-white shadow-xs'
                      : step > 2
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  2
                </span>
                <span>Phương tiện</span>
              </div>

              <div
                className={`flex-1 h-0.5 mx-3 sm:mx-6 transition-colors ${
                  step === 3 ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              />

              {/* Step 3 */}
              <div
                onClick={() => setStep(3)}
                className={`flex items-center gap-2 cursor-pointer ${
                  step === 3 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <span
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 3
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  3
                </span>
                <span>Ngân sách & Gu</span>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════
                STEP 1 CONTENT: Điểm đến (Matches Image 1 exactly)
            ═════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-5 pt-1">
                {/* Điểm khởi hành with Autocomplete */}
                <div className="space-y-1.5 relative" ref={originWrapperRef}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    ĐIỂM KHỞI HÀNH
                  </label>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                    <MapPin className="size-4 text-teal-600 shrink-0 mr-3" />
                    <input
                      type="text"
                      value={originCity}
                      onFocus={() => setShowOriginDropdown(true)}
                      onChange={(e) => {
                        setOriginCity(e.target.value);
                        setShowOriginDropdown(true);
                      }}
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                      placeholder="Nhập tỉnh / thành khởi hành..."
                    />
                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer shrink-0"
                    >
                      <Navigation className="size-3.5 text-teal-600" aria-hidden="true" />
                      <span>Dùng vị trí hiện tại</span>
                    </button>
                  </div>

                  {/* Origin Dropdown Suggestions */}
                  {showOriginDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
                      {isLoadingAreas ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                          <Loader2 className="size-4 animate-spin text-teal-600 shrink-0" />
                          <span>Đang tải danh sách điểm đến từ CSDL...</span>
                        </div>
                      ) : filteredOrigins.length > 0 ? (
                        filteredOrigins.map((loc) => (
                          <div
                            key={`${loc.id}-${loc.name}`}
                            onClick={() => {
                              setOriginCity(loc.name);
                              setShowOriginDropdown(false);
                            }}
                            className="px-4 py-2.5 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between text-xs sm:text-sm transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="size-3.5 text-slate-400 group-hover:text-teal-600 shrink-0" />
                              <span className="font-semibold text-slate-800 group-hover:text-teal-900">
                                {loc.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 bg-slate-100 group-hover:bg-teal-100/80 group-hover:text-teal-800 px-2 py-0.5 rounded-full font-medium transition-colors">
                              {loc.badge}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 text-center">Không tìm thấy địa điểm</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bạn muốn đi đâu? with Autocomplete */}
                <div className="space-y-1.5 relative" ref={destWrapperRef}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    BẠN MUỐN ĐI ĐÂU?
                  </label>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                    <Compass className="size-4 text-teal-600 shrink-0 mr-3" />
                    <input
                      type="text"
                      value={destinationCity}
                      onFocus={() => setShowDestDropdown(true)}
                      onChange={(e) => {
                        setDestinationCity(e.target.value);
                        setShowDestDropdown(true);
                      }}
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                      placeholder="Gõ tìm kiếm điểm đến (VD: Đà Lạt, Nghệ An, Hội An, Phú Quốc...)"
                    />
                  </div>

                  {/* Destination Dropdown Suggestions */}
                  {showDestDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
                      {isLoadingAreas ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                          <Loader2 className="size-4 animate-spin text-teal-600 shrink-0" />
                          <span>Đang tải danh sách điểm đến từ CSDL...</span>
                        </div>
                      ) : filteredDests.length > 0 ? (
                        filteredDests.map((loc) => (
                          <div
                            key={`${loc.id}-${loc.name}`}
                            onClick={() => {
                              setDestinationCity(loc.name);
                              setShowDestDropdown(false);
                            }}
                            className="px-4 py-2.5 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between text-xs sm:text-sm transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              <Compass className="size-3.5 text-slate-400 group-hover:text-teal-600 shrink-0" />
                              <span className="font-semibold text-slate-800 group-hover:text-teal-900">
                                {loc.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 bg-slate-100 group-hover:bg-teal-100/80 group-hover:text-teal-800 px-2 py-0.5 rounded-full font-medium transition-colors">
                              {loc.badge}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 text-center">Không tìm thấy địa điểm</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4 Photo Cards matching screenshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {PHOTO_DESTINATIONS.map((dest) => {
                    const isSelected = destinationCity
                      .toLowerCase()
                      .includes(dest.name.toLowerCase().split('/')[0].trim());
                    return (
                      <div
                        key={dest.id}
                        onClick={() => {
                          setDestinationCity(dest.name);
                          setShowDestDropdown(false);
                        }}
                        className={`relative h-28 sm:h-32 rounded-2xl overflow-hidden cursor-pointer group transition-all ${
                          isSelected
                            ? 'ring-3 ring-teal-600 border-2 border-teal-600 shadow-md scale-[1.02]'
                            : 'border border-slate-200 hover:border-slate-400 hover:shadow-xs'
                        }`}
                      >
                        <img
                          src={dest.image}
                          alt={dest.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-transparent" />

                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] shadow-sm">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}

                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <div className="text-xs sm:text-sm font-bold leading-tight truncate">
                            {dest.name}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-200 opacity-90 truncate mt-0.5">
                            {dest.subtitle}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Thời gian khởi hành & độ dài */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    THỜI GIAN KHỞI HÀNH & ĐỘ DÀI
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="size-5 text-teal-600 shrink-0" />
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-xs sm:text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                        />
                        <span className="text-slate-400 font-bold">–</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-xs sm:text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                    <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3.5 py-1 text-xs font-bold text-teal-700 shrink-0">
                      ⏱️ {totalDays} Ngày {totalNights} Đêm
                    </span>
                  </div>
                </div>

                {/* Step 1 Footer */}
                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold px-7 py-3 transition-colors cursor-pointer shadow-xs"
                  >
                    Tiếp tục: Phương tiện di chuyển
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                STEP 2 CONTENT: Phương tiện (Matches Image 2 exactly)
            ═════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-5 pt-1">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phương tiện di chuyển ({cleanOrigin} ──&gt; {cleanDest})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lựa chọn chặng liên tỉnh phù hợp thời gian & chi phí
                  </p>
                </div>

                {/* 4 Vehicle Selection Cards - Dynamic duration & pricing */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {VEHICLE_OPTIONS.map((v) => {
                    const isSelected = transitMode === v.id;
                    const Icon = v.icon;

                    const modeSummary = transitPreview?.allModesSummary?.find((m) => m.mode === v.id);
                    let dynamicDur = modeSummary?.durationText || v.durationText;
                    let dynamicPrice = modeSummary?.priceText || v.priceText;

                    if (isTransitLoading) {
                      dynamicDur = 'Đang tính...';
                      dynamicPrice = 'Đang tải CSDL...';
                    }

                    return (
                      <div
                        key={v.id}
                        onClick={() => setTransitMode(v.id)}
                        className={`relative rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[124px] ${
                          isSelected
                            ? 'border-2 border-teal-600 bg-white ring-2 ring-teal-600/10 shadow-xs'
                            : 'border border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon className={`size-6 ${v.iconColor}`} />
                          {modeSummary?.isMultiModal && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Nối chặng
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900">
                            {v.title}
                          </div>
                          <div className="text-[11px] font-semibold text-teal-700 mt-0.5">
                            {dynamicDur}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {dynamicPrice}
                          </div>
                          {modeSummary?.warning && !isTransitLoading && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                              <AlertTriangle className="size-2.5 text-rose-700 shrink-0" />
                              <span>{modeSummary.warning}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Smart Transit Preview Box / Safety Alert */}
                {isTransitLoading || !transitPreview ? (
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 flex items-center gap-3.5 shadow-2xs">
                    <Loader2 className="size-5 text-teal-600 animate-spin shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-teal-950">
                        Đang đồng bộ lộ trình &amp; tính cự ly thực tế từ CSDL...
                      </div>
                      <div className="text-[11px] text-teal-700/80 mt-0.5">
                        Tuyến đường: {cleanOrigin} ──&gt; {cleanDest}
                      </div>
                    </div>
                  </div>
                ) : (
                  <TransitRouteBreakdown
                    transit={transitPreview}
                    originCity={cleanOrigin}
                    destCity={cleanDest}
                  />
                )}

                {/* Đi lại tại điểm du lịch */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    ĐI LẠI TẠI ĐIỂM DU LỊCH
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {INTRACITY_OPTIONS.map((opt) => {
                      const isSelected = intracityMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setIntracityMode(opt.id)}
                          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-2 border-teal-600 bg-teal-50/70 text-teal-800'
                              : 'border border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2 Footer */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold px-7 py-3 transition-colors cursor-pointer shadow-xs"
                  >
                    Tiếp tục: Gu & Ngân sách
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                STEP 3 CONTENT: Ngân sách & Gu (Matches Image 3 exactly)
            ═════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-5 pt-1">
                {/* Mức ngân sách chi tiêu / ngày */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    MỨC NGÂN SÁCH CHI TIÊU / NGÀY
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {BUDGET_LEVEL_OPTIONS.map((lvl) => {
                      const isSelected = budgetLevel === lvl.id;
                      return (
                        <div
                          key={lvl.id}
                          onClick={() => setBudgetLevel(lvl.id)}
                          className={`relative rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[110px] ${
                            isSelected
                              ? 'border-2 border-teal-600 bg-teal-50/20 ring-2 ring-teal-600/10 shadow-xs'
                              : 'border border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          {lvl.isPopular && (
                            <span className="absolute -top-2.5 right-3 rounded-full bg-teal-700 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                              Được chọn nhiều nhất
                            </span>
                          )}
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-slate-900">
                              {lvl.title}
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-teal-700 mt-1">
                              {lvl.dailyCost}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {lvl.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Nhịp độ chuyến đi */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    NHỊP ĐỘ CHUYẾN ĐI
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
                    {PACE_OPTIONS.map((p) => {
                      const isSelected = pace === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPace(p.id)}
                          className={`rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-teal-800 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sở thích & Phong cách (chọn nhiều) */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    SỞ THÍCH & PHONG CÁCH (CHỌN NHIỀU)
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {TRAVEL_STYLE_TAGS.map((tag) => {
                      const isSelected = selectedStyles.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleStyle(tag)}
                          className={`rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? `✓ ${tag}` : tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ghi chú riêng cho AI Copilot */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    GHI CHÚ RIÊNG CHO AI COPILOT
                  </label>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Gia đình có trẻ nhỏ, ưu tiên quán ăn hải sản tươi sống và không gian thoáng đãng..."
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                {serverError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {serverError}
                  </div>
                )}

                {/* Step 3 Footer: Glowing gradient create button */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    Quay lại
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm px-8 py-3.5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <Sparkles className="size-4" />
                    <span>TẠO LỊCH TRÌNH VỚI AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
              SMART PROGRESS / LOADING STATE
          ───────────────────────────────────────────────────────────── */
          <div className="py-12 px-6 text-center space-y-6">
            <div className="size-16 mx-auto rounded-full bg-teal-50 flex items-center justify-center">
              <div className="size-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                TripGenie đang phân tích và lập kế hoạch
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 transition-all duration-300">
                {statusMessage}
              </p>
            </div>
            <div className="w-full max-w-md mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-600 to-emerald-600 h-full transition-all duration-700 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400">
              Thời gian xử lý thông thường từ 3 đến 5 giây
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
