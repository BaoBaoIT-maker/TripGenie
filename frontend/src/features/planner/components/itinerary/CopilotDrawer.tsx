'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TripGenieMark } from '@/components/common/TripGenieMark';
import { useI18n } from '@/i18n';
import { placeService } from '@/services/place.service';
import { CopilotProposal, ItineraryDay } from '@/types/itinerary';
import { AiThinkingIndicator } from './AiThinkingIndicator';

export interface CopilotMessageItem {
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
}

export interface LocatePlaceTarget {
  id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  rating?: number;
  categoryName?: string;
  imageUrl?: string;
}

interface PlaceRecommendation {
  name: string;
  description?: string;
}

interface PlaceResolvedInfo {
  id?: string;
  imageUrl?: string;
  categoryLabel?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
}

const PLACE_INFO_CACHE = new Map<string, PlaceResolvedInfo>();

/**
 * Extract structured place suggestions from AI messages formatted like:
 * 1. **Tên địa điểm** - Mô tả...
 */
function parsePlaceRecommendations(text: string): PlaceRecommendation[] {
  const lines = text.split('\n');
  const results: PlaceRecommendation[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:(?:\d+\.|\-|\*)\s+)?\*\*([^*]+)\*\*[:\s-]*(.*)$/);
    if (match && match[1]) {
      const name = match[1].trim();
      const desc = match[2]?.trim().replace(/^[-–—:]\s*/, '') || '';
      if (
        name.length > 2 &&
        name.length < 65 &&
        !name.toLowerCase().includes('lưu ý') &&
        !name.toLowerCase().includes('tóm tắt') &&
        !name.toLowerCase().includes('quy tắc') &&
        !name.toLowerCase().includes('áp dụng')
      ) {
        results.push({ name, description: desc });
      }
    }
  }

  return results.length >= 2 ? results : [];
}

/**
 * Clean formatted message text parser that removes markdown artifacts:
 * - Parses **[Action]** or [Action] into aesthetic subtle badges
 * - Renders **Bold Text** as clean semantic <strong> without intrusive pill chips or deep links
 * - Keeps conversational reading fluid and free of visual clutter
 */
function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1.5" />;
        }

        const tokens: React.ReactNode[] = [];
        let remaining = trimmed;
        let tokenKey = 0;

        // Matches **[X]**, [X], **X**
        const tokenRegex = /(\*\*\[([^\]]+)\]\*\*|\[([A-ZÀ-Ỹa-zà-ỹ\s]{3,35})\]|\*\*([^*]+)\*\*)/;

        while (remaining) {
          const match = remaining.match(tokenRegex);
          if (!match || match.index === undefined) {
            tokens.push(<span key={tokenKey++}>{remaining}</span>);
            break;
          }

          if (match.index > 0) {
            tokens.push(<span key={tokenKey++}>{remaining.slice(0, match.index)}</span>);
          }

          const fullMatch = match[0];
          const bracketInBold = match[2];
          const bracketAlone = match[3];
          const boldText = match[4];

          if (bracketInBold || bracketAlone) {
            const btnText = bracketInBold || bracketAlone;
            tokens.push(
              <span
                key={tokenKey++}
                className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg bg-sky-100/90 text-sky-950 font-bold text-[11px] border border-sky-200/80 shadow-2xs select-none"
              >
                <i className="fa-solid fa-check text-[10px] text-[#0194F3]" aria-hidden="true" />
                <span>{btnText}</span>
              </span>
            );
          } else if (boldText) {
            const cleanBold = boldText.trim();
            tokens.push(
              <strong key={tokenKey++} className="font-semibold text-slate-900">
                {cleanBold}
              </strong>
            );
          }

          remaining = remaining.slice(match.index + fullMatch.length);
        }

        return <p key={lIdx}>{tokens}</p>;
      })}
    </div>
  );
}

interface CopilotRecommendationCardProps {
  rec: PlaceRecommendation;
  recIdx: number;
  msgIndex: number;
  activeActionMenu: { msgIndex: number; recIndex: number; type: 'add' | 'swap' } | null;
  onToggleActionMenu: (menu: { msgIndex: number; recIndex: number; type: 'add' | 'swap' } | null) => void;
  days?: ItineraryDay[];
  existingActivities: Array<{
    dayNumber: number;
    placeId?: string;
    placeName: string;
    startTime?: string | null;
    categoryName?: string | null;
    imageUrl?: string | null;
  }>;
  isPending: boolean;
  onLocatePlaceOnMap?: (target: LocatePlaceTarget) => void;
  onSendAction: (text: string) => void;
}

