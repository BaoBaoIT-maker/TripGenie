'use client';

import { useState } from 'react';
import {
  Sparkles,
  X,
  Star,
  MapPin,
  MessageSquare,
  Check,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';
import { useActivityAlternatives } from '../../hooks/use-itinerary-planner';
import type { ItineraryActivity, AlternativePlaceItem } from '@/types/itinerary';

interface Props {
  itineraryId: string;
  activity: ItineraryActivity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlternative: (newPlaceId: string) => Promise<void>;
  onAskCopilot: (placeName: string) => void;
}

export default function PlaceAlternativesModal({
  itineraryId,
  activity,
  isOpen,
  onClose,
  onSelectAlternative,
  onAskCopilot,
}: Props) {
  const [swappingId, setSwappingId] = useState<string | null>(null);

  const destinationId = activity?.id || activity?.placeId || null;
  const { data: alternatives, isLoading, error } = useActivityAlternatives(
    itineraryId,
    isOpen ? destinationId : null
  );

  if (!isOpen || !activity) return null;

  const handleSelect = async (alt: AlternativePlaceItem) => {
    try {
      setSwappingId(alt.id);
      await onSelectAlternative(alt.id);
      onClose();
    } finally {
      setSwappingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Đổi địa điểm tương đương
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                Thay thế cho: <span className="font-semibold text-slate-700">{activity.placeName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white text-xs">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
              <Loader2 className="size-6 text-teal-600 animate-spin" />
              <p className="text-xs font-medium">Đang tìm các địa điểm tương đương trong khu vực...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="py-8 text-center text-slate-500">
              <p className="text-xs">Không thể tải gợi ý thay thế. Vui lòng thử lại.</p>
            </div>
          )}

          {!isLoading && !error && alternatives && alternatives.length === 0 && (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <UtensilsCrossed className="size-8 mx-auto text-slate-400" />
              <p className="text-xs font-medium">
                Chưa tìm thấy quán tương đương cùng loại trong phạm vi lân cận.
              </p>
              <p className="text-[11px] text-slate-400">
                Bạn có thể nhờ Genie Copilot tìm kiếm quán theo yêu cầu riêng bên dưới.
              </p>
            </div>
          )}

          {!isLoading &&
            alternatives?.map((alt) => (
              <div
                key={alt.id}
                className="group p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-xs transition-all flex items-center gap-3 bg-white"
              >
                {/* Thumbnail */}
                <div className="relative size-16 sm:size-18 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={
                      alt.imageUrl ||
                      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&auto=format&fit=crop&q=80'
                    }
                    alt={alt.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {alt.distanceKm != null && (
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[9px] font-bold text-white">
                      {alt.distanceKm}km
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-sm bg-teal-50 text-teal-700 font-bold text-[10px]">
                      {alt.categoryName}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold text-[11px]">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <span>{alt.ratingAvg.toFixed(1)}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">({alt.reviewCount})</span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                    {alt.name}
                  </h4>

                  <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400 shrink-0" />
                    <span className="truncate">{alt.address}</span>
                  </p>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  disabled={swappingId !== null}
                  onClick={() => handleSelect(alt)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer inline-flex items-center gap-1"
                >
                  {swappingId === alt.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  <span>Chọn</span>
                </button>
              </div>
            ))}
        </div>

        {/* Footer / Copilot bridge */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Cần tìm quán theo gu riêng?
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              onAskCopilot(activity.placeName);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 text-teal-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <MessageSquare className="size-3.5 text-teal-600" />
            <span>Nhờ Genie Copilot tìm theo yêu cầu...</span>
          </button>
        </div>
      </div>
    </div>
  );
}
