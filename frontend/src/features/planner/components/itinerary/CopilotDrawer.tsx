'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Check,
  Loader2,
  ArrowRight,
  MapPin,
  UtensilsCrossed,
  RotateCcw,
  Star,
  Compass,
  Calendar,
  Sparkle,
} from 'lucide-react';
import { CopilotProposal } from '@/types/itinerary';

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
 * Rich formatted message text parser that cleans markdown artifacts:
 * - Parses **[Action]** or [Action] into aesthetic button badges
 * - Parses **Place Name** into clickable interactive chips that locate on the map
 * - Renders clean paragraphs without raw markdown asterisks or brackets
 */
function FormattedMessageText({
  text,
  onLocatePlace,
}: {
  text: string;
  onLocatePlace?: (placeName: string) => void;
}) {
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
                className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg bg-teal-100/90 text-teal-900 font-bold text-[11px] border border-teal-200/80 shadow-2xs select-none"
              >
                <Check className="size-3 text-teal-700 inline" />
                <span>{btnText}</span>
              </span>
            );
          } else if (boldText) {
            const cleanBold = boldText.trim();
            const isPlaceCandidate =
              cleanBold.length >= 4 &&
              !cleanBold.toLowerCase().includes('lưu ý') &&
              !cleanBold.toLowerCase().includes('tóm tắt') &&
              !cleanBold.toLowerCase().includes('quy tắc') &&
              !cleanBold.toLowerCase().includes('áp dụng');

            if (isPlaceCandidate && onLocatePlace) {
              tokens.push(
                <button
                  type="button"
                  key={tokenKey++}
                  onClick={() => onLocatePlace(cleanBold)}
                  className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-850 hover:text-teal-950 font-bold transition-all cursor-pointer border border-teal-200/70 text-[11px] sm:text-xs"
                  title={`Bấm để xem "${cleanBold}" trên bản đồ`}
                >
                  <MapPin className="size-3 text-teal-600 inline shrink-0" />
                  <span>{cleanBold}</span>
                </button>
              );
            } else {
              tokens.push(
                <strong key={tokenKey++} className="font-bold text-slate-900">
                  {cleanBold}
                </strong>
              );
            }
          }

          remaining = remaining.slice(match.index + fullMatch.length);
        }

        return <p key={lIdx}>{tokens}</p>;
      })}
    </div>
  );
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
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
}

