'use client';

import * as React from 'react';
import Link from 'next/link';
import { ADVISOR_UI_CONSTANTS, AdvisorMessageItem } from '@/types/advisor';
import { useI18n, type TranslationKey } from '@/i18n';
import { AdvisorPlaceCard } from './AdvisorPlaceCard';

const INTERNAL_ROUTE_PATHS = Object.keys(ADVISOR_UI_CONSTANTS.INTERNAL_ROUTES);
const INTERNAL_ROUTE_KEYS: Record<string, TranslationKey> = {
  '/planner': 'advisor.routes.planner',
  '/explore': 'advisor.routes.explore',
  '/community': 'advisor.routes.community',
};
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
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
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

    const routeKey = INTERNAL_ROUTE_KEYS[part];
    const routeLabel = routeKey ? t(routeKey) : ADVISOR_UI_CONSTANTS.INTERNAL_ROUTES[part];
    if (routeLabel) {
      return (
        <Link
          key={idx}
          href={part}
          onClick={onNavigate}
          className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground underline-offset-2 transition-colors motion-reduce:transition-none hover:bg-primary hover:text-primary-foreground"
        >
          <span>{routeLabel}</span>
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
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
  const { t } = useI18n();
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

  return (
    <div className="flex flex-col space-y-2.5">
      <div className="min-w-0 space-y-2.5">
        <div
          className={`rounded-2xl rounded-tl-xs border px-4 py-3 text-sm leading-relaxed shadow-2xs ${
            message.isError
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-card text-card-foreground'
          }`}
        >
          {message.isError && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <i className="fa-solid fa-circle-exclamation text-xs shrink-0" aria-hidden="true" />
              <span>{t('advisor.connectionNotice')}</span>
            </div>
          )}

          <div className="space-y-1.5">
            {message.content.split('\n').map((rawLine, idx) => {
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
                    {renderInlineFormattedText(trimmed.slice(4), t, onNavigate)}
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
                      {renderInlineFormattedText(trimmed.slice(2), t, onNavigate)}
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
                    {renderInlineFormattedText(quoteText, t, onNavigate)}
                  </blockquote>
                );
              }

              return (
                <p key={idx} className="break-words">
                  {renderInlineFormattedText(rawLine, t, onNavigate)}
                </p>
              );
            })}
          </div>
        </div>

        {Array.isArray(message.places) && message.places.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold text-muted-foreground">
              {t('advisor.suggestedPlacesHeading', { count: message.places.length })}
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
