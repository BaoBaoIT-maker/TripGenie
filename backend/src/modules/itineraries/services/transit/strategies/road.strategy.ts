import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  type AppLocale,
} from '../../../../../common/i18n/locale.util';
import { t } from '../../../../../common/i18n/t.util';
import {
  PRICING_CONFIG,
  buildGoogleMapsDirUrl,
  checkTransitSafety,
} from '../../../../../config/pricing.config';
import { TransitModeEnum } from '../../../dto/generate-itinerary.dto';
import {
  ITransitStrategy,
  TransitStrategyContext,
  IntercityTransitResult,
  TransitModeSummary,
  TransitTransferLeg,
  formatDuration,
  formatVndCurrency,
  getHubDisplayName,
} from '../transit.types';

@Injectable()
export class RoadTransitStrategy implements ITransitStrategy {
  constructor(
    public readonly mode:
      TransitModeEnum.PERSONAL_MOTORBIKE | TransitModeEnum.PERSONAL_CAR,
  ) {}

  summarize(
    res: IntercityTransitResult,
    roadDistanceKm: number,
    locale: AppLocale = DEFAULT_LOCALE,
  ): TransitModeSummary | null {
    if (this.mode !== TransitModeEnum.PERSONAL_MOTORBIKE) return null;
    const durHours = Math.max(1, Math.round(res.durationMinutes / 60));
    return {
      mode: this.mode,
      title: t(locale, 'transit.road.motorbikeSummaryTitle'),
      durationText: t(locale, 'transit.road.motorbikeSummaryDur', {
        hours: durHours,
      }),
      priceText: t(locale, 'transit.road.motorbikeSummaryPrice', {
        price: formatVndCurrency(res.estimatedPriceOneWay),
      }),
      estimatedPriceOneWay: res.estimatedPriceOneWay,
      durationMinutes: res.durationMinutes,
      isMultiModal: Boolean(res.isMultiModal),
      warning:
        roadDistanceKm >
        PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
          ? t(locale, 'transit.road.motorbikeSummaryWarning')
          : undefined,
    };
  }