export default function CopilotDrawer({
  isOpen,
  onClose,
  destination,
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
}: CopilotDrawerProps) {
  const [inputValue, setInputValue] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="relative size-10 rounded-full bg-gradient-to-tr from-teal-500 via-emerald-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0 border-2 border-white">
            <Bot className="size-5" />
            <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Genie Copilot
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-extrabold tracking-wide">
                AI
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Trực tuyến • Sẵn sàng hỗ trợ</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onResetSession && (
            <button
              type="button"
              onClick={onResetSession}
              className="size-8 rounded-full text-slate-400 hover:text-teal-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Làm mới phiên trò chuyện"
            >
              <RotateCcw className="size-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng khung chat"
          >
            <X className="size-4" />
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
          backgroundColor: '#f1f5f9',
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.25) 1.2px, transparent 1.2px)',
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
                    <div className="size-7 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-white">
                      <Bot className="size-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 sm:p-4 leading-relaxed transition-all ${
                      isUser
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-medium rounded-2xl rounded-tr-xs shadow-xs'
                        : 'bg-white/95 backdrop-blur-sm border border-slate-200/90 text-slate-850 rounded-2xl rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {/* Tool Execution Tag */}
                    {msg.appliedTool && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-850 font-bold text-[11px] border border-teal-200/80 shadow-2xs">
                          <Sparkles className="size-3 text-teal-600" />
                          <span>{msg.appliedTool.resultMessage}</span>
                        </span>
                      </div>
                    )}

                    {/* Clean Formatted Message Text (No raw asterisks or brackets) */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <FormattedMessageText
                        text={msg.text}
                        onLocatePlace={(name) => onLocatePlaceOnMap?.({ name })}
                      />
                    )}
                  </div>
                </div>

                {/* Micro Subtitle / Sender Label */}
                <div className={`px-2 flex items-center gap-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start pl-9'}`}>
                  {isUser ? (
                    <span>Bạn</span>
                  ) : (
                    <>
                      <Sparkles className="size-2.5 text-teal-600" />
                      <span>Genie Copilot</span>
                    </>
                  )}
                </div>

                {/* =====================================================================
                    GENERATIVE UI: INTERACTIVE PLACE RECOMMENDATION CARDS (Mindtrip Style)
                    With 1-Click Map Locate & 1-Click Pick Buttons
                    ===================================================================== */}
                {recommendations.length > 0 && (
                  <div className="ml-9 p-3 bg-white/95 border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1.5 text-teal-800">
                        <Sparkles className="size-3 text-teal-600" />
                        <span>Gợi ý địa điểm tương đương:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {recommendations.length} địa điểm
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-0.5">
                      {recommendations.map((rec, recIdx) => (
                        <div
                          key={recIdx}
                          className="group p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-teal-50/40 hover:border-teal-300 transition-all flex items-start justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="size-5 rounded-md bg-teal-100 text-teal-850 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {recIdx + 1}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-900 truncate">
                                {rec.name}
                              </h4>
                            </div>
                            {rec.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 pl-6">
                                {rec.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            {onLocatePlaceOnMap && (
                              <button
                                type="button"
                                onClick={() => onLocatePlaceOnMap({ name: rec.name })}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="Xem vị trí trên bản đồ"
                              >
                                <MapPin className="size-3 text-teal-600" />
                                <span className="hidden sm:inline">Bản đồ</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSend(`Đổi thành ${rec.name}`)}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <span>Chọn</span>
                              <ArrowRight className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* =====================================================================
                    SMART PROPOSAL DIFF CARD (Before -> After Comparison)
                    With Interactive Map Locating Buttons
                    ===================================================================== */}
                {msg.proposal && (
                  <div className="ml-9 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-teal-50/95 via-emerald-50/60 to-indigo-50/50 border-2 border-teal-300 text-slate-800 space-y-3 shadow-sm animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                      <div className="flex items-center gap-1.5 text-teal-900 font-extrabold text-xs">
                        <Sparkles className="size-3.5 text-teal-600" />
                        <span>{msg.proposal.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-teal-100/90 text-teal-850 text-[10px] font-bold">
                        Chờ xác nhận
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
                          className="bg-white/90 p-2.5 rounded-xl border border-rose-200/60 flex items-start justify-between gap-2 cursor-pointer hover:bg-rose-50/60 transition-colors group"
                          title="Bấm để xem địa điểm cũ trên bản đồ"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider">
                              Địa điểm hiện tại
                            </span>
                            <span className="text-xs font-semibold text-slate-700 line-through decoration-rose-400 group-hover:text-rose-900">
                              {msg.proposal.fromPlaceName}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold shrink-0 flex items-center gap-1">
                            <MapPin className="size-2.5 text-rose-500" />
                            Cũ
                          </span>
                        </div>

                        {/* Arrow Separator */}
                        <div className="flex justify-center -my-1">
                          <div className="size-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
                            <ArrowRight className="size-3 rotate-90" />
                          </div>
                        </div>

                        {/* New Proposed Place */}
                        <div className="bg-white/95 p-3 rounded-xl border-2 border-teal-400 shadow-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="size-3 text-teal-600" />
                              Đề xuất đổi sang
                            </span>
                            {msg.proposal.toPlaceRating && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200/70">
                                <Star className="size-2.5 fill-amber-500 text-amber-500" />
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
                                <MapPin className="size-3 text-slate-400 shrink-0" />
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
                              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-850 text-[11px] font-bold border border-teal-200/80 transition-colors cursor-pointer"
                            >
                              <MapPin className="size-3 text-teal-600" />
                              <span>Xem địa điểm này trên bản đồ</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : msg.proposal.swapDays ? (
                      <div className="bg-white/90 p-3 rounded-xl border border-teal-200 text-xs text-teal-950 font-bold flex items-center justify-between shadow-2xs">
                        <span className="text-slate-600 font-medium">Hoán đổi lịch trình:</span>
                        <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 font-extrabold">
                          Ngày {msg.proposal.swapDays.dayA} ⇄ Ngày {msg.proposal.swapDays.dayB}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] bg-white/90 p-2.5 rounded-xl border border-teal-100 text-slate-700">
                        {msg.proposal.description}
                      </p>
                    )}

                    {/* Proposal Action Buttons */}
                    {(!msg.proposalStatus || msg.proposalStatus === 'PENDING') && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={applyingProposalId !== null}
                          onClick={() => onConfirmProposal(i, msg.proposal!)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer min-h-[40px]"
                        >
                          {applyingProposalId === msg.proposal.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Đang cập nhật lịch trình...</span>
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              <span>Áp dụng vào lịch trình</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={applyingProposalId !== null}
                          onClick={() => onRejectProposal(i)}
                          className="px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs transition-colors cursor-pointer min-h-[40px]"
                        >
                          Bỏ qua
                        </button>
                      </div>
                    )}

                    {msg.proposalStatus === 'APPLIED' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                        <Check className="size-3.5 text-emerald-600" />
                        <span>Đã áp dụng và cập nhật vào lịch trình</span>
                      </div>
                    )}

                    {msg.proposalStatus === 'REJECTED' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-100 px-3 py-2 rounded-xl">
                        <X className="size-3.5" />
                        <span>Đã bỏ qua đề xuất (Giữ nguyên lịch trình)</span>
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
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                      <Sparkles className="size-3.5 animate-spin text-amber-300" />
                      <span>🚀 Mở tạo lịch trình {msg.action.destination}</span>
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
            <div className="flex items-start gap-2">
              <div className="size-7 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-white">
                <Bot className="size-3.5" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white border border-slate-200 text-slate-600 shadow-xs flex items-center gap-2 text-xs">
                <Loader2 className="size-3.5 animate-spin text-teal-600" />
                <span>Genie đang suy nghĩ & tìm kiếm địa điểm...</span>
              </div>
            </div>
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
          onClick={() => handleSend('Đổi điểm trưa Ngày 1 sang quán ăn đặc sản')}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-750 hover:border-teal-200 border border-transparent text-slate-700 text-[11px] font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <UtensilsCrossed className="size-3 text-amber-600" />
          <span>Đổi trưa sang đặc sản</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend('Gợi ý cho tôi quán cafe đẹp ngắm cảnh gần đây')}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-750 hover:border-teal-200 border border-transparent text-slate-700 text-[11px] font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <Sparkle className="size-3 text-indigo-600" />
          <span>Gợi ý cafe đẹp</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend('Hoán đổi lịch trình Ngày 1 và Ngày 2 cho nhau')}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-750 hover:border-teal-200 border border-transparent text-slate-700 text-[11px] font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <Calendar className="size-3 text-teal-600" />
          <span>Đổi Ngày 1 & Ngày 2</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSend('Tôi muốn đổi chuyến đi sang Phú Quốc')}
          className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-750 hover:border-teal-200 border border-transparent text-slate-700 text-[11px] font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <Compass className="size-3 text-emerald-600" />
          <span>Đổi sang Phú Quốc</span>
        </button>
      </div>

      {/* =========================================================================
          MESSENGER-STYLE FLOATING CAPSULE INPUT BAR
          ========================================================================= */}
      <div className="p-3 sm:p-3.5 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="relative flex items-end gap-2 p-1.5 pl-3 rounded-2xl border border-slate-300/80 bg-slate-50 focus-within:bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all shadow-xs">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={isPending}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isPending ? 'Genie đang suy nghĩ & xử lý...' : 'Nhắn cho Genie Copilot (Shift+Enter để xuống dòng)...'}
            className="flex-1 bg-transparent resize-none max-h-32 py-1.5 text-xs sm:text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 leading-relaxed"
          />

          <button
            type="button"
            disabled={isPending || !inputValue.trim()}
            onClick={() => handleSend()}
            className="size-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-30 disabled:from-slate-400 disabled:to-slate-400 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm disabled:cursor-not-allowed active:scale-95"
            title="Gửi tin nhắn"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
          <span>Nhấn Enter để gửi • Shift + Enter xuống dòng</span>
          <span>Genie AI đồng hành</span>
        </div>
      </div>
    </div>
  );
}
