export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'vi';

/**
 * Parses an HTTP `Accept-Language` header (or raw locale code) into a supported AppLocale.
 * Honors primary language tags (e.g. `en`, `en-US,en;q=0.9`, `vi-VN`) and safely falls back to `vi`.
 */
export function parseLocale(
  raw: string | string[] | null | undefined,
): AppLocale {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return DEFAULT_LOCALE;

  const primary = value.split(',')[0]?.trim().toLowerCase() ?? '';
  if (primary === 'en' || primary.startsWith('en-')) return 'en';
  if (primary === 'vi' || primary.startsWith('vi-')) return 'vi';

  return DEFAULT_LOCALE;
}
