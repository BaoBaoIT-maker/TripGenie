import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PRICING_CONFIG } from '../../../config/pricing.config';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { normalizeVietnamese } from '../../../common/utils/string.util';
import { BudgetLevelEnum, TransitModeEnum } from '../dto/generate-itinerary.dto';
import {
  IntercityTransitResult,
  TransitHubDto,
  TransitModeSummary,
  TransitStrategyContext,
  ITransitStrategy,
  computeHaversineDistance as calcHaversine,
  findNearestHub,
} from './transit/transit.types';
import { FlightTransitStrategy } from './transit/strategies/flight.strategy';
import { TrainTransitStrategy } from './transit/strategies/train.strategy';
import { BusTransitStrategy } from './transit/strategies/bus.strategy';
import { RoadTransitStrategy } from './transit/strategies/road.strategy';

// Re-export types for backward compatibility across modules
export * from './transit/transit.types';

@Injectable()
export class TransitService {
  private readonly strategies: Map<TransitModeEnum, ITransitStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(INJECT_TOKENS.TRANSIT_STRATEGIES)
    injectedStrategies?: ITransitStrategy[],
  ) {
    const strategyList =
      injectedStrategies && injectedStrategies.length > 0
        ? injectedStrategies
        : [
            new FlightTransitStrategy(this.prisma),
            new BusTransitStrategy(this.prisma),
            new TrainTransitStrategy(this.prisma),
            new RoadTransitStrategy(TransitModeEnum.PERSONAL_MOTORBIKE),
            new RoadTransitStrategy(TransitModeEnum.PERSONAL_CAR),
          ];

    this.strategies = new Map<TransitModeEnum, ITransitStrategy>(
      strategyList.map((s) => [s.mode, s]),
    );
  }

  /**
   * Great-circle distance between two coordinates in kilometers (Haversine formula).
   */
  computeHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    return calcHaversine(lat1, lon1, lat2, lon2);
  }

  /**
   * Road distance approximation using Vietnam detour multiplier (~1.35x crow-fly distance).
   */
  computeRoadDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const crowFly = this.computeHaversineDistance(lat1, lon1, lat2, lon2);
    return Math.round(crowFly * PRICING_CONFIG.INTERCITY.ROAD_DETOUR_FACTOR);
  }

  /**
   * Dynamically resolve coordinates for any city/destination from PostgreSQL database.
   * Priority:
   * 1. Query travel_areas bbox center (represents true city/province center so hub-to-center distance is accurate)
   * 2. Query transit_hubs via travel_areas when bbox is null
   * 3. Query transit_hubs directly
   */
  async resolveCityLocation(cityName: string): Promise<{ lat: number; lng: number; areaId?: number }> {
    const fallback = PRICING_CONFIG.DEFAULTS.FALLBACK_COORDS;
    if (!cityName) return fallback;
    const raw = cityName.trim();
    const terms = raw
      .split('/')
      .map((t) => t.replace(/^(TP\.|Thành phố|Tỉnh|Huyện|Quận)\s*/i, '').trim())
      .filter(Boolean);

    for (const term of terms) {
      try {
        const areas = await this.prisma.$queryRaw<
          Array<{ lat: number; lng: number; area_id: number }>
        >`
          SELECT (bbox_min_lat + bbox_max_lat) / 2 AS lat, (bbox_min_lng + bbox_max_lng) / 2 AS lng, id AS area_id
          FROM travel_areas
          WHERE type != 'COUNTRY'
            AND (
              unaccent(name) ILIKE '%' || unaccent(${term}) || '%'
              OR (name_vi IS NOT NULL AND unaccent(name_vi) ILIKE '%' || unaccent(${term}) || '%')
              OR unaccent(slug) ILIKE '%' || unaccent(${term}) || '%'
            )
            AND bbox_min_lat IS NOT NULL AND bbox_max_lat IS NOT NULL
          ORDER BY CASE WHEN type = 'CITY' THEN 1 WHEN type = 'PROVINCE' THEN 2 ELSE 3 END
          LIMIT 1
        `;
        if (areas && areas.length > 0 && areas[0].lat && areas[0].lng) {
          return { lat: Number(areas[0].lat), lng: Number(areas[0].lng), areaId: areas[0].area_id };
        }
      } catch {}

      try {
        const areaHub = await this.prisma.$queryRaw<
          Array<{ lat: number; lng: number; area_id: number }>
        >`
          SELECT h.latitude AS lat, h.longitude AS lng, a.id AS area_id
          FROM travel_areas a
          JOIN transit_hubs h ON h.area_id = a.id AND h.is_active = true
          WHERE (
            unaccent(a.name) ILIKE '%' || unaccent(${term}) || '%'
            OR (a.name_vi IS NOT NULL AND unaccent(a.name_vi) ILIKE '%' || unaccent(${term}) || '%')
            OR unaccent(a.slug) ILIKE '%' || unaccent(${term}) || '%'
          )
          ORDER BY CASE WHEN h.hub_type = 'AIRPORT' THEN 1 WHEN h.hub_type = 'BUS_TERMINAL' THEN 2 ELSE 3 END
          LIMIT 1
        `;
        if (areaHub && areaHub.length > 0 && areaHub[0].lat && areaHub[0].lng) {
          return { lat: Number(areaHub[0].lat), lng: Number(areaHub[0].lng), areaId: areaHub[0].area_id };
        }
      } catch {}

      try {
        const hubs = await this.prisma.$queryRaw<
          Array<{ latitude: number; longitude: number; area_id: number }>
        >`
          SELECT latitude, longitude, area_id
          FROM transit_hubs
          WHERE unaccent(name) ILIKE '%' || unaccent(${term}) || '%' AND is_active = true
          ORDER BY CASE WHEN hub_type = 'AIRPORT' THEN 1 ELSE 2 END
          LIMIT 1
        `;
        if (hubs && hubs.length > 0 && hubs[0].latitude) {
          return { lat: Number(hubs[0].latitude), lng: Number(hubs[0].longitude), areaId: hubs[0].area_id };
        }
      } catch {}
    }

    return fallback;
  }

  /**
   * Determine if destination is an island or isolated by water requiring sea transit.
   */
  async isIslandDestination(
    destCity: string,
    destLat: number,
    destLng: number,
    activeHubs?: TransitHubDto[],
  ): Promise<boolean> {
    const norm = normalizeVietnamese(destCity || '').replace(/đ/g, 'd');

    if (PRICING_CONFIG.ISLAND_KEYWORDS.some((kw) => norm.includes(kw))) {
      return true;
    }

    try {
      const ferryHubs = activeHubs
        ? activeHubs.filter((h) => h.hubType === 'FERRY_TERMINAL')
        : await this.prisma.transitHub.findMany({
            where: { isActive: true, hubType: 'FERRY_TERMINAL' },
          });
      for (const hub of ferryHubs) {
        const dist = this.computeHaversineDistance(destLat, destLng, hub.latitude, hub.longitude);
        if (dist <= PRICING_CONFIG.INTERCITY.TRANSFER.ISLAND_PORT_DISTANCE_KM) {
          return true;
        }
      }
    } catch {}

    return false;
  }

  /**
   * Calculate full intercity transit with strategy delegation.
   */
  async calculateIntercityTransit(params: {
    originCity: string;
    originLat?: number;
    originLng?: number;
    destCity: string;
    destLat?: number;
    destLng?: number;
    transitMode?: TransitModeEnum;
    budgetLevel?: BudgetLevelEnum | string;
    departDate: string;
    returnDate?: string;
  }): Promise<IntercityTransitResult> {
    const { originCity, destCity, departDate, returnDate, budgetLevel } = params;

    const [resolvedOrigin, resolvedDest, activeHubs] = await Promise.all([
      this.resolveCityLocation(originCity),
      this.resolveCityLocation(destCity),
      this.prisma.transitHub.findMany({ where: { isActive: true } }),
    ]);

    const originCoords =
      params.originLat && params.originLng
        ? { lat: params.originLat, lng: params.originLng, areaId: resolvedOrigin.areaId }
        : resolvedOrigin;

    const destCoords =
      params.destLat && params.destLng
        ? { lat: params.destLat, lng: params.destLng, areaId: resolvedDest.areaId }
        : resolvedDest;

    const roadDistanceKm = this.computeRoadDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng,
    );

    const isIsland = await this.isIslandDestination(destCity, destCoords.lat, destCoords.lng, activeHubs);
    const nearestFerryHub = findNearestHub(activeHubs, 'FERRY_TERMINAL', destCoords.lat, destCoords.lng);

    const context: TransitStrategyContext = {
      originCity,
      destCity,
      departDate,
      returnDate,
      budgetLevel,
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
      nearestFerryHub,
      activeHubs,
    };

    const requestedMode =
      params.transitMode ||
      (roadDistanceKm > PRICING_CONFIG.INTERCITY.AUTO_FLIGHT_MIN_KM
        ? TransitModeEnum.FLIGHT
        : TransitModeEnum.SLEEPER_BUS);

    const strategy = this.strategies.get(requestedMode) || this.strategies.get(TransitModeEnum.SLEEPER_BUS)!;
    const result = await strategy.calculate(context);

    // Open-Closed summary generation: each strategy produces its own TransitModeSummary
    const allModesSummary: TransitModeSummary[] = [];
    for (const [, itemStrategy] of this.strategies) {
      if (!itemStrategy.summarize) continue;
      try {
        const itemRes =
          itemStrategy.mode === requestedMode
            ? result
            : await itemStrategy.calculate(context);
        const summary = itemStrategy.summarize(itemRes, roadDistanceKm);
        if (summary) {
          allModesSummary.push(summary);
        }
      } catch {}
    }

    result.allModesSummary = allModesSummary;
    return result;
  }
}