/**
 * Interactive Recommendation Card with visual thumbnail, rich meta, and harmonized actions.
 * Complies with TripGenie DESIGN.md & antislop guidelines.
 */
function CopilotRecommendationCard({
  rec,
  recIdx,
  msgIndex,
  activeActionMenu,
  onToggleActionMenu,
  days,
  existingActivities,
  isPending,
  onLocatePlaceOnMap,
  onSendAction,
}: CopilotRecommendationCardProps) {
  const { t } = useI18n();
  const isAddOpen =
    activeActionMenu?.msgIndex === msgIndex &&
    activeActionMenu?.recIndex === recIdx &&
    activeActionMenu?.type === 'add';

  const isSwapOpen =
    activeActionMenu?.msgIndex === msgIndex &&
    activeActionMenu?.recIndex === recIdx &&
    activeActionMenu?.type === 'swap';

  const matchedActivity = useMemo(() => {
    const clean = rec.name.toLowerCase().trim();
    return existingActivities.find(
      (a) => a.placeName.toLowerCase().includes(clean) || clean.includes(a.placeName.toLowerCase())
    );
  }, [existingActivities, rec.name]);

  const [resolvedInfo, setResolvedInfo] = useState<PlaceResolvedInfo | null>(() => {
    if (matchedActivity?.imageUrl) {
      return {
        id: matchedActivity.placeId,
        imageUrl: matchedActivity.imageUrl,
        categoryLabel: matchedActivity.categoryName || undefined,
      };
    }
    return PLACE_INFO_CACHE.get(rec.name.toLowerCase().trim()) || null;
  });

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const cacheKey = rec.name.toLowerCase().trim();
    if (resolvedInfo?.imageUrl || PLACE_INFO_CACHE.has(cacheKey)) {
      if (!resolvedInfo && PLACE_INFO_CACHE.has(cacheKey)) {
        setResolvedInfo(PLACE_INFO_CACHE.get(cacheKey) || null);
      }
      return;
    }

    let active = true;
    placeService
      .searchPlaces({ keyword: rec.name, limit: 1 })
      .then((res) => {
        if (!active) return;
        const first = res.places?.[0];
        if (first) {
          const info: PlaceResolvedInfo = {
            id: first.id,
            imageUrl: first.coverImage || first.images?.[0] || '',
            categoryLabel: first.categoryLabel || undefined,
            address: first.address,
            latitude: first.latitude,
            longitude: first.longitude,
            rating: first.rating,
          };
          PLACE_INFO_CACHE.set(cacheKey, info);
          setResolvedInfo(info);
        }
      })
      .catch(() => {
        // Fallback remains active gracefully
      });

    return () => {
      active = false;
    };
  }, [rec.name, resolvedInfo]);

  return (
    <div
      className={`group p-3 rounded-2xl border transition-all flex flex-col gap-2.5 shadow-2xs ${
        isAddOpen || isSwapOpen
          ? 'bg-sky-50/30 border-sky-300 ring-1 ring-sky-200'
          : 'bg-white border-slate-200/90 hover:border-sky-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Place Thumbnail */}
        <div className="relative size-14 sm:size-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200/80">
          {resolvedInfo?.imageUrl && !imgError ? (
            <img
              src={resolvedInfo.imageUrl}
              alt={rec.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50/60 text-slate-400">
              <i className="fa-solid fa-location-dot text-base text-[#0194F3]/70" aria-hidden="true" />
            </div>
          )}
          {/* Index Badge */}
          <span className="absolute top-1 left-1 size-5 rounded-md bg-[#10243A]/80 backdrop-blur-xs text-white text-[10px] font-bold flex items-center justify-center">
            {recIdx + 1}
          </span>
        </div>

        {/* Place Information */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-1.5">
            <h4 className="text-xs sm:text-[13px] font-semibold text-slate-900 group-hover:text-[#0194F3] transition-colors leading-snug truncate">
              {rec.name}
            </h4>
            {resolvedInfo?.categoryLabel && (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                {resolvedInfo.categoryLabel}
              </span>
            )}
          </div>

          {rec.description && (
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
              {rec.description}
            </p>
          )}
        </div>
      </div>

      {/* Full-width Action Toolbar: Guaranteed 1 single row on all widths */}
      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100/90 w-full">
        {onLocatePlaceOnMap ? (
          <button
            type="button"
            onClick={() =>
              onLocatePlaceOnMap({
                id: resolvedInfo?.id,
                name: rec.name,
                latitude: resolvedInfo?.latitude,
                longitude: resolvedInfo?.longitude,
                address: resolvedInfo?.address,
                rating: resolvedInfo?.rating,
                categoryName: resolvedInfo?.categoryLabel,
                imageUrl: resolvedInfo?.imageUrl,
              })
            }
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
            title={t('planner.copilot.recMapTitle')}
          >
            <i className="fa-solid fa-location-dot text-[10px] text-[#0194F3]" aria-hidden="true" />
            <span>{t('planner.copilot.recMapBtn')}</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* [+ Thêm] Button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              onToggleActionMenu(isAddOpen ? null : { msgIndex, recIndex: recIdx, type: 'add' });
            }}
            className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0 ${
              isAddOpen
                ? 'bg-[#0194F3] text-white border border-[#0194F3] ring-2 ring-sky-200'
                : 'bg-sky-50 hover:bg-sky-100/90 border border-sky-200/90 text-sky-800'
            }`}
            title={t('planner.copilot.recAddTitle')}
          >
            <i className={`fa-solid fa-plus text-[10px] ${isAddOpen ? 'text-white' : 'text-[#0194F3]'}`} aria-hidden="true" />
            <span>{t('planner.copilot.recAddBtn')}</span>
          </button>

          {/* [⇄ Đổi] Button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              onToggleActionMenu(isSwapOpen ? null : { msgIndex, recIndex: recIdx, type: 'swap' });
            }}
            className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 border shrink-0 ${
              isSwapOpen
                ? 'bg-sky-50 border-[#0194F3] text-sky-950 ring-2 ring-sky-200'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title={t('planner.copilot.recSwapTitle')}
          >
            <i className="fa-solid fa-right-left text-[10px] text-slate-400" aria-hidden="true" />
            <span>{t('planner.copilot.recSwapBtn')}</span>
          </button>
        </div>
      </div>

      {/* Subpanel for [+ Thêm] */}
      {isAddOpen && (
        <div className="pt-2.5 border-t border-sky-200/70 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <i className="fa-regular fa-calendar-plus text-xs text-[#0194F3]" aria-hidden="true" />
              <span>{t('planner.copilot.recChooseDay')}</span>
            </span>
            <button
              type="button"
              onClick={() => onToggleActionMenu(null)}
              aria-label={t('planner.copilot.recCloseDayAria')}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {days && days.length > 0 ? (
              days.map((d) => (
                <button
                  key={d.dayNumber}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onSendAction(
                      t('planner.copilot.promptAddDay', { place: rec.name, day: d.dayNumber })
                    );
                    onToggleActionMenu(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F0F7FF] hover:border-[#0194F3]/50 border border-slate-200 text-slate-700 hover:text-[#0194F3] font-medium text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-regular fa-calendar text-[10px] text-[#0194F3]" aria-hidden="true" />
                  <span>{t('planner.common.day', { n: d.dayNumber })}</span>
                </button>
              ))
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  onSendAction(t('planner.copilot.promptAddDay', { place: rec.name, day: 1 }));
                  onToggleActionMenu(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F0F7FF] hover:border-[#0194F3]/50 border border-slate-200 text-slate-700 hover:text-[#0194F3] font-medium text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <i className="fa-regular fa-calendar text-[10px] text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.common.day', { n: 1 })}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                onSendAction(t('planner.copilot.promptAddAuto', { place: rec.name }));
                onToggleActionMenu(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F0F7FF] hover:bg-sky-100 border border-[#D0E7FF] text-[#0068B8] font-semibold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[10px] text-[#0194F3]" aria-hidden="true" />
              <span>{t('planner.copilot.recAutoDay')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Subpanel for [⇄ Đổi] */}
      {isSwapOpen && (
        <div className="pt-2.5 border-t border-sky-200/70 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-right-left text-xs text-[#0194F3]" aria-hidden="true" />
              <span>{t('planner.copilot.recChooseReplace')}</span>
            </span>
            <button
              type="button"
              onClick={() => onToggleActionMenu(null)}
              aria-label={t('planner.copilot.recCloseReplaceAria')}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
            </button>
          </div>

          {existingActivities.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
              {existingActivities.map((act) => (
                <button
                  key={`${act.dayNumber}-${act.placeId || act.placeName}`}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onSendAction(
                      t('planner.copilot.promptSwapSpecific', {
                        oldPlace: act.placeName,
                        newPlace: rec.name,
                      })
                    );
                    onToggleActionMenu(null);
                  }}
                  className="w-full text-left p-2 rounded-xl bg-white hover:bg-[#F0F7FF] hover:border-[#0194F3]/40 border border-slate-200 transition-colors flex items-center justify-between text-xs group cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] text-[#0194F3] font-semibold block">
                      {t('planner.common.day', { n: act.dayNumber })}
                      {act.startTime ? ` • ${act.startTime}` : ''}
                      {act.categoryName ? ` • ${act.categoryName}` : ''}
                    </span>
                    <span className="font-medium text-slate-800 truncate block group-hover:text-slate-900">
                      {act.placeName}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#0194F3] bg-sky-50 group-hover:bg-[#0194F3] group-hover:text-white px-2 py-0.5 rounded-md border border-sky-200/80 shrink-0 transition-colors">
                    {t('planner.copilot.recReplaceThis')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              onSendAction(t('planner.copilot.promptSwapAuto', { newPlace: rec.name }));
              onToggleActionMenu(null);
            }}
            className="w-full text-center py-2 px-3 rounded-xl bg-slate-50 hover:bg-[#F0F7FF] hover:text-[#0194F3] text-slate-700 font-medium text-xs transition-colors cursor-pointer border border-slate-200 hover:border-[#0194F3]/30 flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-xs text-[#0194F3]" aria-hidden="true" />
            <span>{t('planner.copilot.recAutoReplace')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  days?: ItineraryDay[];
  messages: CopilotMessageItem[];
  isPending: boolean;
  onSendMessage: (msg?: string) => void;
  onConfirmProposal: (index: number, proposal: CopilotProposal) => Promise<void>;
  onRejectProposal: (index: number) => void;
  applyingProposalId: string | null;
  onOpenWizard?: (destination: string) => void;
  onResetSession?: () => void;
  prefilledInput?: string;
  onClearPrefilledInput?: () => void;
  onLocatePlaceOnMap?: (target: LocatePlaceTarget) => void;
  canEdit?: boolean;
}

export default function CopilotDrawer({
  isOpen,
  onClose,
  days,
  messages,
  isPending,
  onSendMessage,
  onConfirmProposal,
  onRejectProposal,
  applyingProposalId,
  onOpenWizard,
  onResetSession,
  prefilledInput,
  onClearPrefilledInput,
  onLocatePlaceOnMap,
  canEdit = true,
}: CopilotDrawerProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');
  const [activeActionMenu, setActiveActionMenu] = useState<{
    msgIndex: number;
    recIndex: number;
    type: 'add' | 'swap';
  } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const existingActivities = useMemo(() => {
    if (!days || days.length === 0) return [];
    return days.flatMap((d) =>
      (d.activities || []).map((a) => ({
        ...a,
        dayNumber: d.dayNumber,
      }))
    );
  }, [days]);

  // Sync prefilledInput if provided (e.g. from PlaceAlternativesModal)
  useEffect(() => {
    if (prefilledInput) {
      setInputValue(prefilledInput);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          textareaRef.current.focus();
        }
      }, 100);
      onClearPrefilledInput?.();
    }
  }, [prefilledInput, onClearPrefilledInput]);

  // Auto-scroll chat stream to bottom
  useEffect(() => {
    if (isOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isPending, isOpen]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-resize textarea height
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isPending) return;
    onSendMessage(text);
    if (!textToSend) {
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] md:w-[490px] bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out">
      {/* =========================================================================
          MESSENGER APP HEADER (Avatar, Status Dot, Controls)
          ========================================================================= */}
      <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-[#F5F9FF] shrink-0">
            <TripGenieMark className="size-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#10243A] leading-tight">
              {t('planner.copilot.title')}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('planner.copilot.subtitleDefault')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onResetSession && (
            <button
              type="button"
              onClick={onResetSession}
              aria-label={t('planner.copilot.resetSessionTitle')}
              className="size-8 rounded-full text-slate-400 hover:text-[#0194F3] hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title={t('planner.copilot.resetSessionTitle')}
            >
              <i className="fa-solid fa-rotate-left text-xs" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t('planner.copilot.closeTitle')}
            className="size-8 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title={t('planner.copilot.closeTitle')}
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          MESSENGER CONVERSATION STREAM WITH WALLPAPER PATTERN
          ========================================================================= */}
      <div
        ref={chatScrollRef}
        className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-[13px]"
        style={{
          backgroundColor: '#F8FAFC',
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {messages.map((msg, i) => {
          const isUser = msg.sender === 'user';
          const recommendations = !isUser ? parsePlaceRecommendations(msg.text) : [];

          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Speech Bubble Container with Avatar for AI */}
                <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isUser && (
                    <div className="size-7 rounded-full bg-[#0194F3] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-white">
                      <i className="fa-solid fa-compass text-xs" aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 sm:p-4 leading-relaxed transition-all ${
                      isUser
                        ? 'bg-[#0194F3] text-white font-medium rounded-2xl rounded-tr-xs shadow-xs'
                        : 'bg-white border border-slate-200/90 text-[#10243A] rounded-2xl rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {/* Tool Execution Tag */}
                    {msg.appliedTool && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F0F7FF] text-[#10243A] font-semibold text-[11px] border border-[#D0E7FF]">
                          <i className="fa-solid fa-check text-[10px] text-[#0194F3]" aria-hidden="true" />
                          <span>{msg.appliedTool.resultMessage}</span>
                        </span>
                      </div>
                    )}

                    {/* Clean Formatted Message Text (No raw asterisks or deep links) */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <FormattedMessageText text={msg.text} />
                    )}
                  </div>
                </div>

                {/* Micro Subtitle / Sender Label */}
                <div className={`px-2 flex items-center gap-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start pl-9'}`}>
                  {isUser ? (
                    <span>{t('planner.common.you')}</span>
                  ) : (
                    <>
                      <i className="fa-solid fa-compass text-[9px] text-[#0194F3]" aria-hidden="true" />
                      <span>{t('planner.copilot.title')}</span>
                    </>
                  )}
                </div>

                {/* =====================================================================
                    GENERATIVE UI: INTERACTIVE PLACE RECOMMENDATION CARDS
                    ===================================================================== */}
                {recommendations.length > 0 && (
                  <div className="ml-9 p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1.5 text-slate-900">
                        <i className="fa-solid fa-location-dot text-xs text-[#0194F3]" aria-hidden="true" />
                        <span>{t('planner.copilot.recHeading')}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                        {t('planner.copilot.recCount', { count: recommendations.length })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 pt-0.5">
                      {recommendations.map((rec, recIdx) => (
                        <CopilotRecommendationCard
                          key={recIdx}
                          rec={rec}
                          recIdx={recIdx}
                          msgIndex={i}
                          activeActionMenu={activeActionMenu}
                          onToggleActionMenu={setActiveActionMenu}
                          days={days}
                          existingActivities={existingActivities}
                          isPending={isPending}
                          onLocatePlaceOnMap={onLocatePlaceOnMap}
                          onSendAction={handleSend}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* =====================================================================
                    SMART PROPOSAL DIFF CARD (Before -> After Comparison)
                    ===================================================================== */}
                {msg.proposal && (
                  <div className="ml-9 p-3.5 sm:p-4 rounded-2xl bg-white border border-sky-200/90 text-slate-800 space-y-3 shadow-xs animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs">
                        <i className="fa-solid fa-compass text-xs text-[#0194F3]" aria-hidden="true" />
                        <span>{msg.proposal.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#F0F7FF] text-[#0194F3] border border-[#D0E7FF] text-[10px] font-semibold">
                        {t('planner.copilot.pendingConfirmBadge')}
                      </span>
                    </div>

                    {/* Diff: From Place -> To Place */}
                    {msg.proposal.fromPlaceName && msg.proposal.toPlaceName ? (
                      <div className="space-y-2">
                        {/* Old Place */}
                        <div
                          onClick={() => {
                            if (msg.proposal?.fromPlaceName && onLocatePlaceOnMap) {
                              onLocatePlaceOnMap({
                                id: msg.proposal.fromPlaceId,
                                name: msg.proposal.fromPlaceName,
                                latitude: msg.proposal.fromPlaceCoordinates?.latitude,
                                longitude: msg.proposal.fromPlaceCoordinates?.longitude,
                              });
                            }
                          }}
                          className="bg-slate-50/80 p-2.5 rounded-xl border border-rose-200/70 flex items-start justify-between gap-2 cursor-pointer hover:bg-rose-50/50 transition-colors group"
                          title={t('planner.copilot.clickOldPlaceTitle')}
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider">
                              {t('planner.copilot.currentPlaceLabel')}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 line-through decoration-rose-400 group-hover:text-rose-900">
                              {msg.proposal.fromPlaceName}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-semibold shrink-0 flex items-center gap-1">
                            <i className="fa-solid fa-location-dot text-[9px] text-rose-500" aria-hidden="true" />
                            {t('planner.copilot.oldBadge')}
                          </span>
                        </div>

                        {/* Arrow Separator */}
                        <div className="flex justify-center -my-1">
                          <div className="size-6 rounded-full bg-[#F0F7FF] border border-[#D0E7FF] text-[#0194F3] flex items-center justify-center shadow-2xs">
                            <i className="fa-solid fa-arrow-down text-[10px]" aria-hidden="true" />
                          </div>
                        </div>

                        {/* New Proposed Place */}
                        <div className="bg-[#F8FAFC] p-3 rounded-xl border border-sky-300 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[#0194F3] uppercase tracking-wider flex items-center gap-1">
                              <i className="fa-solid fa-right-left text-[10px] text-[#0194F3]" aria-hidden="true" />
                              {t('planner.copilot.proposedSwapLabel')}
                            </span>
                            {msg.proposal.toPlaceRating && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200/70 tabular-nums">
                                <i className="fa-solid fa-star text-[9px] text-amber-500" aria-hidden="true" />
                                <span>{msg.proposal.toPlaceRating.toFixed(1)}</span>
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                              {msg.proposal.toPlaceName}
                            </p>
                            {msg.proposal.toPlaceAddress && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate pt-0.5">
                                <i className="fa-solid fa-location-dot text-[10px] text-slate-400 shrink-0" aria-hidden="true" />
                                <span className="truncate">{msg.proposal.toPlaceAddress}</span>
                              </p>
                            )}
                          </div>

                          {/* Quick Map Locate Button */}
                          {onLocatePlaceOnMap && (
                            <button
                              type="button"
                              onClick={() => {
                                onLocatePlaceOnMap({
                                  id: msg.proposal?.toPlaceId,
                                  name: msg.proposal?.toPlaceName || '',
                                  latitude: msg.proposal?.toPlaceCoordinates?.latitude,
                                  longitude: msg.proposal?.toPlaceCoordinates?.longitude,
                                  address: msg.proposal?.toPlaceAddress,
                                  rating: msg.proposal?.toPlaceRating,
                                  categoryName: msg.proposal?.toPlaceCategory,
                                  imageUrl: msg.proposal?.toPlaceImageUrl,
                                });
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-950 text-xs font-medium border border-slate-200/90 transition-colors cursor-pointer shadow-2xs"
                            >
                              <i className="fa-solid fa-location-dot text-[10px] text-[#0194F3]" aria-hidden="true" />
                              <span>{t('planner.copilot.locateOnMap')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : msg.proposal.swapDays ? (
                      <div className="bg-white p-3 rounded-xl border border-sky-200 text-xs text-sky-900 font-semibold flex items-center justify-between shadow-2xs">
                        <span className="text-slate-600 font-medium">
                          {t('planner.copilot.swapDaysLabel')}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-[#F0F7FF] text-[#0194F3] border border-[#D0E7FF] font-semibold tabular-nums">
                          {t('planner.copilot.swapDaysValue', {
                            dayA: msg.proposal.swapDays.dayA,
                            dayB: msg.proposal.swapDays.dayB,
                          })}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                        {msg.proposal.description}
                      </p>
                    )}

                    {/* Proposal Action Buttons */}
                    {(!msg.proposalStatus || msg.proposalStatus === 'PENDING') && (
                      canEdit ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={applyingProposalId !== null}
                            onClick={() => onConfirmProposal(i, msg.proposal!)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer min-h-[40px]"
                          >
                            {applyingProposalId === msg.proposal.id ? (
                              <>
                                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                                <span>{t('planner.copilot.applying')}</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-check text-xs" aria-hidden="true" />
                                <span>{t('planner.copilot.applyToItinerary')}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={applyingProposalId !== null}
                            onClick={() => onRejectProposal(i)}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer min-h-[40px]"
                          >
                            {t('planner.copilot.skip')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
                          <span>{t('planner.copilot.viewerProposalHint')}</span>
                          <button
                            type="button"
                            onClick={() => onRejectProposal(i)}
                            className="shrink-0 text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                          >
                            {t('planner.copilot.hide')}
                          </button>
                        </div>
                      )
                    )}

                    {msg.proposalStatus === 'APPLIED' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                        <i className="fa-solid fa-check text-xs text-emerald-600" aria-hidden="true" />
                        <span>{t('planner.copilot.appliedBanner')}</span>
                      </div>
                    )}

                    {msg.proposalStatus === 'REJECTED' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-100 px-3 py-2 rounded-xl">
                        <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
                        <span>{t('planner.copilot.rejectedBanner')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Destination Change Wizard Link */}
                {msg.action?.type === 'CREATE_NEW_TRIP' && onOpenWizard && (
                  <div className="ml-9 mt-1">
                    <button
                      type="button"
                      onClick={() => onOpenWizard(msg.action!.destination)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-plane-departure text-xs" aria-hidden="true" />
                      <span>
                        {t('planner.copilot.openWizardForDest', { dest: msg.action.destination })}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* AI Thinking Indicator */}
        {isPending && (
          <div className="flex justify-start">
            <AiThinkingIndicator context="copilot" />
          </div>
        )}
      </div>

      {/* =========================================================================
          QUICK CHIP SUGGESTIONS BAR
          ========================================================================= */}
      <div className="px-3 py-2 border-t border-slate-200/80 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend(t('planner.copilot.chipSwapLunchPrompt'))}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/30 border border-slate-200/80 text-slate-700 text-xs font-medium rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <i className="fa-solid fa-utensils text-[10px] text-amber-500" aria-hidden="true" />
          <span>{t('planner.copilot.chipSwapLunchLabel')}</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend(t('planner.copilot.chipCafePrompt'))}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/30 border border-slate-200/80 text-slate-700 text-xs font-medium rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <i className="fa-solid fa-mug-hot text-[10px] text-[#0194F3]" aria-hidden="true" />
          <span>{t('planner.copilot.chipCafeLabel')}</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend(t('planner.copilot.chipSwapDaysPrompt'))}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/30 border border-slate-200/80 text-slate-700 text-xs font-medium rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <i className="fa-regular fa-calendar text-[10px] text-[#0194F3]" aria-hidden="true" />
          <span>{t('planner.copilot.chipSwapDaysLabel')}</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend(t('planner.copilot.chipChangeDestPrompt'))}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/30 border border-slate-200/80 text-slate-700 text-xs font-medium rounded-full transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <i className="fa-solid fa-compass text-[10px] text-emerald-600" aria-hidden="true" />
          <span>{t('planner.copilot.chipChangeDestLabel')}</span>
        </button>
      </div>

      {/* =========================================================================
          MESSENGER-STYLE FLOATING CAPSULE INPUT BAR
          ========================================================================= */}
      <div className="p-3 sm:p-3.5 border-t border-slate-200/80 bg-white">
        <div className="relative flex items-end gap-2 p-1.5 pl-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] focus-within:bg-white focus-within:border-[#0194F3] focus-within:ring-2 focus-within:ring-[#0194F3]/20 transition-all shadow-2xs">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={isPending}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isPending
                ? t('planner.copilot.inputPendingPlaceholder')
                : t('planner.copilot.inputPlaceholder')
            }
            className="flex-1 bg-transparent resize-none max-h-32 py-1.5 text-xs sm:text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 leading-relaxed font-sans"
          />

          <button
            type="button"
            disabled={isPending || !inputValue.trim()}
            onClick={() => handleSend()}
            aria-label={t('planner.copilot.sendAria')}
            className="size-9 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] disabled:opacity-30 disabled:bg-slate-300 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs disabled:cursor-not-allowed active:scale-95"
            title={t('planner.copilot.sendAria')}
          >
            {isPending ? (
              <i className="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
          <span>{t('planner.copilot.inputShortcutHint')}</span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-wand-magic-sparkles text-[9px] text-[#0194F3]" aria-hidden="true" />
            <span>{t('planner.copilot.brandFooter')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
