import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PRICING_CONFIG } from '../../../config/pricing.config';
import { TransitModeEnum } from '../dto/generate-itinerary.dto';
import {
  IntercityTransitResult,
  TransitHubDto,
  TransitModeSummary,
  TransitStrategyContext,
  ITransitStrategy,
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

  constructor(private readonly prisma: PrismaService) {
    const flightStrategy = new FlightTransitStrategy(this.prisma);
    const trainStrategy = new TrainTransitStrategy(this.prisma);
    const busStrategy = new BusTransitStrategy(this.prisma);
    const motorbikeStrategy = new RoadTransitStrategy(TransitModeEnum.PERSONAL_MOTORBIKE);
    const carStrategy = new RoadTransitStrategy(TransitModeEnum.PERSONAL_CAR);

    this.strategies = new Map<TransitModeEnum, ITransitStrategy>([
      [TransitModeEnum.FLIGHT, flightStrategy],
      [TransitModeEnum.TRAIN, trainStrategy],
      [TransitModeEnum.SLEEPER_BUS, busStrategy],
      [TransitModeEnum.PERSONAL_MOTORBIKE, motorbikeStrategy],
      [TransitModeEnum.PERSONAL_CAR, carStrategy],
    ]);
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
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
   * 1. Query transit_hubs via travel_areas
   * 2. Query travel_areas bbox center
   * 3. Query transit_hubs directly
   */
  async resolveCityLocation(cityName: string): Promise<{ lat: number; lng: number; areaId?: number }> {
    if (!cityName) return { lat: 10.765, lng: 106.695 };
    const raw = cityName.trim();
    const terms = raw
      .split('/')
      .map((t) => t.replace(/^(TP\.|Thành phố|Tỉnh|Huyện|Quận)\s*/i, '').trim())
      .filter(Boolean);

    for (const term of terms) {
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
        const areas = await this.prisma.$queryRaw<
          Array<{ lat: number; lng: number; area_id: number }>
        >`
          SELECT (bbox_min_lat + bbox_max_lat) / 2 AS lat, (bbox_min_lng + bbox_max_lng) / 2 AS lng, id AS area_id
          FROM travel_areas
          WHERE (
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

    return { lat: 10.765, lng: 106.695 };
  }

  /**
   * Determine if destination is an island or isolated by water requiring sea transit.
   */
  async isIslandDestination(destCity: string, destLat: number, destLng: number): Promise<boolean> {
    const norm = (destCity || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();

    if (
      norm.includes('phu quoc') ||
      norm.includes('con dao') ||
      norm.includes('cat ba') ||
      norm.includes('ly son') ||
      norm.includes('phu quy') ||
      norm.includes('cu lao cham') ||
      norm.includes('co to')
    ) {
      return true;
    }

    // Check if nearest transit hub in DB is specifically a FERRY_TERMINAL within 50km
    try {
      const ferryHubs = await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'FERRY_TERMINAL' },
      });
      for (const hub of ferryHubs) {
        const dist = this.computeHaversineDistance(destLat, destLng, hub.latitude, hub.longitude);
        if (dist <= 45) {
          return true;
        }
      }
    } catch {}

    return false;
  }

  /**
   * Format VND currency string for summary cards.
   */
  private formatVnd(val: number): string {
    return `${Math.round(val).toLocaleString('vi-VN')}đ`;
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
    departDate: string;
    returnDate?: string;
  }): Promise<IntercityTransitResult> {
    const { originCity, destCity, departDate, returnDate } = params;

    const originCoords =
      params.originLat && params.originLng
        ? { lat: params.originLat, lng: params.originLng }
        : await this.resolveCityLocation(originCity);

    const destCoords =
      params.destLat && params.destLng
        ? { lat: params.destLat, lng: params.destLng }
        : await this.resolveCityLocation(destCity);

    const roadDistanceKm = this.computeRoadDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng,
    );

    const isIsland = await this.isIslandDestination(destCity, destCoords.lat, destCoords.lng);

    const context: TransitStrategyContext = {
      originCity,
      destCity,
      departDate,
      returnDate,
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
    };

    const requestedMode =
      params.transitMode ||
      (roadDistanceKm > PRICING_CONFIG.INTERCITY.AUTO_FLIGHT_MIN_KM
        ? TransitModeEnum.FLIGHT
        : TransitModeEnum.SLEEPER_BUS);

    const strategy = this.strategies.get(requestedMode) || this.strategies.get(TransitModeEnum.SLEEPER_BUS)!;
    const result = await strategy.calculate(context);

    // Compute allModesSummary so the Frontend Wizard modal cards get real backend figures with ZERO magic numbers
    const allModesSummary: TransitModeSummary[] = [];
    const modeConfigs = [
      { mode: TransitModeEnum.FLIGHT, title: 'Máy bay' },
      { mode: TransitModeEnum.SLEEPER_BUS, title: 'Xe khách giường nằm' },
      { mode: TransitModeEnum.TRAIN, title: 'Tàu hỏa (Đường sắt)' },
      { mode: TransitModeEnum.PERSONAL_MOTORBIKE, title: 'Phượt xe máy' },
    ];

    for (const item of modeConfigs) {
      const itemStrategy = this.strategies.get(item.mode);
      if (itemStrategy) {
        try {
          const itemRes = await itemStrategy.calculate(context);
          const durHours = Math.round(itemRes.durationMinutes / 60);
          let durationText = '';
          let priceText = '';

          if (item.mode === TransitModeEnum.FLIGHT) {
            const durM = itemRes.durationMinutes;
            durationText = `Nhanh nhất (~${durM >= 60 ? `${Math.floor(durM / 60)}h${durM % 60 ? durM % 60 + 'p' : ''}` : `${durM}p`})`;
            priceText = `Từ ~${this.formatVnd(itemRes.estimatedPriceOneWay)}`;
          } else if (item.mode === TransitModeEnum.SLEEPER_BUS) {
            durationText = `Giường nằm (~${durHours}h)`;
            priceText = `Từ ~${this.formatVnd(itemRes.estimatedPriceOneWay)}/vé`;
          } else if (item.mode === TransitModeEnum.TRAIN) {
            durationText = itemRes.isMultiModal
              ? `Tàu + Xe (~${durHours}h)`
              : `Đường sắt (~${durHours}h)`;
            priceText = `Từ ~${this.formatVnd(itemRes.estimatedPriceOneWay)}/vé`;
          } else if (item.mode === TransitModeEnum.PERSONAL_MOTORBIKE) {
            durationText = `Phượt xe máy (~${durHours}h)`;
            priceText = `~${this.formatVnd(itemRes.estimatedPriceOneWay)} xăng`;
          }

          allModesSummary.push({
            mode: item.mode,
            title: item.title,
            durationText,
            priceText,
            estimatedPriceOneWay: itemRes.estimatedPriceOneWay,
            durationMinutes: itemRes.durationMinutes,
            isMultiModal: Boolean(itemRes.isMultiModal),
            warning:
              item.mode === TransitModeEnum.PERSONAL_MOTORBIKE && roadDistanceKm > 350
                ? 'Chú ý cự ly xa'
                : undefined,
          });
        } catch {}
      }
    }

    result.allModesSummary = allModesSummary;
    return result;
  }
}
