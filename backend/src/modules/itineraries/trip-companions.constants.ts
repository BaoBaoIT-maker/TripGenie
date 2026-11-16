export const PROPOSAL_RESOLVE_ACTIONS = ['APPROVE', 'REJECT'] as const;
export type ProposalResolveAction = (typeof PROPOSAL_RESOLVE_ACTIONS)[number];

export const PROPOSAL_LIMITS = {
  MAX_NOTES_LENGTH: 400,
  DEFAULT_DAY_NUMBER: 1,
  MIN_DAY_NUMBER: 1,
  LIST_MAX_ROWS: 100,
} as const;

export const TRIP_COMPANIONS_CONSTANTS = {
  DEFAULT_GROUP_NAME: 'Nhóm đồng hành',
  INVITATION_TTL_DAYS: 7,
  INVITE_CODE_BYTES: 6,
  MAX_INVITE_CODE_RETRIES: 5,
  EVENT_KEY_INVITE_PREFIX: 'trip-invite',
  EVENT_KEY_RESULT_PREFIX: 'trip-invite-result',
} as const;
