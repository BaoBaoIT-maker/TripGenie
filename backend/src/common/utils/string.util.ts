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
