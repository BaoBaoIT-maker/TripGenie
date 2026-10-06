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
  categoryName: string | null;
  distanceToNextKm: number | null;
  durationToNextMinutes?: number | null;
  travelModeToNext?: 'WALK' | 'BIKE' | 'CAR' | null;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  priceLevel?: BudgetLevel | string | null;
  priceRange?: any;
  estimatedCost?: number | null;
  openingHours?: any;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  activities: ItineraryActivity[];
}

export interface ItineraryDetail {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  coverPhoto?: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  totalDays: number;
  budgetLevel: string;
  intercityTransit: IntercityTransit | null;
  budgetBreakdown: BudgetBreakdown | null;
  days: ItineraryDay[];
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

