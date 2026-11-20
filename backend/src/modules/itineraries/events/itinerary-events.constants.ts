export enum ItineraryLiveEventType {
  PROPOSAL_VOTED = 'PROPOSAL_VOTED',
  PROPOSAL_CREATED = 'PROPOSAL_CREATED',
  PROPOSAL_RESOLVED = 'PROPOSAL_RESOLVED',
  PROPOSAL_WITHDRAWN = 'PROPOSAL_WITHDRAWN',
  STOPS_REORDERED = 'STOPS_REORDERED',
}

export interface ItineraryEventActor {
  userId: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface ItineraryLiveEvent<T = unknown> {
  type: ItineraryLiveEventType;
  itineraryId: string;
  actor: ItineraryEventActor;
  payload: T;
  timestamp: string;
}

export const ITINERARY_EVENTS_CONFIG = {
  REDIS_CHANNEL_PREFIX: 'itinerary:live-events',
  HEARTBEAT_INTERVAL_MS: 30_000,
} as const;
