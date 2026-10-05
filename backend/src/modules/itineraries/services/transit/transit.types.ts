import { SafetyAdvisory } from '../../../../config/pricing.config';
import { TransitModeEnum } from '../../dto/generate-itinerary.dto';

export interface TransitHubDto {
  id: string;
  name: string;
  hubType: string;
  latitude: number;
  longitude: number;
  areaId: number;
  distanceKm?: number;
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
  mode: TransitModeEnum;
  title: string;
  durationText: string;
  priceText: string;
  estimatedPriceOneWay: number;
  durationMinutes: number;
  isMultiModal: boolean;
  warning?: string;
}

export interface IntercityTransitResult {
  mode: string;
  originName: string;
  destName: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedPriceOneWay: number;
  estimatedPriceRoundTrip: number;
  deepLinks: {
    googleFlights?: string;
    traveloka?: string;
    vexere?: string;
    vexereTrain?: string;
    dsvn?: string;
    googleMaps?: string;
  };
  safetyAdvisory: SafetyAdvisory | null;
  originHub?: TransitHubDto;
  destHub?: TransitHubDto;
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

export interface TransitStrategyContext {
  originCity: string;
  destCity: string;
  departDate: string;
  returnDate?: string;
  originCoords: { lat: number; lng: number; areaId?: number };
  destCoords: { lat: number; lng: number; areaId?: number };
  roadDistanceKm: number;
  isIsland: boolean;
  nearestFerryHub?: TransitHubDto | null;
}

export interface ITransitStrategy {
  readonly mode: TransitModeEnum;
  calculate(context: TransitStrategyContext): Promise<IntercityTransitResult>;
}
