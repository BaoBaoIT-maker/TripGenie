import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import {
  DEFAULT_LOCALE,
  type AppLocale,
} from '../../../../../common/i18n/locale.util';
import { t } from '../../../../../common/i18n/t.util';
import {
  PRICING_CONFIG,
  buildVexereBusUrl,
  checkTransitSafety,
  resolveVexereBusPartner,
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
  formatDuration,
  formatVndCurrency,
  getHubDisplayName,
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

  private async resolveTerminals(ctx: TransitStrategyContext): Promise<{
    originBus: TransitHubDto | null;
    destBus: TransitHubDto | null;
  }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'BUS_TERMINAL' },
      }));
    return {
      originBus: findNearestHub(
        hubs,
        'BUS_TERMINAL',
        ctx.originCoords.lat,
        ctx.originCoords.lng,
      ),
      destBus: findNearestHub(
        hubs,
        'BUS_TERMINAL',
        ctx.destCoords.lat,
        ctx.destCoords.lng,
      ),
    };
  }

  summarize(
    res: IntercityTransitResult,
    _roadDistanceKm?: number,
    locale: AppLocale = DEFAULT_LOCALE,
  ): TransitModeSummary {
    const durHours = Math.max(1, Math.round(res.durationMinutes / 60));
    return {
      mode: this.mode,
      title: t(locale, 'transit.bus.summaryTitle'),
      durationText: res.isMultiModal
        ? t(locale, 'transit.bus.summaryMultiModal', { hours: durHours })
        : t(locale, 'transit.bus.summaryDirect', { hours: durHours }),
      priceText: t(locale, 'transit.bus.summaryPrice', {
        price: formatVndCurrency(res.estimatedPriceOneWay),
      }),
      estimatedPriceOneWay: res.estimatedPriceOneWay,
      durationMinutes: res.durationMinutes,
      isMultiModal: Boolean(res.isMultiModal),
    };
  }

  async calculate(
    ctx: TransitStrategyContext,
  ): Promise<IntercityTransitResult> {
    const {
      originCity,
      destCity,
      departDate,
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;
    const locale: AppLocale = ctx.locale ?? DEFAULT_LOCALE;

    const speed = PRICING_CONFIG.INTERCITY.AVG_SPEED_KMH;
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const C = PRICING_CONFIG.INTERCITY.CARRIERS;
    const D = PRICING_CONFIG.DEFAULTS;
    const { originBus, destBus } = await this.resolveTerminals(ctx);

    const hasOriginBus = isDirectCityHub(
      originBus,
      originCoords.areaId,
      T.LOCAL_HUB_MAX_DISTANCE_KM,
    );
    const hasDestBus =
      !isIsland &&
      isDirectCityHub(destBus, destCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM);
    const ferryPortName =
      getHubDisplayName(ctx.nearestFerryHub, locale) || D.FERRY_PORT_NAME;

    const originBusName =
      hasOriginBus && originBus
        ? (getHubDisplayName(originBus, locale) ?? originBus.name)
        : t(locale, 'transit.bus.stationFallback', { city: originCity });
    const destBusName =
      hasDestBus && destBus
        ? (getHubDisplayName(destBus, locale) ?? destBus.name)
        : isIsland
          ? ferryPortName
          : t(locale, 'transit.bus.stationFallback', { city: destCity });

    const fromPartner = resolveVexereBusPartner(originCity);
    const toPartner =
      resolveVexereBusPartner(isIsland ? ferryPortName : destCity) ??
      (isIsland ? resolveVexereBusPartner(destCity) : null);
    const vexereUrl = buildVexereBusUrl({
      fromSlug: fromPartner?.slug,
      toSlug: toPartner?.slug,
      fromExternalId: fromPartner?.externalId,
      toExternalId: toPartner?.externalId,
      departDateVn: formatVnDate(departDate),
    });

    const baseBusFare = Math.round(
      roadDistanceKm * PRICING_CONFIG.INTERCITY.SLEEPER_BUS_PER_KM,
    );
    const baseBusMinutes = Math.round(
      (roadDistanceKm / speed.SLEEPER_BUS) * 60,
    );
    let busPriceOneWay = baseBusFare;
    let busDurationMinutes = baseBusMinutes;
    let transferLeg: TransitTransferLeg | undefined;
    let routeSteps: string[] = [];

    if (isIsland) {
      const ferryFare = T.FERRY_ONE_WAY_PASSENGER;
      const ferryDur = T.FERRY_MINUTES;
      transferLeg = {
        type: 'FERRY',
        title: t(locale, 'transit.bus.islandTransferTitle', {
          port: ferryPortName,
          dest: destCity,
        }),
        fromName: ferryPortName,
        toName: destCity,
        distanceKm: T.ISLAND_PORT_DISTANCE_KM,
        durationMinutes: ferryDur,
        estimatedPrice: ferryFare,
        description: t(locale, 'transit.bus.islandTransferDesc', {
          port: ferryPortName,
          dest: destCity,
        }),
      };
      busPriceOneWay += ferryFare;
      busDurationMinutes += ferryDur;
      routeSteps = [
        t(locale, 'transit.bus.islandStep1', {
          origin: originBusName,
          port: ferryPortName,
          dur: formatDuration(baseBusMinutes, false, locale),
          price: formatVndCurrency(baseBusFare),
        }),
        t(locale, 'transit.bus.islandStep2', {
          port: ferryPortName,
          dest: destCity,
          dur: formatDuration(ferryDur, true, locale),
          price: formatVndCurrency(ferryFare),
        }),
      ];
    } else {
      const { transferKm, transferMinutes } = computeLocalTransfer(
        hasDestBus ? destBus?.distanceKm : undefined,
        T.MIN_LOCAL_TRANSFER_KM,
      );
      routeSteps = [
        t(locale, 'transit.bus.directStep1', {
          origin: originBusName,
          dest: destBusName,
          dur: formatDuration(busDurationMinutes, false, locale),
          price: formatVndCurrency(busPriceOneWay),
        }),
        t(locale, 'transit.bus.directStep2', {
          destStation: destBusName,
          dest: destCity,
          km: transferKm,
          mins: transferMinutes,
        }),
      ];
    }

    const safetyAdvisory = checkTransitSafety(
      TransitModeEnum.SLEEPER_BUS,
      roadDistanceKm,
      locale,
    );

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
            ? t(locale, 'transit.bus.notesOvernight')
            : t(locale, 'transit.bus.notesDaytime'),
        routeSteps,
      },
    };
  }
}
