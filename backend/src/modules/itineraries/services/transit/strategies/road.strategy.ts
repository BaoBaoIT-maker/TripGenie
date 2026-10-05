import { Injectable } from '@nestjs/common';
import { PRICING_CONFIG, checkTransitSafety } from '../../../../../config/pricing.config';
import { TransitModeEnum } from '../../../dto/generate-itinerary.dto';
import {
  ITransitStrategy,
  TransitStrategyContext,
  IntercityTransitResult,
  TransitTransferLeg,
} from '../transit.types';

@Injectable()
export class RoadTransitStrategy implements ITransitStrategy {
  constructor(public readonly mode: TransitModeEnum.PERSONAL_MOTORBIKE | TransitModeEnum.PERSONAL_CAR) {}

  async calculate(ctx: TransitStrategyContext): Promise<IntercityTransitResult> {
    const {
      originCity,
      destCity,
      roadDistanceKm,
      isIsland,
    } = ctx;

    const isMotorbike = this.mode === TransitModeEnum.PERSONAL_MOTORBIKE;
    const speed = PRICING_CONFIG.INTERCITY.AVG_SPEED_KMH;
    const gasPrice = PRICING_CONFIG.FUEL.GAS_PRICE_PER_LITER;

    if (isMotorbike) {
      const fuelLiters = Number(
        ((roadDistanceKm / 100) * PRICING_CONFIG.FUEL.MOTORBIKE_CONSUMPTION_PER_100KM).toFixed(1),
      );
      let fuelCost = Math.round(fuelLiters * gasPrice);
      let durationMinutes = Math.round((roadDistanceKm / speed.PERSONAL_MOTORBIKE) * 60);
      const durationHours = Math.round(durationMinutes / 60);
      let transferLeg: TransitTransferLeg | undefined;
      let routeSteps: string[] = [];

      if (isIsland) {
        const ferryFare = PRICING_CONFIG.INTERCITY.TRANSFER.FERRY_ONE_WAY_MOTORBIKE;
        const ferryDur = 180; // ~3h crossing with motorbike
        transferLeg = {
          type: 'FERRY',
          title: 'Phà biển Thạnh Thới chở xe máy sang đảo',
          fromName: 'Bến phà Hà Tiên / Rạch Giá',
          toName: destCity,
          distanceKm: 45,
          durationMinutes: ferryDur,
          estimatedPrice: ferryFare,
          description: `Phà cao tốc Thạnh Thới chở xe máy và hành khách từ đất liền sang đảo ${destCity}`,
        };
        fuelCost += ferryFare;
        durationMinutes += ferryDur;
        routeSteps = [
          `Chặng 1 (Phượt xe máy): Từ ${originCity} ──> Bến phà Hà Tiên (~${roadDistanceKm}km, ~${durationHours} tiếng lái xe)`,
          `Chặng 2 (Phà biển chở xe máy): Bến phà ──> Đảo ${destCity} (~3 tiếng vượt biển, ~${ferryFare.toLocaleString()}đ tiền vé người + xe)`,
        ];
      } else {
        routeSteps =
          roadDistanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
            ? [
                `Quãng đường ~${roadDistanceKm}km đi xe máy mất hơn ${durationHours} tiếng liên tục, vượt ngưỡng an toàn (>350km).`,
                `Khuyến nghị: Bạn nên chuyển sang Xe khách giường nằm hoặc Máy bay để giữ sức khỏe cho chuyến đi!`,
              ]
            : [
                `Cung đường phượt xe máy từ ${originCity} ──> ${destCity} (~${roadDistanceKm}km, khoảng ~${durationHours} tiếng)`,
                `Chi phí tiền xăng xe ước tính: ~${fuelCost.toLocaleString()}đ (khoảng ${fuelLiters} lít xăng RON95)`,
              ];
      }

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCity)}&destination=${encodeURIComponent(destCity)}&travelmode=two-wheeler`;
      const safetyAdvisory = checkTransitSafety(TransitModeEnum.PERSONAL_MOTORBIKE, roadDistanceKm);

      return {
        mode: 'PERSONAL_MOTORBIKE',
        originName: originCity,
        destName: destCity,
        distanceKm: roadDistanceKm,
        durationMinutes,
        estimatedPriceOneWay: fuelCost,
        estimatedPriceRoundTrip: fuelCost * 2,
        deepLinks: {
          googleMaps: googleMapsUrl,
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
            roadDistanceKm > 350
              ? 'Cực kỳ nguy hiểm khi đi xe máy liên tục >350km. Nên đổi sang xe khách hoặc máy bay.'
              : 'Nên xuất phát sáng sớm (5:00 - 5:30), kiểm tra lốp, phanh xe và nghỉ chân mỗi 2 tiếng.',
          routeSteps,
        },
      };
    }

    // PERSONAL_CAR
    const fuelLiters = Number(
      ((roadDistanceKm / 100) * PRICING_CONFIG.FUEL.CAR_CONSUMPTION_PER_100KM).toFixed(1),
    );
    const fuelCost = Math.round(fuelLiters * gasPrice);
    const highwayToll = Math.round(
      roadDistanceKm *
        PRICING_CONFIG.INTERCITY.HIGHWAY_SHARE *
        PRICING_CONFIG.FUEL.HIGHWAY_TOLL_PER_KM,
    );
    const totalOneWay = fuelCost + highwayToll;
    const durationMinutes = Math.round((roadDistanceKm / speed.PERSONAL_CAR) * 60);

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCity)}&destination=${encodeURIComponent(destCity)}&travelmode=driving`;
    const safetyAdvisory = checkTransitSafety(TransitModeEnum.PERSONAL_CAR, roadDistanceKm);

    return {
      mode: 'PERSONAL_CAR',
      originName: originCity,
      destName: destCity,
      distanceKm: roadDistanceKm,
      durationMinutes,
      estimatedPriceOneWay: totalOneWay,
      estimatedPriceRoundTrip: totalOneWay * 2,
      deepLinks: {
        googleMaps: googleMapsUrl,
      },
      safetyAdvisory,
      details: {
        fuelCost,
        fuelLiters,
        gasPricePerLiter: gasPrice,
        highwayToll,
        notes: `Bao gồm: ~${fuelCost.toLocaleString()}đ tiền xăng + ~${highwayToll.toLocaleString()}đ phí BOT cao tốc.`,
      },
    };
  }
}
