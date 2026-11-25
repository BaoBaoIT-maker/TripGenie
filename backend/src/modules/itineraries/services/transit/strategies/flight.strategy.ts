import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import {
  DEFAULT_LOCALE,
  type AppLocale,
} from '../../../../../common/i18n/locale.util';
import { t } from '../../../../../common/i18n/t.util';
import {
  PRICING_CONFIG,
  buildGoogleFlightsUrl,
  buildGoogleMapsDirUrl,
  calculateFlightFare,
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
  computeHaversineDistance,
  computeLocalTransfer,
  findNearestHub,
  formatDuration,
  formatVndCurrency,
  getHubDisplayName,
  isDirectCityHub,
} from '../transit.types';

@Injectable()
export class FlightTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.FLIGHT;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveAirports(ctx: TransitStrategyContext): Promise<{
    originAirport: TransitHubDto | null;
    destAirport: TransitHubDto | null;
  }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'AIRPORT' },
      }));
    return {
      originAirport: findNearestHub(
        hubs,
        'AIRPORT',
        ctx.originCoords.lat,
        ctx.originCoords.lng,
      ),
      destAirport: findNearestHub(
        hubs,
        'AIRPORT',
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
    const durLabel = formatDuration(res.durationMinutes, true, locale);
    return {
      mode: this.mode,
      title: t(locale, 'transit.flight.summaryTitle'),
      durationText: res.isMultiModal
        ? t(locale, 'transit.flight.summaryMultiModal', { dur: durLabel })
        : t(locale, 'transit.flight.summaryDirect', { dur: durLabel }),
      priceText: t(locale, 'transit.flight.summaryPrice', {
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
      returnDate,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;
    const locale: AppLocale = ctx.locale ?? DEFAULT_LOCALE;

    const { originAirport, destAirport } = await this.resolveAirports(ctx);
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const C = PRICING_CONFIG.INTERCITY.CARRIERS;
    const D = PRICING_CONFIG.DEFAULTS;

    const originCode = originAirport?.id || D.ORIGIN_AIRPORT_CODE;
    const destCode =
      destAirport?.id ||
      (isIsland ? D.ISLAND_AIRPORT_CODE : D.MAINLAND_AIRPORT_CODE);
    const originAirportName =
      getHubDisplayName(originAirport, locale) ||
      t(locale, 'transit.flight.originFallback', { city: originCity });
    const destAirportName =
      getHubDisplayName(destAirport, locale) ||
      t(locale, 'transit.flight.destFallback', { city: destCity });

    const googleFlightsUrl = buildGoogleFlightsUrl({
      originCode,
      destCode,
      departDate,
      returnDate,
    });
    const safetyAdvisory = checkTransitSafety(
      TransitModeEnum.FLIGHT,
      roadDistanceKm,
      locale,
    );

    // Case 4: Origin and destination share the exact same gateway airport OR distance is too short (<150km) for commercial flights
    const isSameAirport = Boolean(
      originAirport && destAirport && originAirport.id === destAirport.id,
    );
    const isTooShort = roadDistanceKm < T.MIN_FLIGHT_DISTANCE_KM;

    if (isSameAirport || isTooShort) {
      const transferKm = Math.max(T.MIN_LOCAL_TRANSFER_KM, roadDistanceKm);
      const transferMinutes = Math.max(
        T.MIN_LOCAL_TRANSFER_MINUTES,
        Math.round(transferKm * T.REGIONAL_TRANSFER_MINS_PER_KM),
      );
      const transferPrice = Math.round(
        transferKm * PRICING_CONFIG.INTERCITY.LIMOUSINE_BUS_PER_KM,
      );

      const gatewayNotice = isSameAirport
        ? t(locale, 'transit.flight.sameAirportNotice', {
            origin: originCity,
            dest: destCity,
            airport: destAirportName,
            km: transferKm,
          })
        : t(locale, 'transit.flight.tooShortNotice', {
            origin: originCity,
            dest: destCity,
            km: transferKm,
            minKm: T.MIN_FLIGHT_DISTANCE_KM,
          });

      const routeAdvise = isSameAirport
        ? t(locale, 'transit.flight.sameAirportAdvice', {
            origin: originCity,
            dest: destCity,
            km: transferKm,
            airport: destAirportName,
          })
        : t(locale, 'transit.flight.tooShortAdvice', {
            origin: originCity,
            dest: destCity,
            km: transferKm,
          });

      const transferLeg: TransitTransferLeg = {
        type: 'BUS',
        title: t(locale, 'transit.flight.shortTransferTitle', {
          origin: originCity,
          dest: destCity,
        }),
        fromName: originCity,
        toName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferMinutes,
        estimatedPrice: transferPrice,
        description: gatewayNotice,
      };

      return {
        mode: this.mode,
        originName: originCity,
        destName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferMinutes,
        estimatedPriceOneWay: transferPrice,
        estimatedPriceRoundTrip: transferPrice * 2,
        deepLinks: {
          googleMaps: buildGoogleMapsDirUrl({
            origin: originCity,
            destination: destCity,
            travelMode: 'driving',
          }),
        },
        safetyAdvisory,
        originHub: originAirport || undefined,
        destHub: destAirport || undefined,
        isIsland,
        isMultiModal: true,
        transferLeg,
        details: {
          carriers: C.LIMOUSINE_DIRECT,
          notes: routeAdvise,
          routeSteps: [
            t(locale, 'transit.flight.shortStep1', { notice: gatewayNotice }),
            t(locale, 'transit.flight.shortStep2', {
              origin: originCity,
              dest: destCity,
              km: transferKm,
              dur: formatDuration(transferMinutes, false, locale),
              price: formatVndCurrency(transferPrice),
            }),
          ],
        },
      };
    }

    // Continuous affine calculation by air distance (km) + contextual multipliers (budget tier, seasonality, lead-time)
    const originLat = originAirport?.latitude ?? ctx.originCoords.lat;
    const originLng = originAirport?.longitude ?? ctx.originCoords.lng;
    const destLat = destAirport?.latitude ?? ctx.destCoords.lat;
    const destLng = destAirport?.longitude ?? ctx.destCoords.lng;
    const airDistanceKm = Math.round(
      computeHaversineDistance(originLat, originLng, destLat, destLng),
    );

    const flightPricing = calculateFlightFare({
      airDistanceKm,
      budgetLevel: ctx.budgetLevel,
      departDate,
    });
    const baseFlightDuration = flightPricing.flightDurationMinutes;
    const baseFlightOneWay = flightPricing.finalFare;
    const flightDurationLabel = formatDuration(
      baseFlightDuration,
      true,
      locale,
    );

    const hasIslandDirectAirport =
      isIsland &&
      isDirectCityHub(
        destAirport,
        destCoords.areaId,
        T.ISLAND_DIRECT_HUB_MAX_KM,
      );
    const hasMainlandDirectAirport =
      !isIsland &&
      isDirectCityHub(
        destAirport,
        destCoords.areaId,
        T.LOCAL_HUB_MAX_DISTANCE_KM,
      );

    // Case 3: Island destination WITHOUT its own airport (e.g. Lý Sơn via Chu Lai VCL, Phú Quý, Cát Bà, Cô Tô)
    if (isIsland && !hasIslandDirectAirport) {
      const ferryPortName =
        getHubDisplayName(ctx.nearestFerryHub, locale) || D.FERRY_PORT_NAME;
      const landTransferKm = Math.max(
        T.DEFAULT_AIRPORT_TRANSFER_KM,
        destAirport?.distanceKm || T.ISLAND_PORT_DISTANCE_KM,
      );
      const landTransferMinutes = Math.round(
        landTransferKm * T.REGIONAL_TRANSFER_MINS_PER_KM,
      );
      const totalTransferMinutes = landTransferMinutes + T.FERRY_MINUTES;
      const totalTransferPrice =
        Math.round(landTransferKm * T.BUS_PER_KM) + T.FERRY_ONE_WAY_PASSENGER;

      const transferLeg: TransitTransferLeg = {
        type: 'FERRY',
        title: t(locale, 'transit.flight.islandTransferTitle', {
          port: ferryPortName,
          dest: destCity,
        }),
        fromName: destAirportName,
        toName: destCity,
        distanceKm: landTransferKm + T.ISLAND_PORT_DISTANCE_KM,
        durationMinutes: totalTransferMinutes,
        estimatedPrice: totalTransferPrice,
        description: t(locale, 'transit.flight.islandTransferDesc', {
          airport: destAirportName,
          port: ferryPortName,
          dest: destCity,
        }),
      };

      const totalOneWay = baseFlightOneWay + totalTransferPrice;
      return {
        mode: this.mode,
        originName: originAirportName,
        destName: destCity,
        distanceKm: roadDistanceKm,
        durationMinutes: baseFlightDuration + totalTransferMinutes,
        estimatedPriceOneWay: totalOneWay,
        estimatedPriceRoundTrip: totalOneWay * 2,
        deepLinks: { googleFlights: googleFlightsUrl },
        safetyAdvisory,
        originHub: originAirport || undefined,
        destHub: destAirport || undefined,
        isIsland,
        isMultiModal: true,
        transferLeg,
        details: {
          carriers: C.FLIGHT_FERRY,
          notes: t(locale, 'transit.flight.islandNotes', {
            dest: destCity,
            airport: destAirportName,
            port: ferryPortName,
          }),
          routeSteps: [
            t(locale, 'transit.flight.islandStep1', {
              origin: originAirportName,
              airport: destAirportName,
              airKm: airDistanceKm,
              dur: flightDurationLabel,
              price: formatVndCurrency(baseFlightOneWay),
            }),
            t(locale, 'transit.flight.islandStep2', {
              airport: destAirportName,
              port: ferryPortName,
              landKm: landTransferKm,
              dest: destCity,
              dur: formatDuration(totalTransferMinutes, true, locale),
              price: formatVndCurrency(totalTransferPrice),
            }),
          ],
        },
      };
    }

    // Case 2: Mainland destination far from nearest airport (e.g. Sa Pa, Hà Giang, Ninh Bình, Măng Đen, Phan Thiết)
    if (!isIsland && !hasMainlandDirectAirport) {
      const transferKm = destAirport?.distanceKm || T.LOCAL_HUB_MAX_DISTANCE_KM;
      const transferMinutes = Math.round(
        transferKm * T.REGIONAL_TRANSFER_MINS_PER_KM,
      );
      const transferPrice = Math.round(transferKm * T.BUS_PER_KM);

      const transferLeg: TransitTransferLeg = {
        type: 'BUS',
        title: t(locale, 'transit.flight.farTransferTitle', {
          airport: destAirportName,
          dest: destCity,
        }),
        fromName: destAirportName,
        toName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferMinutes,
        estimatedPrice: transferPrice,
        description: t(locale, 'transit.flight.farTransferDesc', {
          airport: destAirportName,
          dest: destCity,
        }),
      };

      const totalOneWay = baseFlightOneWay + transferPrice;

      return {
        mode: this.mode,
        originName: originAirportName,
        destName: destCity,
        distanceKm: roadDistanceKm,
        durationMinutes: baseFlightDuration + transferMinutes,
        estimatedPriceOneWay: totalOneWay,
        estimatedPriceRoundTrip: totalOneWay * 2,
        deepLinks: { googleFlights: googleFlightsUrl },
        safetyAdvisory,
        originHub: originAirport || undefined,
        destHub: destAirport || undefined,
        isIsland,
        isMultiModal: true,
        transferLeg,
        details: {
          carriers: C.FLIGHT_LIMOUSINE,
          notes: t(locale, 'transit.flight.farNotes', {
            dest: destCity,
            airport: destAirportName,
          }),
          routeSteps: [
            t(locale, 'transit.flight.islandStep1', {
              origin: originAirportName,
              airport: destAirportName,
              airKm: airDistanceKm,
              dur: flightDurationLabel,
              price: formatVndCurrency(baseFlightOneWay),
            }),
            t(locale, 'transit.flight.farStep2', {
              airport: destAirportName,
              dest: destCity,
              km: transferKm,
              dur: formatDuration(transferMinutes, false, locale),
              price: formatVndCurrency(transferPrice),
            }),
          ],
        },
      };
    }

    // Case 1: Direct / Satellite Airport (e.g. Đà Nẵng, Phú Quốc, Đà Lạt, Nha Trang, Hội An via DAD)
    const { transferKm, transferMinutes } = computeLocalTransfer(
      destAirport?.distanceKm,
    );

    return {
      mode: this.mode,
      originName: originAirportName,
      destName: destCity,
      distanceKm: roadDistanceKm,
      durationMinutes: baseFlightDuration,
      estimatedPriceOneWay: baseFlightOneWay,
      estimatedPriceRoundTrip: baseFlightOneWay * 2,
      deepLinks: {
        googleFlights: googleFlightsUrl,
      },
      safetyAdvisory,
      originHub: originAirport || undefined,
      destHub: destAirport
        ? { ...destAirport, distanceKm: transferKm }
        : undefined,
      isIsland,
      isMultiModal: false,
      details: {
        carriers: C.FLIGHT_DIRECT,
        notes: t(locale, 'transit.flight.directNotes', {
          airport: destAirportName,
          km: transferKm,
          mins: transferMinutes,
          dest: destCity,
        }),
        routeSteps: [
          t(locale, 'transit.flight.directStep1', {
            origin: originAirportName,
            airport: destAirportName,
            airKm: airDistanceKm,
            dur: flightDurationLabel,
            price: formatVndCurrency(baseFlightOneWay),
          }),
          t(locale, 'transit.flight.directStep2', {
            airport: destAirportName,
            dest: destCity,
            km: transferKm,
            mins: transferMinutes,
          }),
        ],
      },
    };
  }
}
