import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { PRICING_CONFIG, checkTransitSafety } from '../../../../../config/pricing.config';
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

@Injectable()
export class TrainTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.TRAIN;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveStations(
    ctx: TransitStrategyContext,
  ): Promise<{ originTrain: TransitHubDto | null; destTrain: TransitHubDto | null }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'TRAIN_STATION' },
      }));
    return {
      originTrain: findNearestHub(hubs, 'TRAIN_STATION', ctx.originCoords.lat, ctx.originCoords.lng),
      destTrain: findNearestHub(hubs, 'TRAIN_STATION', ctx.destCoords.lat, ctx.destCoords.lng),
    };
  }

  summarize(res: IntercityTransitResult): TransitModeSummary {
    const durHours = Math.max(1, Math.round(res.durationMinutes / 60));
    return {
      mode: this.mode,
      title: 'Tàu hỏa (Đường sắt)',
      durationText: res.isMultiModal ? `Tàu + Xe (~${durHours}h)` : `Đường sắt (~${durHours}h)`,
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
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;

    const speed = PRICING_CONFIG.INTERCITY.AVG_SPEED_KMH;
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const C = PRICING_CONFIG.INTERCITY.CARRIERS;
    const D = PRICING_CONFIG.DEFAULTS;
    const { originTrain, destTrain } = await this.resolveStations(ctx);

    const originTrainName = originTrain?.name || `Ga ${originCity}`;
    const ferryPortName = ctx.nearestFerryHub?.name || D.FERRY_PORT_NAME;

    let destTrainName = '';
    let isMultiModal = false;
    let transferLeg: TransitTransferLeg | undefined;
    let trainPriceOneWay = 0;
    let trainDurationMinutes = 0;
    let routeSteps: string[] = [];

    const hasDirectStation =
      !isIsland && isDirectCityHub(destTrain, destCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM);

    if (isIsland) {
      // 1. Island destination: No railway crosses open sea directly
      isMultiModal = true;
      const gatewayStationName = destTrain?.name || originTrainName;
      destTrainName = `${gatewayStationName} (Điểm dừng đường sắt)`;

      const trainDist = Math.max(
        T.MIN_TRAIN_DISTANCE_KM,
        Math.round(roadDistanceKm * T.TRAIN_ISLAND_LAND_RATIO),
      );
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      const transferKm = Math.max(
        T.ISLAND_PORT_DISTANCE_KM,
        destTrain?.distanceKm || Math.round(roadDistanceKm - trainDist),
      );
      const transferDur = T.FERRY_MINUTES + T.ISLAND_MAINLAND_BUS_MINUTES;
      const transferPrice = T.FERRY_ONE_WAY_PASSENGER + T.ISLAND_MAINLAND_BUS_FARE;

      transferLeg = {
        type: 'FERRY',
        title: `Nối chặng: Xe trung chuyển ra ${ferryPortName} & Tàu cao tốc sang đảo`,
        fromName: gatewayStationName,
        toName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferDur,
        estimatedPrice: transferPrice,
        description: `Tàu hỏa dừng tại ${gatewayStationName}. Nối chặng xe khách đến ${ferryPortName} và đi tàu cao tốc sang ${destCity}.`,
      };

      trainDurationMinutes = trainDur + transferDur;
      trainPriceOneWay = trainFare + transferPrice;

      routeSteps = [
        `Chặng 1 (Đường sắt): ${originTrainName} ──> ${gatewayStationName} (~${formatDurationVi(trainDur)}, ~${formatVndCurrency(trainFare)}/vé)`,
        `Chặng 2 (Xe trung chuyển & Tàu cao tốc): Từ ${gatewayStationName} đi xe trung chuyển ra ${ferryPortName} và đón tàu cao tốc sang đảo ${destCity} (~${formatDurationVi(transferDur)}, ~${formatVndCurrency(transferPrice)})`,
        `Lưu ý: ${destCity} là đảo biệt lập không có mạng lưới đường sắt. Để tiết kiệm thời gian, bạn nên ưu tiên chọn Máy bay.`,
      ];
    } else if (destTrain && !hasDirectStation) {
      // 2. Mainland destination far from railway (e.g. Đà Lạt via Ga Tháp Chàm, Sa Pa via Ga Lào Cai, Quy Nhơn via Ga Diêu Trì)
      isMultiModal = true;
      destTrainName = destTrain.name;
      const transferDist = destTrain.distanceKm || T.DEFAULT_RAIL_TRANSFER_KM;
      const trainDist = Math.max(T.MIN_TRAIN_DISTANCE_KM, Math.round(roadDistanceKm - transferDist));
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      const transferDur = Math.round(transferDist * T.REGIONAL_TRANSFER_MINS_PER_KM);
      const transferPrice = Math.round(transferDist * T.BUS_PER_KM);

      transferLeg = {
        type: 'BUS',
        title: `Xe trung chuyển kết nối từ ${destTrain.name} về ${destCity}`,
        fromName: destTrain.name,
        toName: destCity,
        distanceKm: transferDist,
        durationMinutes: transferDur,
        estimatedPrice: transferPrice,
        description: `Xe trung chuyển / xe khách đón tại ${destTrain.name} kết nối về trung tâm ${destCity}`,
      };

      trainDurationMinutes = trainDur + transferDur;
      trainPriceOneWay = trainFare + transferPrice;

      routeSteps = [
        `Chặng 1 (Đường sắt): ${originTrainName} ──> ${destTrain.name} (~${formatDurationVi(trainDur)}, ~${formatVndCurrency(trainFare)}/vé)`,
        `Chặng 2 (Xe trung chuyển kết nối): Đón tại ${destTrain.name} về trung tâm ${destCity} (~${transferDist}km, ~${formatDurationVi(transferDur, true)}, ~${formatVndCurrency(transferPrice)})`,
      ];
    } else {
      // 3. Direct / Satellite Train Station exists (Đà Nẵng, Nha Trang, Huế, Hà Nội, Vinh, Hội An via Ga Đà Nẵng...)
      isMultiModal = false;
      destTrainName = destTrain?.name || `Ga ${destCity}`;
      trainDurationMinutes = Math.round((roadDistanceKm / speed.TRAIN) * 60);
      trainPriceOneWay = Math.round(roadDistanceKm * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      const { transferKm, transferMinutes } = computeLocalTransfer(
        destTrain?.distanceKm,
        T.MIN_LOCAL_TRANSFER_KM,
      );

      routeSteps = [
        `Tuyến đường sắt chính: ${originTrainName} ──> ${destTrainName} (~${formatDurationVi(trainDurationMinutes)}, ~${formatVndCurrency(trainPriceOneWay)}/vé)`,
        `Trung chuyển về khách sạn: Đón Taxi / Grab từ ${destTrainName} về trung tâm ${destCity} (~${transferKm}km, ~${transferMinutes} phút)`,
      ];
    }

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.TRAIN, roadDistanceKm);

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
      originHub: isDirectCityHub(originTrain, originCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM)
        ? originTrain || undefined
        : undefined,
      destHub: destTrain || undefined,
      isIsland,
      isMultiModal,
      transferLeg,
      details: {
        carriers: C.TRAIN,
        notes: isMultiModal
          ? `Lộ trình nối chặng: Tàu hỏa dừng tại ${destTrainName}, sau đó đi xe trung chuyển/tàu cao tốc đến ${destCity}.`
          : `Tàu dừng tại ${destTrainName}; nên chọn khoang 4 giường nằm điều hòa hoặc ghế mềm ngắm cảnh an toàn.`,
        routeSteps,
      },
    };
  }
}


