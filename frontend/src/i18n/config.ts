export const SUPPORTED_LOCALES = ['vi', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'vi';

export const LOCALE_COOKIE_NAME = 'tripgenie_locale';

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const ACCEPT_LANGUAGE_HEADER = 'Accept-Language';

export interface LocaleMetadata {
  readonly code: Locale;
  readonly shortLabel: string;
  readonly nativeLabel: string;
  readonly displayLabel: string;
  readonly intlTag: string;
  readonly ogLocale: string;
}

export const LOCALE_METADATA: Record<Locale, LocaleMetadata> = {
  vi: {
    code: 'vi',
    shortLabel: 'VI',
    nativeLabel: 'Tiếng Việt',
    displayLabel: 'Tiếng Việt (Vietnamese)',
    intlTag: 'vi-VN',
    ogLocale: 'vi_VN',
  },
  en: {
    code: 'en',
    shortLabel: 'EN',
    nativeLabel: 'English',
    displayLabel: 'English (Tiếng Anh)',
    intlTag: 'en-US',
    ogLocale: 'en_US',
  },
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Safely parses a cookie or Accept-Language header value (e.g. "en", "en-US", "vi-VN")
 * into a supported Locale, falling back to DEFAULT_LOCALE.
 */
export function parseLocale(value?: string | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const primary = value.trim().toLowerCase().split(',')[0]?.split('-')[0];
  return primary && isSupportedLocale(primary) ? primary : DEFAULT_LOCALE;
}

export function readClientLocaleCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const prefix = `${LOCALE_COOKIE_NAME}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return DEFAULT_LOCALE;
  return parseLocale(decodeURIComponent(entry.slice(prefix.length)));
}

export function writeClientLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  document.documentElement.lang = locale;
}

// Browser-only active locale cache so universal utilities (e.g. apiClient) can read
// the current locale synchronously without importing a 'use client' module or leaking
// state across concurrent SSR requests.
let activeClientLocale: Locale | null = null;

export function setActiveClientLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  activeClientLocale = locale;
}

export function getActiveClientLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return activeClientLocale ?? readClientLocaleCookie();
}
