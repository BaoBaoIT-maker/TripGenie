export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'vi';
export type TranslationsMap = Record<string, string>;

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

/** Extracts a clean string-only translations map from a Prisma JSONB field. */
export function parseTranslationsMap(raw: unknown): TranslationsMap | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const result: TranslationsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) {
      result[k] = v.trim();
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Resolves a localized label from a JSONB translations map with graceful fallback:
 * translations[locale] -> (for non-vi locales: translations.en) -> fallback.
 */
export function resolveLocalizedText(
  fallback: string,
  translations: unknown,
  locale: AppLocale = DEFAULT_LOCALE,
): string {
  const map = parseTranslationsMap(translations);
  if (map) {
    const exact = map[locale];
    if (exact) return exact;
    if (locale !== 'vi' && map.en) return map.en;
  }
  return fallback;
}
