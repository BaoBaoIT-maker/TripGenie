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

@Injectable()
export class TrainTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.TRAIN;

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

  private async findNearestStation(lat: number, lng: number): Promise<TransitHubDto | null> {
    const hubs = await this.prisma.transitHub.findMany({
      where: { isActive: true, hubType: 'TRAIN_STATION' },
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
    const originTrain = await this.findNearestStation(originCoords.lat, originCoords.lng);
    const destTrain = await this.findNearestStation(destCoords.lat, destCoords.lng);

    const originTrainName =
      originTrain?.name ||
      (originCity.toLowerCase().includes('hồ chí minh') || originCity.toLowerCase().includes('sài gòn')
        ? 'Ga Sài Gòn'
        : `Ga ${originCity}`);

    let destTrainName = '';
    let isMultiModal = false;
    let transferLeg: TransitTransferLeg | undefined;
    let trainPriceOneWay = 0;
    let trainDurationMinutes = 0;
    let routeSteps: string[] = [];

    if (isIsland) {
      // 1. Island destination (Phú Quốc, Côn Đảo...): No railway can cross open sea directly
      isMultiModal = true;
      const gatewayStationName = originCity.toLowerCase().includes('hồ chí minh')
        ? 'Ga Sài Gòn'
        : (destTrain?.name || 'Ga Sài Gòn');
      destTrainName = `${gatewayStationName} (Điểm dừng đường sắt)`;

      const trainDist = Math.max(120, Math.round(roadDistanceKm * 0.65));
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      const transferDur = PRICING_CONFIG.INTERCITY.TRANSFER.FERRY_MINUTES + 240; // 4h bus + 2h20m speedboat
      const transferPrice = PRICING_CONFIG.INTERCITY.TRANSFER.FERRY_ONE_WAY_PASSENGER + 180_000;

      transferLeg = {
        type: 'FERRY',
        title: 'Nối chặng: Xe khách ra bến cảng & Tàu cao tốc sang đảo',
        fromName: gatewayStationName,
        toName: destCity,
        distanceKm: 320,
        durationMinutes: transferDur,
        estimatedPrice: transferPrice,
        description: `Tàu hỏa kết thúc tại ${gatewayStationName}. Nối chặng: Xe khách đến Cảng Rạch Giá/Hà Tiên và đi tàu cao tốc sang ${destCity}.`,
      };

      trainDurationMinutes = trainDur + transferDur;
      trainPriceOneWay = trainFare + transferPrice;

      routeSteps = [
        `Chặng 1 (Đường sắt Bắc - Nam): ${originTrainName} ──> ${gatewayStationName} (~${Math.round(trainDur / 60)} tiếng, ~${trainFare.toLocaleString()}đ/vé)`,
        `Chặng 2 (Xe trung chuyển & Tàu cao tốc): Từ ${gatewayStationName} đi xe khách ra cảng Rạch Giá/Hà Tiên và đón tàu cao tốc sang đảo ${destCity} (~${Math.round(transferDur / 60)} tiếng, ~${transferPrice.toLocaleString()}đ)`,
        `Lưu ý: ${destCity} là đảo biệt lập không có mạng lưới đường sắt. Để tiết kiệm thời gian, bạn nên ưu tiên chọn Máy bay bay thẳng tới Sân bay Phú Quốc (PQC).`,
      ];
    } else if (destTrain && (destTrain.distanceKm ?? 999) > 35) {
      // 2. Mainland destination far from railway (e.g. Đà Lạt via Ga Tháp Chàm, Sa Pa via Ga Lào Cai, Quy Nhơn via Ga Diêu Trì)
      isMultiModal = true;
      destTrainName = destTrain.name;
      const transferDist = destTrain.distanceKm || 80;
      const trainDist = Math.max(100, Math.round(roadDistanceKm - transferDist));
      const trainDur = Math.round((trainDist / speed.TRAIN) * 60);
      const trainFare = Math.round(trainDist * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      const transferDur = Math.round(transferDist * 1.4);
      const transferPrice = Math.round(transferDist * PRICING_CONFIG.INTERCITY.TRANSFER.BUS_PER_KM);

      transferLeg = {
        type: 'BUS',
        title: 'Xe trung chuyển kết nối từ Ga về trung tâm',
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
        `Chặng 1 (Đường sắt Bắc - Nam): ${originTrainName} ──> ${destTrain.name} (~${Math.round(trainDur / 60)} tiếng, ~${trainFare.toLocaleString()}đ/vé)`,
        `Chặng 2 (Xe trung chuyển kết nối): Đón tại ${destTrain.name} về trung tâm ${destCity} (~${transferDist}km, ~${Math.round(transferDur / 60)}h${transferDur % 60 ? transferDur % 60 + 'p' : ''}, ~${transferPrice.toLocaleString()}đ)`,
      ];
    } else {
      // 3. Direct Train Station exists (Đà Nẵng, Nha Trang, Huế, Hà Nội, Vinh, Tuy Hòa...)
      isMultiModal = false;
      destTrainName = destTrain?.name || `Ga ${destCity}`;
      trainDurationMinutes = Math.round((roadDistanceKm / speed.TRAIN) * 60);
      trainPriceOneWay = Math.round(roadDistanceKm * PRICING_CONFIG.INTERCITY.TRAIN_PER_KM);

      routeSteps = [
        `Tuyến đường sắt: ${originTrainName} ──> ${destTrainName} (~${Math.round(trainDurationMinutes / 60)} tiếng, ~${trainPriceOneWay.toLocaleString()}đ/vé)`,
        `Lựa chọn khoang 4 giường nằm điều hòa hoặc ghế mềm ngắm cảnh an toàn và thư thái`,
      ];
    }

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.TRAIN, roadDistanceKm);

    return {
      mode: 'TRAIN',
      originName: originTrainName,
      destName: destTrainName,
      distanceKm: roadDistanceKm,
      durationMinutes: trainDurationMinutes,
      estimatedPriceOneWay: trainPriceOneWay,
      estimatedPriceRoundTrip: trainPriceOneWay * 2,
      deepLinks: {
        vexereTrain: 'https://vexere.com/vi-VN/ve-tau-hoa',
        dsvn: 'https://dsvn.vn',
      },
      safetyAdvisory,
      originHub: originTrain && (originTrain.distanceKm ?? 999) <= 50 ? originTrain : undefined,
      destHub: destTrain && (destTrain.distanceKm ?? 999) <= 35 ? destTrain : undefined,
      isIsland,
      isMultiModal,
      transferLeg,
      details: {
        carriers: 'Đường sắt Việt Nam (Tàu SE / Thống Nhất)',
        notes: isMultiModal
          ? `Lộ trình nối chặng: Tàu hỏa dừng tại ${destTrainName}, sau đó đi xe trung chuyển/tàu cao tốc đến ${destCity}.`
          : 'Khoang giường nằm 4 hoặc ghế mềm điều hòa ngắm cảnh an toàn.',
        routeSteps,
      },
    };
  }
}
