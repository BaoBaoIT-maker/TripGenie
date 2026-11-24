import { formatDistanceToNow } from 'date-fns';
import { enUS, vi as viDateLocale } from 'date-fns/locale';
import { ERROR_CODES, type ErrorCode } from '@/types/error-codes';
import { DEFAULT_LOCALE, LOCALE_METADATA, type Locale } from './config';
import viMessages from './messages/vi.json';
import enMessages from './messages/en.json';

type DeepStringSchema<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringSchema<T[K]>;
};

export type Messages = DeepStringSchema<typeof viMessages>;

type NestedKeyOf<T> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? K
    : `${K}.${NestedKeyOf<T[K]>}`;
}[Extract<keyof T, string>];

export type TranslationKey = NestedKeyOf<Messages>;
export type MessageKey = TranslationKey;
export type AppLocale = Locale;
export type { Locale };
export type TranslationParams = Record<string, string | number>;

// Compile-time guard: en.json must match 100% of vi.json's key structure.
export const MESSAGES: Record<Locale, Messages> = {
  vi: viMessages,
  en: enMessages,
};

const DATE_FNS_LOCALES = {
  vi: viDateLocale,
  en: enUS,
} as const;

/**
 * Generic HTTP fallback codes attached automatically by Backend AllExceptionsFilter
 * when a service throws an exception without a domain-specific ERROR_CODE.
 * We avoid overwriting specific server messages with these generic labels in Vietnamese.
 */
const GENERIC_HTTP_CODES = new Set<string>([
  ERROR_CODES.BAD_REQUEST,
  ERROR_CODES.NOT_FOUND,
  ERROR_CODES.CONFLICT,
  ERROR_CODES.FORBIDDEN,
  ERROR_CODES.VALIDATION_FAILED,
  ERROR_CODES.UNAUTHORIZED,
]);

const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ERROR_CODES.BAD_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
  500: ERROR_CODES.INTERNAL_SERVER_ERROR,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
};

// Detects Vietnamese-specific diacritic characters so unmapped backend Vietnamese strings
// never leak into the English UI.
const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

export function hasVietnameseDiacritics(text: string): boolean {
  return VIETNAMESE_DIACRITIC_REGEX.test(text);
}

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const segments = key.split('.');
  let current: unknown = getMessages(locale);

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

export interface BilingualEntity {
  name?: string | null;
  nameVi?: string | null;
}

/**
 * Picks the appropriate display name from DB reference entities (Category, TravelArea)
 * that already carry both `name` (English) and `nameVi` (Vietnamese).
 * Keep calls at the Presentation layer so cached TanStack Query items update at 0ms on locale switch.
 */
export function pickLocalizedName(
  entity: BilingualEntity | null | undefined,
  locale: Locale,
  fallback = '',
): string {
  if (!entity) return fallback;
  if (locale === 'en') {
    return entity.name?.trim() || entity.nameVi?.trim() || fallback;
  }
  return entity.nameVi?.trim() || entity.name?.trim() || fallback;
}

export function getPlaceCategoryLabel(
  place: {
    categoryName?: string;
    categoryNameVi?: string | null;
    categoryLabel?: string;
  },
  locale: Locale,
): string {
  const fallback = place.categoryLabel || getMessages(locale).place.categoryFallback;
  return pickLocalizedName(
    { name: place.categoryName, nameVi: place.categoryNameVi },
    locale,
    fallback,
  );
}

export function getPlaceCityLabel(
  place: {
    areaName?: string;
    areaNameVi?: string | null;
    city?: string | null;
  },
  locale: Locale,
): string {
  return pickLocalizedName(
    { name: place.areaName, nameVi: place.areaNameVi },
    locale,
    place.city || '',
  );
}

export function getPlacePriceRangeText(
  priceLevel: 1 | 2 | 3 | 4 | undefined,
  locale: Locale,
  fallback?: string,
): string | undefined {
  const p = getMessages(locale).place;
  switch (priceLevel) {
    case 1:
      return p.priceLow;
    case 2:
      return p.priceMedium;
    case 3:
      return p.priceHigh;
    case 4:
      return p.priceLuxury;
    default:
      return fallback;
  }
}

export function getPlaceOpenStatusText(
  isOpenNow: boolean | null | undefined,
  locale: Locale,
): string | undefined {
  if (isOpenNow === null || isOpenNow === undefined) return undefined;
  const p = getMessages(locale).place;
  return isOpenNow ? p.openNow : p.closed;
}

/**
 * Resolves a place's description at render time (SRP):
 * 1. In `en` mode, prefers `attributes.descriptionEn` when enriched in DB.
 * 2. Falls back to raw DB `description` when non-empty.
 * 3. When DB `description` is absent, formats a clean localized summary from structured fields.
 */
export function getPlaceDescription(
  place: {
    name: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    categoryName?: string;
    categoryNameVi?: string | null;
    categoryLabel?: string;
    areaName?: string;
    areaNameVi?: string | null;
    attributes?: { descriptionEn?: string } | null;
  },
  locale: Locale,
): string {
  const enDesc =
    typeof place.attributes?.descriptionEn === 'string'
      ? place.attributes.descriptionEn.trim()
      : '';
  if (locale === 'en' && enDesc) {
    return enDesc;
  }

  const rawDesc = place.description?.trim() || '';
  if (rawDesc) {
    return rawDesc;
  }

  const category = getPlaceCategoryLabel(place, locale);
  const address = place.address?.trim() || getPlaceCityLabel(place, locale) || 'Vietnam';
  return translate(locale, 'place.descriptionFallback', {
    name: place.name,
    category,
    address,
  });
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_METADATA[locale].intlTag, options).format(date);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE_METADATA[locale].intlTag, options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency = 'VND',
): string {
  return new Intl.NumberFormat(LOCALE_METADATA[locale].intlTag, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value);
}

export function formatRelativeTime(
  value: Date | string | number,
  locale: Locale,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: DATE_FNS_LOCALES[locale],
  });
}

export interface ApiErrorTranslationInput {
  code?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Resolves a user-facing error message for the active locale:
 * 1. Domain-specific ERROR_CODES always map to the localized dictionary entry.
 * 2. Generic HTTP fallback codes preserve specific Vietnamese backend messages in `vi` mode,
 *    while shielding `en` users from leaked Vietnamese backend text.
 */
export function translateApiError(
  input: ApiErrorTranslationInput,
  locale: Locale,
): string {
  const errorDict = getMessages(locale).errors as Record<string, string>;
  const rawMessage = input.message?.trim();
  const code = input.code;

  if (code && !GENERIC_HTTP_CODES.has(code) && code in errorDict) {
    return errorDict[code];
  }

  if (locale === 'vi' && rawMessage) {
    return rawMessage;
  }

  if (locale === 'en' && rawMessage && !hasVietnameseDiacritics(rawMessage)) {
    return rawMessage;
  }

  if (code && code in errorDict) {
    return errorDict[code];
  }

  const statusCodeKey =
    input.statusCode !== undefined ? HTTP_STATUS_TO_ERROR_CODE[input.statusCode] : undefined;
  if (statusCodeKey && statusCodeKey in errorDict) {
    return errorDict[statusCodeKey];
  }

  return errorDict.GENERIC_FALLBACK;
}