  async calculate(
    ctx: TransitStrategyContext,
  ): Promise<IntercityTransitResult> {
    const { originCity, destCity, roadDistanceKm, isIsland } = ctx;
    const locale: AppLocale = ctx.locale ?? DEFAULT_LOCALE;

    const isMotorbike = this.mode === TransitModeEnum.PERSONAL_MOTORBIKE;
    const speed = PRICING_CONFIG.INTERCITY.AVG_SPEED_KMH;
    const gasPrice = PRICING_CONFIG.FUEL.GAS_PRICE_PER_LITER;
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const ferryPortName =
      getHubDisplayName(ctx.nearestFerryHub, locale) ||
      PRICING_CONFIG.DEFAULTS.FERRY_PORT_NAME;

    if (isMotorbike) {
      const fuelLiters = Number(
        (
          (roadDistanceKm / 100) *
          PRICING_CONFIG.FUEL.MOTORBIKE_CONSUMPTION_PER_100KM
        ).toFixed(1),
      );
      const baseFuelCost = Math.round(fuelLiters * gasPrice);
      const baseDriveMinutes = Math.round(
        (roadDistanceKm / speed.PERSONAL_MOTORBIKE) * 60,
      );
      let fuelCost = baseFuelCost;
      let durationMinutes = baseDriveMinutes;
      let transferLeg: TransitTransferLeg | undefined;
      let routeSteps: string[] = [];

      if (isIsland) {
        const ferryFare = T.FERRY_ONE_WAY_MOTORBIKE;
        const ferryDur = T.MOTORBIKE_FERRY_MINUTES;
        transferLeg = {
          type: 'FERRY',
          title: t(locale, 'transit.road.motorbikeIslandTransferTitle', {
            port: ferryPortName,
            dest: destCity,
          }),
          fromName: ferryPortName,
          toName: destCity,
          distanceKm: T.ISLAND_PORT_DISTANCE_KM,
          durationMinutes: ferryDur,
          estimatedPrice: ferryFare,
          description: t(locale, 'transit.road.motorbikeIslandTransferDesc', {
            port: ferryPortName,
            dest: destCity,
          }),
        };
        fuelCost += ferryFare;
        durationMinutes += ferryDur;
        routeSteps = [
          t(locale, 'transit.road.motorbikeIslandStep1', {
            origin: originCity,
            port: ferryPortName,
            km: roadDistanceKm,
            dur: formatDuration(baseDriveMinutes, false, locale),
          }),
          t(locale, 'transit.road.motorbikeIslandStep2', {
            port: ferryPortName,
            dest: destCity,
            dur: formatDuration(ferryDur, false, locale),
            price: formatVndCurrency(ferryFare),
          }),
        ];
      } else {
        routeSteps =
          roadDistanceKm >
          PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
            ? [
                t(locale, 'transit.road.motorbikeUnsafeStep1', {
                  km: roadDistanceKm,
                  dur: formatDuration(baseDriveMinutes, false, locale),
                  maxKm:
                    PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM,
                }),
                t(locale, 'transit.road.motorbikeUnsafeStep2'),
              ]
            : [
                t(locale, 'transit.road.motorbikeSafeStep1', {
                  origin: originCity,
                  dest: destCity,
                  km: roadDistanceKm,
                  dur: formatDuration(baseDriveMinutes, false, locale),
                }),
                t(locale, 'transit.road.motorbikeSafeStep2', {
                  price: formatVndCurrency(fuelCost),
                  liters: fuelLiters,
                }),
              ];
      }

      const safetyAdvisory = checkTransitSafety(
        TransitModeEnum.PERSONAL_MOTORBIKE,
        roadDistanceKm,
        locale,
      );

      return {
        mode: this.mode,
        originName: originCity,
        destName: destCity,
        distanceKm: roadDistanceKm,
        durationMinutes,
        estimatedPriceOneWay: fuelCost,
        estimatedPriceRoundTrip: fuelCost * 2,
        deepLinks: {
          googleMaps: buildGoogleMapsDirUrl({
            origin: originCity,
            destination: destCity,
            travelMode: 'two-wheeler',
          }),
        },
        safetyAdvisory,
        isIsland,
        isMultiModal: isIsland,
        transferLeg,
        details: {
          fuelCost,
          fuelLiters,
          gasPricePerLiter: gasPrice,
          notes:
            roadDistanceKm >
            PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
              ? t(locale, 'transit.road.motorbikeUnsafeNotes', {
                  maxKm:
                    PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM,
                })
              : t(locale, 'transit.road.motorbikeSafeNotes'),
          routeSteps,
        },
      };
    }

    // PERSONAL_CAR
    const fuelLiters = Number(
      (
        (roadDistanceKm / 100) *
        PRICING_CONFIG.FUEL.CAR_CONSUMPTION_PER_100KM
      ).toFixed(1),
    );
    const fuelCost = Math.round(fuelLiters * gasPrice);
    const highwayToll = Math.round(
      roadDistanceKm *
        PRICING_CONFIG.INTERCITY.HIGHWAY_SHARE *
        PRICING_CONFIG.FUEL.HIGHWAY_TOLL_PER_KM,
    );
    const totalOneWay = fuelCost + highwayToll;
    const durationMinutes = Math.round(
      (roadDistanceKm / speed.PERSONAL_CAR) * 60,
    );

    const safetyAdvisory = checkTransitSafety(
      TransitModeEnum.PERSONAL_CAR,
      roadDistanceKm,
      locale,
    );

    return {
      mode: this.mode,
      originName: originCity,
      destName: destCity,
      distanceKm: roadDistanceKm,
      durationMinutes,
      estimatedPriceOneWay: totalOneWay,
      estimatedPriceRoundTrip: totalOneWay * 2,
      deepLinks: {
        googleMaps: buildGoogleMapsDirUrl({
          origin: originCity,
          destination: destCity,
          travelMode: 'driving',
        }),
      },
      safetyAdvisory,
      details: {
        fuelCost,
        fuelLiters,
        gasPricePerLiter: gasPrice,
        highwayToll,
        notes: t(locale, 'transit.road.carNotes', {
          fuel: formatVndCurrency(fuelCost),
          liters: fuelLiters,
          toll: formatVndCurrency(highwayToll),
        }),
        routeSteps: [
          t(locale, 'transit.road.carStep1', {
            origin: originCity,
            dest: destCity,
            km: roadDistanceKm,
            dur: formatDuration(durationMinutes, false, locale),
          }),
          t(locale, 'transit.road.carStep2', {
            fuel: formatVndCurrency(fuelCost),
            toll: formatVndCurrency(highwayToll),
          }),
        ],
      },
    };
  }
}
