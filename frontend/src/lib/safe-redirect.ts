/**
 * Validates and normalizes internal redirect destinations.
 * Prevents Open Redirect and XSS attacks via javascript:, data:, or scheme-relative URLs.
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = '/explore',
): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Reject empty string
  if (!trimmed) {
    return fallback;
  }

  // Reject control characters (0-31, 127) in raw string
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return fallback;
  }

  // Decode URI components and check for encoded control characters (e.g. %09, %0a, %0d)
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return fallback;
  }

  if (/[\x00-\x1F\x7F]/.test(decoded)) {
    return fallback;
  }

  // Must begin with single forward slash and not double-slash (//) or backslash (\)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }

  // Prevent slash followed by whitespace, control, slash or backslash in either raw or decoded form
  if (/^\/[\s\\/]/.test(trimmed) || /^\/[\s\\/]/.test(decoded.trim())) {
    return fallback;
  }

  // Reject URI schemes (e.g. javascript:, data:, vbscript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return fallback;
  }

  // Validate with WHATWG URL parser against dummy localhost base
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost' || parsed.hostname !== 'localhost' || parsed.protocol !== 'http:') {
      return fallback;
    }
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  // Check path without query/hash for auth loops
  const pathOnly = trimmed.split('?')[0].split('#')[0];
  const decodedPathOnly = decoded.trim().split('?')[0].split('#')[0];
  const authRoutes = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'];
  if (authRoutes.includes(pathOnly) || authRoutes.includes(decodedPathOnly)) {
    return fallback;
  }

  return trimmed;
}
