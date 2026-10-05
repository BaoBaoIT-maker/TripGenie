import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { PRICING_CONFIG, checkTransitSafety } from '../../../../../config/pricing.config';
import { TransitModeEnum } from '../../../dto/generate-itinerary.dto';
import {
  ITransitStrategy,
  TransitStrategyContext,
  IntercityTransitResult,
  TransitHubDto,
  TransitTransferLeg,
} from '../transit.types';

function formatVnDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

@Injectable()
export class BusTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.SLEEPER_BUS;

  constructor(private readonly prisma: PrismaService) {}

  private computeHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
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

  private async findNearestBusTerminal(lat: number, lng: number): Promise<TransitHubDto | null> {
    const hubs = await this.prisma.transitHub.findMany({
      where: { isActive: true, hubType: 'BUS_TERMINAL' },
    });
    if (!hubs || hubs.length === 0) return null;

    let nearest: TransitHubDto | null = null;
    let minDist = Infinity;
    for (const hub of hubs) {
      const dist = this.computeHaversineDistance(lat, lng, hub.latitude, hub.longitude);
      if (dist < minDist) {
        minDist = dist;
        nearest = { ...hub, distanceKm: Math.round(dist) };
      }
    }
    return nearest;
  }

  private async findPartnerMapping(params: {
    cityName: string;
    areaId?: number;
  }): Promise<{ slug: string; externalId: string } | null> {
    const { cityName, areaId } = params;
    const cleanTerm = (cityName || '')
      .replace(/^(ga|bến xe|sân bay|trung tâm|tp\.|thành phố|tỉnh|huyện|quận)\s+/i, '')
      .trim();

    if (cleanTerm) {
      try {
        const rows = await this.prisma.$queryRaw<
          Array<{ slug: string; external_id: string }>
        >`
          SELECT slug, external_id
          FROM transit_partner_mappings
          WHERE provider = 'VEXERE' AND hub_type = 'BUS'
            AND (
              unaccent(name) ILIKE '%' || unaccent(${cleanTerm}) || '%'
              OR unaccent(slug) ILIKE '%' || unaccent(${cleanTerm}) || '%'
              OR metadata->'aliases' ? LOWER(${cleanTerm})
            )
          LIMIT 1
        `;
        if (rows && rows.length > 0) {
          return { slug: rows[0].slug, externalId: rows[0].external_id };
        }
      } catch {}
    }

    if (areaId) {
      try {
        const rows = await this.prisma.$queryRaw<
          Array<{ slug: string; external_id: string }>
        >`
          SELECT slug, external_id
          FROM transit_partner_mappings
          WHERE provider = 'VEXERE' AND hub_type = 'BUS' AND area_id = ${areaId}
          LIMIT 1
        `;
        if (rows && rows.length > 0) {
          return { slug: rows[0].slug, externalId: rows[0].external_id };
        }
      } catch {}
    }

    return null;
  }

  async calculate(ctx: TransitStrategyContext): Promise<IntercityTransitResult> {
    const {
      originCity,
      destCity,
      departDate,
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;

    const speed = PRICING_CONFIG.INTERCITY.AVG_SPEED_KMH;
    const originBus = await this.findNearestBusTerminal(originCoords.lat, originCoords.lng);
    const destBus = await this.findNearestBusTerminal(destCoords.lat, destCoords.lng);

    const originBusName =
      originBus && (originBus.distanceKm ?? 999) <= 50
        ? originBus.name
        : `Bến xe tại ${originCity}`;
    const destBusName =
      destBus && (destBus.distanceKm ?? 999) <= 50
        ? destBus.name
        : (isIsland ? `Bến tàu cao tốc đi ${destCity}` : `Bến xe tại ${destCity}`);

    const fromPartner = await this.findPartnerMapping({
      cityName: originCity,
      areaId: originCoords.areaId || originBus?.areaId,
    });
    const toPartner = await this.findPartnerMapping({
      cityName: isIsland ? 'Kiên Giang' : destCity,
      areaId: destCoords.areaId || destBus?.areaId,
    });
    const depDateVn = formatVnDate(departDate);
    const vexereUrl =
      fromPartner && toPartner
        ? `https://vexere.com/vi-VN/ve-xe-khach-tu-${fromPartner.slug}-di-${toPartner.slug}-${fromPartner.externalId}t${toPartner.externalId}1.html?date=${depDateVn}`
        : `https://vexere.com/vi-VN/ve-xe-khach`;

    let busPriceOneWay = Math.round(
      roadDistanceKm * PRICING_CONFIG.INTERCITY.SLEEPER_BUS_PER_KM,
    );
    let busDurationMinutes = Math.round((roadDistanceKm / speed.SLEEPER_BUS) * 60);
    let transferLeg: TransitTransferLeg | undefined;
    let routeSteps: string[] = [];

    if (isIsland) {
      const ferryFare = PRICING_CONFIG.INTERCITY.TRANSFER.FERRY_ONE_WAY_PASSENGER;
      const ferryDur = PRICING_CONFIG.INTERCITY.TRANSFER.FERRY_MINUTES;
      transferLeg = {
        type: 'FERRY',
        title: 'Tàu cao tốc vượt biển sang đảo',
        fromName: 'Cảng Bến tàu Rạch Giá / Hà Tiên',
        toName: destCity,
        distanceKm: 45,
        durationMinutes: ferryDur,
        estimatedPrice: ferryFare,
        description: `Tàu cao tốc Superdong / Phú Quốc Express từ đất liền sang đảo ${destCity}`,
      };
      busPriceOneWay += ferryFare;
      busDurationMinutes += ferryDur;
      routeSteps = [
        `Chặng 1 (Xe khách giường nằm): ${originBusName} ──> Cảng Bến tàu Rạch Giá / Hà Tiên (~${Math.round(roadDistanceKm / speed.SLEEPER_BUS)} tiếng, ~${Math.round(roadDistanceKm * PRICING_CONFIG.INTERCITY.SLEEPER_BUS_PER_KM).toLocaleString()}đ/vé)`,
        `Chặng 2 (Tàu cao tốc vượt biển): Cảng đất liền ──> Đảo ${destCity} (~${Math.floor(ferryDur / 60)}h${ferryDur % 60 ? ferryDur % 60 + 'p' : ''}, ~${ferryFare.toLocaleString()}đ/vé)`,
      ];
    } else {
      routeSteps = [
        `Đón xe tại ${originBusName} ──> ${destBusName} (~${Math.round(busDurationMinutes / 60)} tiếng, ~${busPriceOneWay.toLocaleString()}đ/vé)`,
        `Các nhà xe chất lượng cao: Phương Trang (FUTA), Thành Bưởi, Limousine cao cấp`,
      ];
    }

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.SLEEPER_BUS, roadDistanceKm);

    return {
      mode: 'SLEEPER_BUS',
      originName: originBusName,
      destName: destBusName,
      distanceKm: roadDistanceKm,
      durationMinutes: busDurationMinutes,
      estimatedPriceOneWay: busPriceOneWay,
      estimatedPriceRoundTrip: busPriceOneWay * 2,
      deepLinks: {
        vexere: vexereUrl,
      },
      safetyAdvisory,
      originHub: originBus && (originBus.distanceKm ?? 999) <= 50 ? originBus : undefined,
      destHub: destBus && (destBus.distanceKm ?? 999) <= 50 ? destBus : undefined,
      isIsland,
      isMultiModal: isIsland,
      transferLeg,
      details: {
        carriers: 'Phương Trang (FUTA), Thành Bưởi, Limousine liên tỉnh',
        notes:
          busDurationMinutes > 360
            ? 'Khuyên chọn xe giường nằm xuất phát lúc 22:00 - 23:00 để ngủ đêm trên xe, tiết kiệm 1 đêm khách sạn.'
            : 'Nên chọn xe Limousine xuất phát sáng để đến nơi vào đầu giờ chiều.',
        routeSteps,
      },
    };
  }
}
