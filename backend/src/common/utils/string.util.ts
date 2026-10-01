/**
 * Vietnamese string normalization utility.
 * Extracted from OsmProvider for reuse across the codebase.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const unorm = require('unorm') as typeof import('unorm');

/**
 * Strips Vietnamese diacritics and lowercases a string.
 * Used for fuzzy deduplication matching.
 *
 * @example
 * normalizeVietnamese('Nhà Hàng Bờ Biển') => 'nha hang bo bien'
 */
export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return unorm
    .nfd(str)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type SearchIntent = 'coordinates' | 'address' | 'keyword';

/**
 * Classifies a search query into coordinates, address, or keyword intent.
 * Coordinates → reverse-geocode then nearby search.
 * Address     → forward-geocode then nearby search.
 * Keyword     → DB keyword search with NLP fallback.
 *
 * ponytail: regex heuristics — good enough for VN input patterns.
 * Upgrade path: replace with an ML classifier if false-positive rate grows.
 */
export function detectSearchIntent(query: string): SearchIntent {
  const q = query.trim();

  // Two decimal numbers separated by comma or whitespace, within Vietnam bounds
  const m = q.match(/^(-?\d{1,2}\.?\d*)[,\s]+(-?\d{2,3}\.?\d*)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) return 'coordinates';
  }

  // Vietnamese address signals: leading number+word, admin keywords, or 2+ commas
  if (
    /^\d+\s+\w/.test(q) ||
    /\b(phường|quận|huyện|xã|đường|phố|hẻm|ngõ|thành phố|tỉnh)\b/i.test(q) ||
    (q.match(/,/g) || []).length >= 2
  ) {
    return 'address';
  }

  return 'keyword';
}
