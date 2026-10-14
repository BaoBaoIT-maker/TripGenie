import { Injectable } from '@nestjs/common';
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
  formatDurationVi,
  formatVndCurrency,
} from '../transit.types';

@Injectable()
export class RoadTransitStrategy implements ITransitStrategy {
  constructor(
    public readonly mode: TransitModeEnum.PERSONAL_MOTORBIKE | TransitModeEnum.PERSONAL_CAR,
  ) {}

  summarize(res: IntercityTransitResult, roadDistanceKm: number): TransitModeSummary | null {
    if (this.mode !== TransitModeEnum.PERSONAL_MOTORBIKE) return null;
    const durHours = Math.max(1, Math.round(res.durationMinutes / 60));
    return {
      mode: this.mode,
      title: 'Phượt xe máy',
      durationText: `Phượt xe máy (~${durHours}h)`,
      priceText: `~${formatVndCurrency(res.estimatedPriceOneWay)} xăng`,
      estimatedPriceOneWay: res.estimatedPriceOneWay,
      durationMinutes: res.durationMinutes,
      isMultiModal: Boolean(res.isMultiModal),
      warning:
        roadDistanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
          ? 'Chú ý cự ly xa'
          : undefined,
    };
  }

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
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const ferryPortName = ctx.nearestFerryHub?.name || PRICING_CONFIG.DEFAULTS.FERRY_PORT_NAME;

    if (isMotorbike) {
      const fuelLiters = Number(
        ((roadDistanceKm / 100) * PRICING_CONFIG.FUEL.MOTORBIKE_CONSUMPTION_PER_100KM).toFixed(1),
      );
      const baseFuelCost = Math.round(fuelLiters * gasPrice);
      const baseDriveMinutes = Math.round((roadDistanceKm / speed.PERSONAL_MOTORBIKE) * 60);
      let fuelCost = baseFuelCost;
      let durationMinutes = baseDriveMinutes;
      let transferLeg: TransitTransferLeg | undefined;
      let routeSteps: string[] = [];

      if (isIsland) {
        const ferryFare = T.FERRY_ONE_WAY_MOTORBIKE;
        const ferryDur = T.MOTORBIKE_FERRY_MINUTES;
        transferLeg = {
          type: 'FERRY',
          title: `Phà biển chở xe máy từ ${ferryPortName} sang đảo ${destCity}`,
          fromName: ferryPortName,
          toName: destCity,
          distanceKm: T.ISLAND_PORT_DISTANCE_KM,
          durationMinutes: ferryDur,
          estimatedPrice: ferryFare,
          description: `Phà cao tốc chở xe máy và hành khách từ ${ferryPortName} sang đảo ${destCity}`,
        };
        fuelCost += ferryFare;
        durationMinutes += ferryDur;
        routeSteps = [
          `Chặng 1 (Phượt xe máy): Từ ${originCity} ──> ${ferryPortName} (~${roadDistanceKm}km, ~${formatDurationVi(baseDriveMinutes)} lái xe)`,
          `Chặng 2 (Phà biển chở xe máy): ${ferryPortName} ──> Đảo ${destCity} (~${formatDurationVi(ferryDur)} vượt biển, ~${formatVndCurrency(ferryFare)} tiền vé người + xe)`,
        ];
      } else {
        routeSteps =
          roadDistanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
            ? [
                `Quãng đường ~${roadDistanceKm}km đi xe máy mất hơn ${formatDurationVi(baseDriveMinutes)} liên tục, vượt ngưỡng an toàn (>${PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM}km).`,
                `Khuyến nghị: Bạn nên chuyển sang Xe khách giường nằm hoặc Máy bay để giữ sức khỏe cho chuyến đi!`,
              ]
            : [
                `Cung đường phượt xe máy từ ${originCity} ──> ${destCity} (~${roadDistanceKm}km, khoảng ~${formatDurationVi(baseDriveMinutes)})`,
                `Chi phí tiền xăng xe ước tính: ~${formatVndCurrency(fuelCost)} (khoảng ${fuelLiters} lít xăng RON95)`,
              ];
      }

      const safetyAdvisory = checkTransitSafety(TransitModeEnum.PERSONAL_MOTORBIKE, roadDistanceKm);

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
            roadDistanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
              ? `Cực kỳ nguy hiểm khi đi xe máy liên tục >${PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM}km. Nên đổi sang xe khách hoặc máy bay.`
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

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.PERSONAL_CAR, roadDistanceKm);

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
        notes: `Bao gồm: ~${formatVndCurrency(fuelCost)} tiền xăng (${fuelLiters}L) + ~${formatVndCurrency(highwayToll)} phí BOT cao tốc.`,
        routeSteps: [
          `Lộ trình cao tốc / quốc lộ từ ${originCity} ──> trung tâm ${destCity} (~${roadDistanceKm}km, ~${formatDurationVi(durationMinutes)} lái xe)`,
          `Dự toán nhiên liệu & cầu đường 1 chiều: ~${formatVndCurrency(fuelCost)} xăng + ~${formatVndCurrency(highwayToll)} trạm thu phí BOT`,
        ],
      },
    };
  }
}

