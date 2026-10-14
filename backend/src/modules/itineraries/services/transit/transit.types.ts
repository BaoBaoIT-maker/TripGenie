import { PRICING_CONFIG, SafetyAdvisory } from '../../../../config/pricing.config';
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
  budgetLevel?: string;
  originCoords: { lat: number; lng: number; areaId?: number };
  destCoords: { lat: number; lng: number; areaId?: number };
  roadDistanceKm: number;
  isIsland: boolean;
  nearestFerryHub?: TransitHubDto | null;
  activeHubs?: TransitHubDto[];
}

export interface ITransitStrategy {
  readonly mode: TransitModeEnum;
  calculate(context: TransitStrategyContext): Promise<IntercityTransitResult>;
  summarize?(result: IntercityTransitResult, roadDistanceKm: number): TransitModeSummary | null;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle Haversine distance between two coordinates in kilometers.
 */
export function computeHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Finds the nearest active transit hub of a given type from a pre-fetched list.
 */
export function findNearestHub(
  hubs: TransitHubDto[],
  hubType: string,
  lat: number,
  lng: number,
): TransitHubDto | null {
  let nearest: TransitHubDto | null = null;
  let minDist = Infinity;
  for (const hub of hubs) {
    if (hub.hubType !== hubType) continue;
    const dist = computeHaversineDistance(lat, lng, hub.latitude, hub.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = { ...hub, distanceKm: Math.round(dist) };
    }
  }
  return nearest;
}

/**
 * Two-tier hub classification (Administrative Area Match + Satellite Radius Fallback).
 * Supports both domestic hubs and international metropolitan airports (e.g., Tokyo Narita ~60km, Seoul Incheon ~50km, Long Thanh ~42km).
 */
export function isDirectCityHub(
  hub: TransitHubDto | null | undefined,
  cityAreaId: number | undefined,
  maxSatelliteKm: number,
): boolean {
  if (!hub) return false;
  if (cityAreaId != null && hub.areaId === cityAreaId) return true;
  return (hub.distanceKm ?? Infinity) <= maxSatelliteKm;
}

/**
 * Computes local hub-to-downtown transfer distance and duration using PRICING_CONFIG benchmarks.
 */
export function computeLocalTransfer(
  rawDistanceKm?: number | null,
  fallbackKm: number = PRICING_CONFIG.INTERCITY.TRANSFER.DEFAULT_AIRPORT_TRANSFER_KM,
): { transferKm: number; transferMinutes: number } {
  const T = PRICING_CONFIG.INTERCITY.TRANSFER;
  const transferKm =
    rawDistanceKm != null && rawDistanceKm > 0
      ? Math.max(T.MIN_LOCAL_TRANSFER_KM, rawDistanceKm)
      : fallbackKm;
  const transferMinutes = Math.max(
    T.MIN_LOCAL_TRANSFER_MINUTES,
    Math.round(transferKm * T.LOCAL_TRANSFER_MINS_PER_KM),
  );
  return { transferKm, transferMinutes };
}

/**
 * Formats minutes into Vietnamese readable duration (e.g. "1h20p" or "25 phút").
 */
export function formatDurationVi(minutes: number, compact = false): string {
  const m = Math.max(1, Math.round(minutes));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h${rem}p` : compact ? `${h}h` : `${h} tiếng`;
  }
  return compact ? `${m}p` : `${m} phút`;
}

/**
 * Formats a number into Vietnamese Dong string (e.g. "1.400.000đ").
 */
export function formatVndCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}


