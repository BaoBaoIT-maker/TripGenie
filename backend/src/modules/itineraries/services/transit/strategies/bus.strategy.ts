import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import {
  PRICING_CONFIG,
  buildVexereBusUrl,
  checkTransitSafety,
} from '../../../../../config/pricing.config';
import { TransitModeEnum } from '../../../dto/generate-itinerary.dto';
import {
  ITransitStrategy,
  TransitStrategyContext,
  IntercityTransitResult,
  TransitHubDto,
  TransitModeSummary,
  TransitTransferLeg,
  computeLocalTransfer,
  findNearestHub,
  formatDurationVi,
  formatVndCurrency,
  isDirectCityHub,
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

  private async resolveTerminals(
    ctx: TransitStrategyContext,
  ): Promise<{ originBus: TransitHubDto | null; destBus: TransitHubDto | null }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'BUS_TERMINAL' },
      }));
    return {
      originBus: findNearestHub(hubs, 'BUS_TERMINAL', ctx.originCoords.lat, ctx.originCoords.lng),
      destBus: findNearestHub(hubs, 'BUS_TERMINAL', ctx.destCoords.lat, ctx.destCoords.lng),
    };
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

  summarize(res: IntercityTransitResult): TransitModeSummary {
    const durHours = Math.max(1, Math.round(res.durationMinutes / 60));
    return {
      mode: this.mode,
      title: 'Xe khách giường nằm',
      durationText: res.isMultiModal ? `Xe + Tàu (~${durHours}h)` : `Giường nằm (~${durHours}h)`,
      priceText: `Từ ~${formatVndCurrency(res.estimatedPriceOneWay)}/vé`,
      estimatedPriceOneWay: res.estimatedPriceOneWay,
      durationMinutes: res.durationMinutes,
      isMultiModal: Boolean(res.isMultiModal),
    };
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
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const C = PRICING_CONFIG.INTERCITY.CARRIERS;
    const D = PRICING_CONFIG.DEFAULTS;
    const { originBus, destBus } = await this.resolveTerminals(ctx);

    const hasOriginBus = isDirectCityHub(originBus, originCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM);
    const hasDestBus = !isIsland && isDirectCityHub(destBus, destCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM);
    const ferryPortName = ctx.nearestFerryHub?.name || D.FERRY_PORT_NAME;

    const originBusName = hasOriginBus && originBus ? originBus.name : `Bến xe tại ${originCity}`;
    const destBusName =
      hasDestBus && destBus
        ? destBus.name
        : isIsland
        ? ferryPortName
        : `Bến xe tại ${destCity}`;

    const fromPartner = await this.findPartnerMapping({
      cityName: originCity,
      areaId: originCoords.areaId || originBus?.areaId,
    });
    const toPartner = await this.findPartnerMapping({
      cityName: isIsland ? ferryPortName : destCity,
      areaId: (isIsland ? ctx.nearestFerryHub?.areaId : destCoords.areaId) || destBus?.areaId,
    });
    const vexereUrl = buildVexereBusUrl({
      fromSlug: fromPartner?.slug,
      toSlug: toPartner?.slug,
      fromExternalId: fromPartner?.externalId,
      toExternalId: toPartner?.externalId,
      departDateVn: formatVnDate(departDate),
    });

    const baseBusFare = Math.round(roadDistanceKm * PRICING_CONFIG.INTERCITY.SLEEPER_BUS_PER_KM);
    const baseBusMinutes = Math.round((roadDistanceKm / speed.SLEEPER_BUS) * 60);
    let busPriceOneWay = baseBusFare;
    let busDurationMinutes = baseBusMinutes;
    let transferLeg: TransitTransferLeg | undefined;
    let routeSteps: string[] = [];

    if (isIsland) {
      const ferryFare = T.FERRY_ONE_WAY_PASSENGER;
      const ferryDur = T.FERRY_MINUTES;
      transferLeg = {
        type: 'FERRY',
        title: `Tàu cao tốc vượt biển từ ${ferryPortName} sang đảo ${destCity}`,
        fromName: ferryPortName,
        toName: destCity,
        distanceKm: T.ISLAND_PORT_DISTANCE_KM,
        durationMinutes: ferryDur,
        estimatedPrice: ferryFare,
        description: `Tàu cao tốc từ ${ferryPortName} vượt biển sang đảo ${destCity}`,
      };
      busPriceOneWay += ferryFare;
      busDurationMinutes += ferryDur;
      routeSteps = [
        `Chặng 1 (Xe khách giường nằm): ${originBusName} ──> ${ferryPortName} (~${formatDurationVi(baseBusMinutes)}, ~${formatVndCurrency(baseBusFare)}/vé)`,
        `Chặng 2 (Tàu cao tốc vượt biển): ${ferryPortName} ──> Đảo ${destCity} (~${formatDurationVi(ferryDur, true)}, ~${formatVndCurrency(ferryFare)}/vé)`,
      ];
    } else {
      const { transferKm, transferMinutes } = computeLocalTransfer(
        hasDestBus ? destBus?.distanceKm : undefined,
        T.MIN_LOCAL_TRANSFER_KM,
      );
      routeSteps = [
        `Chặng chính (Xe giường nằm / Limousine): Đón xe tại ${originBusName} ──> ${destBusName} (~${formatDurationVi(busDurationMinutes)}, ~${formatVndCurrency(busPriceOneWay)}/vé)`,
        `Trung chuyển về khách sạn: Xe trung chuyển của nhà xe hoặc Taxi từ ${destBusName} về trung tâm ${destCity} (~${transferKm}km, ~${transferMinutes} phút)`,
      ];
    }

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.SLEEPER_BUS, roadDistanceKm);

    return {
      mode: this.mode,
      originName: originBusName,
      destName: destCity,
      distanceKm: roadDistanceKm,
      durationMinutes: busDurationMinutes,
      estimatedPriceOneWay: busPriceOneWay,
      estimatedPriceRoundTrip: busPriceOneWay * 2,
      deepLinks: {
        vexere: vexereUrl,
      },
      safetyAdvisory,
      originHub: hasOriginBus && originBus ? originBus : undefined,
      destHub: hasDestBus && destBus ? destBus : undefined,
      isIsland,
      isMultiModal: isIsland,
      transferLeg,
      details: {
        carriers: C.SLEEPER_BUS,
        notes:
          busDurationMinutes > T.OVERNIGHT_BUS_MIN_MINUTES
            ? 'Khuyên chọn xe giường nằm xuất phát lúc 22:00 - 23:00 (có xe trung chuyển miễn phí tận khách sạn) để ngủ đêm trên xe, tiết kiệm 1 đêm lưu trú.'
            : 'Nên chọn xe Limousine đưa đón tận nơi, xuất phát sáng để đến khách sạn vào đầu giờ chiều.',
        routeSteps,
      },
    };
  }
}


