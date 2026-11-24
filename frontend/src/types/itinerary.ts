// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring backend contract (itinerary-planner.service.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type TransitMode =
  | 'FLIGHT'
  | 'SLEEPER_BUS'
  | 'TRAIN'
  | 'PERSONAL_CAR'
  | 'PERSONAL_MOTORBIKE';

export type IntracityMode = 'MOTORBIKE_RENTAL' | 'GRAB_BIKE' | 'TAXI_CAR';
export type BudgetLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'LUXURY';
export type TravelPace = 'RELAXED' | 'BALANCED' | 'PACKED';

export interface GenerateItineraryRequest {
  originCity: string;
  destinationCity: string;
  destinationAreaId?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  budgetLevel?: BudgetLevel;
  transitMode?: TransitMode;
  intracityMode?: IntracityMode;
  pace?: TravelPace;
  partySize?: number;
  travelStyles?: string[];
  customPrompt?: string;
}

export interface TransitPreviewRequest {
  originCity: string;
  originLat?: number;
  originLng?: number;
  destCity: string;
  destLat?: number;
  destLng?: number;
  transitMode?: TransitMode;
  departDate: string;
  returnDate?: string;
}

export interface SafetyAdvisory {
  level: 'INFO' | 'WARNING' | 'DANGER';
  title: string;
  message: string;
}

export interface TransitTransferLeg {
  type: 'BUS' | 'FERRY' | 'TAXI';
  title: string;
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedPrice: number;
  description: string;
}

export interface TransitModeSummary {
  mode: TransitMode;
  title: string;
  durationText: string;
  priceText: string;
  estimatedPriceOneWay: number;
  durationMinutes: number;
  isMultiModal: boolean;
  warning?: string;
}

export interface IntercityTransit {
  mode: TransitMode;
  originName: string;
  destName: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedPriceOneWay: number;
  estimatedPriceRoundTrip: number;
  safetyAdvisory: SafetyAdvisory | null;
  originHub?: { id: string; name: string; hubType: string; distanceKm: number };
  destHub?: { id: string; name: string; hubType: string; distanceKm: number };
  deepLinks: {
    googleFlights?: string;
    traveloka?: string;
    vexere?: string;
    vexereTrain?: string;
    dsvn?: string;
    googleMaps?: string;
  };
  isIsland?: boolean;
  isMultiModal?: boolean;
  transferLeg?: TransitTransferLeg;
  details: {
    carriers?: string;
    fuelCost?: number;
    fuelLiters?: number;
    gasPricePerLiter?: number;
    highwayToll?: number;
    notes?: string;
    routeSteps?: string[];
  };
  allModesSummary?: TransitModeSummary[];
}

export interface BudgetBreakdown {
  transitRoundTrip: number;
  accommodation: number;
  food: number;
  tickets: number;
  localTransit: number;
  totalEstimated: number;
  perPersonEstimated?: number;
  partySize?: number;
}

export type OpeningState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface PlacePriceRange {
  min?: number | null;
  max?: number | null;
}

export interface OpeningStatus {
  state: OpeningState;
  label: string | null;
  todayHours: string | null;
}

export interface ItineraryActivity {
  id?: string;
  placeId: string;
  placeName: string;
  startTime: string | null; // "HH:mm"
  endTime: string | null;
  durationMinutes: number | null;
  visitOrder: number;
  notes: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  categoryName: string | null;
  distanceToNextKm: number | null;
  durationToNextMinutes?: number | null;
  travelModeToNext?: 'WALK' | 'BIKE' | 'CAR' | null;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  priceLevel?: BudgetLevel | string | null;
  priceRange?: PlacePriceRange | null;
  estimatedCost?: number | null;
  /** Structured weekday hours from the place record, or a human-readable summary string. */
  openingHours?: Record<string, unknown> | string | null;
  openingStatus?: OpeningStatus | null;
}

export interface ItineraryDayLodging {
  nightNumber: number;
  isCheckOutDay?: boolean;
  isAutoSuggested: boolean;
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  priceRange?: PlacePriceRange | null;
  pricePerNight: number | null;
  imageUrl: string | null;
  distanceToFirstStopKm: number | null;
}

export interface ItineraryLodgingSuggestionItem {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  priceRange?: PlacePriceRange | null;
  pricePerNight: number | null;
  imageUrl: string | null;
  distanceKm: number;
  score: number;
}

export interface ItineraryLodgingSuggestionsResponse {
  nightNumber: number;
  totalNights: number;
  currentPlaceId: string | null;
  nearest: ItineraryLodgingSuggestionItem[];
  bestValue: ItineraryLodgingSuggestionItem[];
  topRated: ItineraryLodgingSuggestionItem[];
}

export interface UpdateItineraryLodgingOptimisticMeta {
  name?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  ratingAvg?: number | null;
  pricePerNight?: number | null;
  imageUrl?: string | null;
}

export interface UpdateItineraryLodgingRequest {
  placeId: string;
  fromNight: number;
  toNight?: number;
  optimisticLodging?: UpdateItineraryLodgingOptimisticMeta;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  lodging?: ItineraryDayLodging | null;
  activities: ItineraryActivity[];
}

