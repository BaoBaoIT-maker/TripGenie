import { AppLocale, DEFAULT_LOCALE } from './locale.util';
import viMessages from './messages/vi.json';
import enMessages from './messages/en.json';

type DeepStringSchema<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringSchema<T[K]>;
};

export type BackendMessages = DeepStringSchema<typeof viMessages>;

type NestedKeyOf<T> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? K
    : `${K}.${NestedKeyOf<T[K]>}`;
}[Extract<keyof T, string>];

export type BackendMessageKey = NestedKeyOf<BackendMessages>;
export type MessageParams = Record<string, string | number>;

// Compile-time guard: en.json must match 100% of vi.json's key structure.
export const BACKEND_MESSAGES: Record<AppLocale, BackendMessages> = {
  vi: viMessages,
  en: enMessages,
};

/**
 * Type-safe translation helper for backend user-facing copy (emails, AI fallbacks, proposals, weather).
 * Mirrors frontend `translate()` so both apps share one mental model and zero hardcoded copy.
 */
export function t(
  locale: AppLocale | undefined,
  key: BackendMessageKey,
  params?: MessageParams,
): string {
  const resolvedLocale = locale && locale in BACKEND_MESSAGES ? locale : DEFAULT_LOCALE;
  const segments = key.split('.');
  let current: unknown = BACKEND_MESSAGES[resolvedLocale];

  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return key;
    }
  }

  if (typeof current !== 'string') return key;
  if (!params) return current;

  return current.replace(/\{(\w+)\}/g, (match, paramKey: string) =>
    paramKey in params ? String(params[paramKey]) : match,
  );
}
