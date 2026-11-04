export const USERS_CONSTANTS = {
  MAX_AVATAR_URL_LENGTH: 500,
  /**
   * Only allows safe relative static avatars (/avatars/...), local uploads (/api/v1/uploads/...),
   * or valid HTTP/HTTPS URLs. Blocks large base64 data URLs (which bloat DB and API payloads)
   * and dangerous pseudo-schemes (javascript:, vbscript:).
   */
  SAFE_AVATAR_URL_REGEX: /^(\/avatars\/|\/api\/v1\/uploads\/|https?:\/\/)/i,
} as const;
