import { Prisma } from '@prisma/client';

export enum CommunitySortMode {
  LATEST = 'LATEST',
  TRENDING = 'TRENDING',
  MOST_CLONED = 'MOST_CLONED',
}

export const COMMUNITY_CONSTANTS = {
  UPLOAD_ROOT_DIR: 'uploads',
  UPLOAD_SUBDIR: 'community',
  PUBLIC_URL_PREFIX: '/api/v1/uploads/community',
  STATIC_UPLOAD_CACHE_MAX_AGE: '7d',
  MAX_FILES_PER_UPLOAD: 6,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  DEFAULT_FEED_LIMIT: 12,
  MAX_FEED_LIMIT: 30,
  DEFAULT_COMMENTS_LIMIT: 30,
  MAX_TITLE_LENGTH: 255,
  MAX_CAPTION_LENGTH: 5000,
  MAX_COMMENT_LENGTH: 1500,
  MAX_TAGS_COUNT: 10,
  MAX_TAG_LENGTH: 60,
  MAX_SEARCH_LENGTH: 120,
  MAX_REPLY_TO_NAME_LENGTH: 150,
  MAX_REPORT_DESCRIPTION_LENGTH: 1000,
  MAX_GROUP_NAME_LENGTH: 120,
  MAX_GROUP_SLUG_LENGTH: 120,
  MAX_GROUP_SUBTITLE_LENGTH: 255,
  MAX_GROUP_DESCRIPTION_LENGTH: 1000,
  MATCHED_CREATORS_LIMIT: 6,
  TOP_CLONED_SIDEBAR_LIMIT: 3,
  CHECKIN_HIGHLIGHTS_LIMIT: 8,
  TOP_CREATORS_SIDEBAR_LIMIT: 4,
  SIDEBAR_CACHE_TTL_MS: 60_000,
  CREATOR_AUTO_VERIFY_MIN_POSTS: 3,
  CREATOR_AUTO_VERIFY_MIN_CLONES: 10,
  CREATOR_AUTO_VERIFY_MIN_LIKES: 30,
  TAG_QUERY_LIMIT: 30,
  VIEWER_LIKE_LOOKUP_LIMIT: 1,
} as const;

/** Media URLs must be either an own-upload path or an absolute http(s) URL (blocks javascript:/data: schemes). */
export const SAFE_MEDIA_URL_REGEX = /^(\/api\/v1\/uploads\/|https?:\/\/)/i;

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Strict MIME-type to safe extension whitelist for trust boundary validation.
 */
export const ALLOWED_MEDIA_MIME_TO_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

/**
 * Open/Closed Strategy Map for feed ordering.
 */
export const FEED_SORT_STRATEGIES: Readonly<
  Record<CommunitySortMode, Prisma.CommunityPostOrderByWithRelationInput[]>
> = {
  [CommunitySortMode.LATEST]: [{ createdAt: 'desc' }, { id: 'desc' }],
  [CommunitySortMode.TRENDING]: [
    { likeCount: 'desc' },
    { commentCount: 'desc' },
    { cloneCount: 'desc' },
    { createdAt: 'desc' },
  ],
  [CommunitySortMode.MOST_CLONED]: [
    { cloneCount: 'desc' },
    { likeCount: 'desc' },
    { createdAt: 'desc' },
  ],
};
