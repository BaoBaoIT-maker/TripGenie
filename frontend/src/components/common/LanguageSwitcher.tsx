'use client';

import * as React from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALE_METADATA, SUPPORTED_LOCALES } from '@/i18n/config';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'light' | 'transparent' | 'mobile';
  className?: string;
}

export function LanguageSwitcher({
  variant = 'light',
  className,
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const activeMeta = LOCALE_METADATA[locale];
  const isTransparent = variant === 'transparent';
  const isMobile = variant === 'mobile';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('common.languageSwitcherLabel')}
        className={cn(
          'inline-flex items-center justify-between gap-1.5 rounded-xl font-semibold transition-all cursor-pointer outline-none select-none',
          isMobile
            ? 'w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 focus-visible:ring-2 focus-visible:ring-[#0194F3]/40'
            : isTransparent
              ? 'h-9 px-2.5 text-xs font-bold text-white/95 bg-white/12 hover:bg-white/20 border border-white/25 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-white/60'
              : 'h-9 px-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 focus-visible:ring-2 focus-visible:ring-[#0194F3]/40',
          className,
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Globe
            className={cn(
              'shrink-0',
              isMobile ? 'size-4 text-[#0194F3]' : 'size-3.5',
              !isMobile && (isTransparent ? 'text-white/90' : 'text-slate-500'),
            )}
          />
          <span className="truncate">
            {isMobile ? activeMeta.displayLabel : activeMeta.shortLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'shrink-0 transition-transform duration-150',
            isMobile ? 'size-4 text-slate-400' : 'size-3.5 opacity-75',
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isMobile ? 'start' : 'end'}
        side="bottom"
        sideOffset={8}
        className={cn(
          'z-[60] p-1 rounded-xl border border-slate-200/90 bg-white shadow-lg',
          isMobile ? 'w-(--anchor-width) min-w-[220px]' : 'w-56',
        )}
      >
        {SUPPORTED_LOCALES.map((code) => {
          const meta = LOCALE_METADATA[code];
          const isActive = locale === code;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setLocale(code)}
              className={cn(
                'flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors',
                isActive
                  ? 'bg-sky-50 text-[#0194F3] font-semibold focus:bg-sky-50 focus:text-[#0194F3]'
                  : 'text-slate-700 font-medium hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-900',
              )}
            >
              <span className="truncate">{meta.displayLabel}</span>
              {isActive && <Check className="size-4 shrink-0 text-[#0194F3]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
