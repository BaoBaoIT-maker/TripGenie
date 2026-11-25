import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import {
  DEFAULT_LOCALE,
  type AppLocale,
} from '../../../../../common/i18n/locale.util';
import { t } from '../../../../../common/i18n/t.util';
import {
  PRICING_CONFIG,
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
  formatDuration,
  formatVndCurrency,
  getHubDisplayName,
  isDirectCityHub,
} from '../transit.types';

@Injectable()
export class TrainTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.TRAIN;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveStations(ctx: TransitStrategyContext): Promise<{
    originTrain: TransitHubDto | null;
    destTrain: TransitHubDto | null;
  }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'TRAIN_STATION' },
      }));
    return {
      originTrain: findNearestHub(
        hubs,
        'TRAIN_STATION',
        ctx.originCoords.lat,
        ctx.originCoords.lng,
      ),
      destTrain: findNearestHub(
        hubs,
        'TRAIN_STATION',
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
      title: t(locale, 'transit.train.summaryTitle'),
      durationText: res.isMultiModal
        ? t(locale, 'transit.train.summaryMultiModal', { hours: durHours })
        : t(locale, 'transit.train.summaryDirect', { hours: durHours }),
      priceText: t(locale, 'transit.train.summaryPrice', {
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
    const { originTrain, destTrain } = await this.resolveStations(ctx);

    const originTrainName =
      getHubDisplayName(originTrain, locale) ||
      t(locale, 'transit.train.stationFallback', { city: originCity });
    const ferryPortName =
      getHubDisplayName(ctx.nearestFerryHub, locale) || D.FERRY_PORT_NAME;

    let destTrainName = '';
    let isMultiModal = false;
    let transferLeg: TransitTransferLeg | undefined;
    let trainPriceOneWay = 0;
    let trainDurationMinutes = 0;
    let routeSteps: string[] = [];

    const hasDirectStation =
      !isIsland &&
      isDirectCityHub(
        destTrain,
        destCoords.areaId,
        T.LOCAL_HUB_MAX_DISTANCE_KM,
      );

    if (isIsland) {
      // 1. Island destination: No railway crosses open sea directly
      isMultiModal = true;
      const gatewayStationName =
        getHubDisplayName(destTrain, locale) || originTrainName;
      destTrainName = t(locale, 'transit.train.islandDestSuffix', {
        station: gatewayStationName,
      });

      const trainDist = Math.max(
        T.MIN_TRAIN_DISTANCE_KM,
        Math.round(roadDistanceKm * T.TRAIN_ISLAND_LAND_RATIO),
      );
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(
        trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM,
      );

      const transferKm = Math.max(
        T.ISLAND_PORT_DISTANCE_KM,
        destTrain?.distanceKm || Math.round(roadDistanceKm - trainDist),
      );
      const transferDur = T.FERRY_MINUTES + T.ISLAND_MAINLAND_BUS_MINUTES;
      const transferPrice =
        T.FERRY_ONE_WAY_PASSENGER + T.ISLAND_MAINLAND_BUS_FARE;

      transferLeg = {
        type: 'FERRY',
        title: t(locale, 'transit.train.islandTransferTitle', {
          port: ferryPortName,
        }),
        fromName: gatewayStationName,
        toName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferDur,
        estimatedPrice: transferPrice,
        description: t(locale, 'transit.train.islandTransferDesc', {
          station: gatewayStationName,
          port: ferryPortName,
          dest: destCity,
        }),
      };

      trainDurationMinutes = trainDur + transferDur;
      trainPriceOneWay = trainFare + transferPrice;

      routeSteps = [
        t(locale, 'transit.train.islandStep1', {
          origin: originTrainName,
          station: gatewayStationName,
          dur: formatDuration(trainDur, false, locale),
          price: formatVndCurrency(trainFare),
        }),
        t(locale, 'transit.train.islandStep2', {
          station: gatewayStationName,
          port: ferryPortName,
          dest: destCity,
          dur: formatDuration(transferDur, false, locale),
          price: formatVndCurrency(transferPrice),
        }),
        t(locale, 'transit.train.islandStep3', { dest: destCity }),
      ];
    } else if (destTrain && !hasDirectStation) {
      // 2. Mainland destination far from railway (e.g. Đà Lạt via Ga Tháp Chàm, Sa Pa via Ga Lào Cai, Quy Nhơn via Ga Diêu Trì)
      isMultiModal = true;
      const resolvedDestStation =
        getHubDisplayName(destTrain, locale) ?? destTrain.name;
      destTrainName = resolvedDestStation;
      const transferDist = destTrain.distanceKm || T.DEFAULT_RAIL_TRANSFER_KM;
      const trainDist = Math.max(
        T.MIN_TRAIN_DISTANCE_KM,
        Math.round(roadDistanceKm - transferDist),
      );
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(
        trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM,
      );

      const transferDur = Math.round(
        transferDist * T.REGIONAL_TRANSFER_MINS_PER_KM,
      );
      const transferPrice = Math.round(transferDist * T.BUS_PER_KM);

      transferLeg = {
        type: 'BUS',
        title: t(locale, 'transit.train.farTransferTitle', {
          station: resolvedDestStation,
          dest: destCity,
        }),
        fromName: resolvedDestStation,
        toName: destCity,
        distanceKm: transferDist,
        durationMinutes: transferDur,
        estimatedPrice: transferPrice,
        description: t(locale, 'transit.train.farTransferDesc', {
          station: resolvedDestStation,
          dest: destCity,
        }),
      };

      trainDurationMinutes = trainDur + transferDur;
      trainPriceOneWay = trainFare + transferPrice;

      routeSteps = [
        t(locale, 'transit.train.islandStep1', {
          origin: originTrainName,
          station: resolvedDestStation,
          dur: formatDuration(trainDur, false, locale),
          price: formatVndCurrency(trainFare),
        }),
        t(locale, 'transit.train.farStep2', {
          station: resolvedDestStation,
          dest: destCity,
          km: transferDist,
          dur: formatDuration(transferDur, true, locale),
          price: formatVndCurrency(transferPrice),
        }),
      ];
    } else {
      // 3. Direct / Satellite Train Station exists (Đà Nẵng, Nha Trang, Huế, Hà Nội, Vinh, Hội An via Ga Đà Nẵng...)
      isMultiModal = false;
      destTrainName =
        getHubDisplayName(destTrain, locale) ||
        t(locale, 'transit.train.stationFallback', { city: destCity });
      trainDurationMinutes = Math.round((roadDistanceKm / speed.TRAIN) * 60);
      trainPriceOneWay = Math.round(
        roadDistanceKm * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM,
      );

      const { transferKm, transferMinutes } = computeLocalTransfer(
        destTrain?.distanceKm,
        T.MIN_LOCAL_TRANSFER_KM,
      );

      routeSteps = [
        t(locale, 'transit.train.directStep1', {
          origin: originTrainName,
          dest: destTrainName,
          dur: formatDuration(trainDurationMinutes, false, locale),
          price: formatVndCurrency(trainPriceOneWay),
        }),
        t(locale, 'transit.train.directStep2', {
          station: destTrainName,
          dest: destCity,
          km: transferKm,
          mins: transferMinutes,
        }),
      ];
    }

    const safetyAdvisory = checkTransitSafety(
      TransitModeEnum.TRAIN,
      roadDistanceKm,
      locale,
    );

    return {
      mode: this.mode,
      originName: originTrainName,
      destName: destCity,
      distanceKm: roadDistanceKm,
      durationMinutes: trainDurationMinutes,
      estimatedPriceOneWay: trainPriceOneWay,
      estimatedPriceRoundTrip: trainPriceOneWay * 2,
      deepLinks: {
        vexereTrain: PRICING_CONFIG.DEEP_LINKS.VEXERE_TRAIN_URL,
        dsvn: PRICING_CONFIG.DEEP_LINKS.DSVN_URL,
      },
      safetyAdvisory,
      originHub: isDirectCityHub(
        originTrain,
        originCoords.areaId,
        T.LOCAL_HUB_MAX_DISTANCE_KM,
      )
        ? originTrain || undefined
        : undefined,
      destHub: destTrain || undefined,
      isIsland,
      isMultiModal,
      transferLeg,
      details: {
        carriers: C.TRAIN,
        notes: isMultiModal
          ? t(locale, 'transit.train.notesMultiModal', {
              station: destTrainName,
              dest: destCity,
            })
          : t(locale, 'transit.train.notesDirect', {
              station: destTrainName,
            }),
        routeSteps,
      },
    };
  }
}