export interface TourBriefing {
  leaderName?: string | null;
  leaderPhone?: string | null;
  meetingPoint?: string | null;
  notes?: string | null;
}

export interface ItineraryMemberSummary {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export interface ItineraryDetail {
  id: string;
  creatorId?: string;
  isPublic?: boolean;
  isOwner?: boolean;
  viewerRole?: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  canEdit?: boolean;
  canManageMembers?: boolean;
  updatedAt?: string;
  title: string;
  description: string | null;
  destination: string | null;
  coverPhoto?: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  totalDays: number;
  partySize?: number;
  pace?: string | null;
  budgetLevel: string;
  areaBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  intercityTransit: IntercityTransit | null;
  budgetBreakdown: BudgetBreakdown | null;
  tourBriefing?: TourBriefing | null;
  days: ItineraryDay[];
  members?: ItineraryMemberSummary[];
  memberCount?: number;
}

export interface CopilotProposal {
  id: string;
  toolName: string;
  title: string;
  description: string;
  dayNumber?: number;
  fromPlaceId?: string;
  fromPlaceName?: string;
  fromPlaceCoordinates?: {
    latitude: number;
    longitude: number;
  };
  toPlaceId?: string;
  toPlaceName?: string;
  toPlaceRating?: number;
  toPlaceCategory?: string;
  toPlaceAddress?: string;
  toPlaceImageUrl?: string;
  toPlaceCoordinates?: {
    latitude: number;
    longitude: number;
  };
  status?: 'PENDING' | 'APPLIED' | 'REJECTED';
  swapDays?: {
    dayA: number;
    dayB: number;
  };
  args: Record<string, unknown>;
}

export interface CopilotChatResponse {
  sessionId: string;
  reply: string;
  modified: boolean;
  action?: {
    type: 'CREATE_NEW_TRIP';
    destination: string;
  };
  appliedTool?: {
    name: string;
    args: Record<string, unknown>;
    resultMessage: string;
  };
  proposal?: CopilotProposal;
  itinerary?: ItineraryDetail;
}

export interface AlternativePlaceItem {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  ratingAvg: number;
  reviewCount: number;
  priceLevel: string | null;
  imageUrl: string | null;
  categoryName: string;
  distanceKm?: number;
}

export interface CopilotHistoryMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  createdAt: string;
  proposal?: CopilotProposal;
  proposalStatus?: 'PENDING' | 'APPLIED' | 'REJECTED';
}

/** Mirrors backend WeatherCondition enum (weather.constants.ts). */
export type WeatherCondition = 'SUNNY' | 'MILD' | 'RAINY' | 'COLD';

export type WeatherSource = 'FORECAST' | 'SEASONAL_AVERAGE';

export interface DayWeather {
  dayNumber: number;
  date: string | null;
  source: WeatherSource;
  isForecast: boolean;
  condition: WeatherCondition;
  labelVi: string;
  labelEn?: string;
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  precipitationProbabilityMax: number | null;
  uvIndexMax: number | null;
  weatherCode: number | null;
  degradedFromForecast?: boolean;
}

export interface TripWeatherResponse {
  destination: string | null;
  coordinates: { lat: number; lng: number } | null;
  timezone: string;
  hasForecastDays: boolean;
  days: DayWeather[];
  guidance: string;
}

export interface AddDestinationRequest {
  placeId: string;
  dayNumber: number;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface UpdateDestinationRequest {
  dayNumber?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export type MoveDirection = 'UP' | 'DOWN';

export interface UpdateItineraryMetaRequest {
  title?: string;
  description?: string;
  partySize?: number;
  startDate?: string;
  endDate?: string;
  dayShiftMode?: 'merge' | 'trim';
}

export type GroupProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProposalResolveAction = 'APPROVE' | 'REJECT';

export interface GroupProposalParticipant {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface GroupProposalPlace {
  id: string;
  name: string;
  address: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  ratingAvg: number | null;
}

export interface GroupProposalItem {
  id: string;
  tripGroupId: string;
  placeId: string;
  destinationId: string | null;
  dayNumber: number;
  proposedStartTime: string | null;
  notes: string | null;
  status: GroupProposalStatus;
  proposedBy: string;
  proposer: GroupProposalParticipant;
  place: GroupProposalPlace;
  voteCount: number;
  hasVoted: boolean;
  voters: GroupProposalParticipant[];
  createdAt: string;
}

export interface CreateGroupProposalRequest {
  placeId: string;
  destinationId?: string;
  dayNumber?: number;
  proposedStartTime?: string;
  notes?: string;
}

export interface GroupProposalsListResponse {
  proposals: GroupProposalItem[];
}

export interface ToggleProposalVoteResponse {
  proposalId: string;
  voted: boolean;
  voteCount: number;
  proposal: GroupProposalItem;
}

export interface ResolveGroupProposalResponse {
  proposal: GroupProposalItem;
  itinerary?: ItineraryDetail;
}

export interface WithdrawGroupProposalResponse {
  deletedId: string;
}
