'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ADVISOR_UI_CONSTANTS, AdvisorMessageItem } from '@/types/advisor';
import { AdvisorPlaceCard } from './AdvisorPlaceCard';

const INTERNAL_ROUTE_PATHS = Object.keys(ADVISOR_UI_CONSTANTS.INTERNAL_ROUTES);
const INLINE_TOKEN_REGEX = new RegExp(
  `(\\*\\*[^*]+\\*\\*|${INTERNAL_ROUTE_PATHS.map((p) => `${p.replace('/', '\\/')}\\b`).join('|')})`,
  'g',
);

/**
 * Lightweight inline formatter that renders **bold** and converts internal route paths
 * into interactive Next.js Link chips without extra dependencies.
 * ponytail: Regex tokenizer handles single-level **bold** and configured internal routes (ceiling: nested markdown tables/code blocks; upgrade path: react-markdown if complex formatting is needed).
 */
function renderInlineFormattedText(
  text: string,
  onNavigate?: () => void,
): React.ReactNode[] {
  const parts = text.split(INLINE_TOKEN_REGEX);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const routeLabel = ADVISOR_UI_CONSTANTS.INTERNAL_ROUTES[part];
    if (routeLabel) {
      return (
        <Link
          key={idx}
          href={part}
          onClick={onNavigate}
          className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground underline-offset-2 transition-colors motion-reduce:transition-none hover:bg-primary hover:text-primary-foreground"
        >
          <span>{routeLabel}</span>
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface AdvisorMessageBubbleProps {
  message: AdvisorMessageItem;
  onNavigate?: () => void;
}

export function AdvisorMessageBubble({
  message,
  onNavigate,
}: AdvisorMessageBubbleProps) {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-xs">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  // Strip trailing raw markdown citation line if citations are already rendered as structured badges
  const hasStructuredCitations =
    Array.isArray(message.citations) && message.citations.length > 0;
  const lines = message.content
    .split('\n')
    .filter(
      (line) =>
        !(
          hasStructuredCitations &&
          line.trim().startsWith('>') &&
          line.includes('Nguồn tham khảo')
        ),
    );

  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
        aria-hidden="true"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div
          className={`rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed shadow-xs ${
            message.isError
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-card text-card-foreground'
          }`}
        >
          {message.isError && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Thông báo kết nối</span>
            </div>
          )}

          <div className="space-y-1.5">
            {lines.map((rawLine, idx) => {
              const trimmed = rawLine.trim();
              if (!trimmed) {
                return <div key={idx} className="h-1" />;
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4
                    key={idx}
                    className="pt-1 text-sm font-bold text-foreground"
                  >
                    {renderInlineFormattedText(trimmed.slice(4), onNavigate)}
                  </h4>
                );
              }

              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={idx} className="flex items-start gap-2 pl-1">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <span className="flex-1">
                      {renderInlineFormattedText(trimmed.slice(2), onNavigate)}
                    </span>
                  </div>
                );
              }

              if (trimmed.startsWith('>')) {
                const quoteText = trimmed.replace(/^>\s*/, '');
                return (
                  <blockquote
                    key={idx}
                    className="mt-2 rounded-lg border-l-2 border-primary bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {renderInlineFormattedText(quoteText, onNavigate)}
                  </blockquote>
                );
              }

              return (
                <p key={idx} className="break-words">
                  {renderInlineFormattedText(rawLine, onNavigate)}
                </p>
              );
            })}
          </div>

          {hasStructuredCitations && (
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3 w-3 text-primary" aria-hidden="true" />
                <span>Nguồn Cẩm Nang Xác Thực</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {message.citations!.map((cit, index) => (
                  <div
                    key={`${cit.documentTitle}-${index}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    <ShieldCheck
                      className="h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">
                      {cit.breadcrumbs || cit.documentTitle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {Array.isArray(message.places) && message.places.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold text-muted-foreground">
              Địa điểm gợi ý từ cơ sở dữ liệu ({message.places.length})
            </p>
            <div className="grid grid-cols-1 gap-2">
              {message.places.map((place) => (
                <AdvisorPlaceCard
                  key={place.id}
                  place={place}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
