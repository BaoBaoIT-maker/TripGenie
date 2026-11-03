import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
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
  formatDurationVi,
  formatVndCurrency,
  isDirectCityHub,
} from '../transit.types';

@Injectable()
export class FlightTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.FLIGHT;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveAirports(
    ctx: TransitStrategyContext,
  ): Promise<{ originAirport: TransitHubDto | null; destAirport: TransitHubDto | null }> {
    const hubs =
      ctx.activeHubs ??
      (await this.prisma.transitHub.findMany({
        where: { isActive: true, hubType: 'AIRPORT' },
      }));
    return {
      originAirport: findNearestHub(hubs, 'AIRPORT', ctx.originCoords.lat, ctx.originCoords.lng),
      destAirport: findNearestHub(hubs, 'AIRPORT', ctx.destCoords.lat, ctx.destCoords.lng),
    };
  }

  summarize(res: IntercityTransitResult): TransitModeSummary {
    const durLabel = formatDurationVi(res.durationMinutes, true);
    return {
      mode: this.mode,
      title: 'Máy bay',
      durationText: res.isMultiModal ? `Nối chặng (~${durLabel})` : `Nhanh nhất (~${durLabel})`,
      priceText: `Từ ~${formatVndCurrency(res.estimatedPriceOneWay)}`,
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
      returnDate,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;

    const { originAirport, destAirport } = await this.resolveAirports(ctx);
    const F = PRICING_CONFIG.INTERCITY.FLIGHT;
    const T = PRICING_CONFIG.INTERCITY.TRANSFER;
    const C = PRICING_CONFIG.INTERCITY.CARRIERS;
    const D = PRICING_CONFIG.DEFAULTS;

    const originCode = originAirport?.id || D.ORIGIN_AIRPORT_CODE;
    const destCode = destAirport?.id || (isIsland ? D.ISLAND_AIRPORT_CODE : D.MAINLAND_AIRPORT_CODE);
    const originAirportName = originAirport?.name || `Sân bay tại ${originCity}`;
    const destAirportName = destAirport?.name || `Sân bay đi ${destCity}`;

    const googleFlightsUrl = buildGoogleFlightsUrl({
      originCode,
      destCode,
      departDate,
      returnDate,
    });
    const safetyAdvisory = checkTransitSafety(TransitModeEnum.FLIGHT, roadDistanceKm);

    // Case 4: Origin and destination share the exact same gateway airport OR distance is too short (<150km) for commercial flights
    const isSameAirport = Boolean(originAirport && destAirport && originAirport.id === destAirport.id);
    const isTooShort = roadDistanceKm < T.MIN_FLIGHT_DISTANCE_KM;

    if (isSameAirport || isTooShort) {
      const transferKm = Math.max(T.MIN_LOCAL_TRANSFER_KM, roadDistanceKm);
      const transferMinutes = Math.max(
        T.MIN_LOCAL_TRANSFER_MINUTES,
        Math.round(transferKm * T.REGIONAL_TRANSFER_MINS_PER_KM),
      );
      const transferPrice = Math.round(transferKm * PRICING_CONFIG.INTERCITY.LIMOUSINE_BUS_PER_KM);

      const gatewayNotice = isSameAirport
        ? `${originCity} và ${destCity} cùng thuộc phạm vi cửa ngõ hàng không ${destAirportName} (~${transferKm}km), không khai thác chuyến bay thương mại giữa hai điểm này.`
        : `Cự ly giữa ${originCity} và ${destCity} quá ngắn (~${transferKm}km, dưới ngưỡng bay tối thiểu ${T.MIN_FLIGHT_DISTANCE_KM}km), không khai thác chuyến bay thương mại trực tiếp.`;

      const routeAdvise = isSameAirport
        ? `Tuyến ${originCity} ──> ${destCity} (~${transferKm}km) dùng chung cửa ngõ ${destAirportName} nên di chuyển thẳng bằng Xe Limousine/Ô tô nhanh và tiết kiệm hơn.`
        : `Tuyến ${originCity} ──> ${destCity} (~${transferKm}km) di chuyển thẳng bằng Xe Limousine / Ô tô qua cao tốc nhanh hơn (tiết kiệm thời gian làm thủ tục sân bay).`;

      const transferLeg: TransitTransferLeg = {
        type: 'BUS',
        title: `Xe Limousine / Trung chuyển thẳng ${originCity} ──> ${destCity}`,
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
            `Lưu ý cửa ngõ hàng không: ${gatewayNotice}`,
            `Lộ trình trung chuyển tối ưu: Đón Xe Limousine / Taxi đường dài trực tiếp từ ${originCity} ──> trung tâm ${destCity} (~${transferKm}km, ~${formatDurationVi(transferMinutes)}, ~${formatVndCurrency(transferPrice)}/chiều).`,
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
    const flightDurationLabel = formatDurationVi(baseFlightDuration, true);

    const hasIslandDirectAirport =
      isIsland && isDirectCityHub(destAirport, destCoords.areaId, T.ISLAND_DIRECT_HUB_MAX_KM);
    const hasMainlandDirectAirport =
      !isIsland && isDirectCityHub(destAirport, destCoords.areaId, T.LOCAL_HUB_MAX_DISTANCE_KM);

    // Case 3: Island destination WITHOUT its own airport (e.g. Lý Sơn via Chu Lai VCL, Phú Quý, Cát Bà, Cô Tô)
    if (isIsland && !hasIslandDirectAirport) {
      const ferryPortName = ctx.nearestFerryHub?.name || D.FERRY_PORT_NAME;
      const landTransferKm = Math.max(
        T.DEFAULT_AIRPORT_TRANSFER_KM,
        destAirport?.distanceKm || T.ISLAND_PORT_DISTANCE_KM,
      );
      const landTransferMinutes = Math.round(landTransferKm * T.REGIONAL_TRANSFER_MINS_PER_KM);
      const totalTransferMinutes = landTransferMinutes + T.FERRY_MINUTES;
      const totalTransferPrice =
        Math.round(landTransferKm * T.BUS_PER_KM) + T.FERRY_ONE_WAY_PASSENGER;

      const transferLeg: TransitTransferLeg = {
        type: 'FERRY',
        title: `Xe trung chuyển ra ${ferryPortName} & Tàu cao tốc sang đảo ${destCity}`,
        fromName: destAirportName,
        toName: destCity,
        distanceKm: landTransferKm + T.ISLAND_PORT_DISTANCE_KM,
        durationMinutes: totalTransferMinutes,
        estimatedPrice: totalTransferPrice,
        description: `Hạ cánh tại ${destAirportName}, đi xe trung chuyển ra ${ferryPortName} và đón tàu cao tốc vượt biển sang đảo ${destCity}.`,
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
          notes: `Đảo ${destCity} chưa có sân bay thương mại trực tiếp. Lộ trình tối ưu là bay tới ${destAirportName} rồi nối chuyến tàu cao tốc tại ${ferryPortName} ra đảo.`,
          routeSteps: [
            `Chặng 1 (Hàng không): Bay từ ${originAirportName} ──> ${destAirportName} (~${airDistanceKm}km đường bay, ~${flightDurationLabel}, ~${formatVndCurrency(baseFlightOneWay)}/vé)`,
            `Chặng 2 (Trung chuyển & Tàu cao tốc): Xe đón từ ${destAirportName} ra ${ferryPortName} (~${landTransferKm}km) và đi tàu cao tốc sang đảo ${destCity} (~${formatDurationVi(totalTransferMinutes, true)}, ~${formatVndCurrency(totalTransferPrice)})`,
          ],
        },
      };
    }

    // Case 2: Mainland destination far from nearest airport (e.g. Sa Pa, Hà Giang, Ninh Bình, Măng Đen, Phan Thiết)
    if (!isIsland && !hasMainlandDirectAirport) {
      const transferKm = destAirport?.distanceKm || T.LOCAL_HUB_MAX_DISTANCE_KM;
      const transferMinutes = Math.round(transferKm * T.REGIONAL_TRANSFER_MINS_PER_KM);
      const transferPrice = Math.round(transferKm * T.BUS_PER_KM);

      const transferLeg: TransitTransferLeg = {
        type: 'BUS',
        title: `Xe Limousine / Trung chuyển từ ${destAirportName} về ${destCity}`,
        fromName: destAirportName,
        toName: destCity,
        distanceKm: transferKm,
        durationMinutes: transferMinutes,
        estimatedPrice: transferPrice,
        description: `Xe Limousine / xe trung chuyển kết nối từ cửa ga ${destAirportName} đi thẳng về trung tâm ${destCity}.`,
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
          notes: `${destCity} chưa có sân bay riêng; sau khi đáp tại ${destAirportName}, xe Limousine trung chuyển sẽ đón tại sảnh ga đi thẳng về ${destCity}.`,
          routeSteps: [
            `Chặng 1 (Hàng không): Bay từ ${originAirportName} ──> ${destAirportName} (~${airDistanceKm}km đường bay, ~${flightDurationLabel}, ~${formatVndCurrency(baseFlightOneWay)}/vé)`,
            `Chặng 2 (Xe trung chuyển liên tỉnh): Đón xe Limousine/Shuttle từ ${destAirportName} về trung tâm ${destCity} (~${transferKm}km, ~${formatDurationVi(transferMinutes)}, ~${formatVndCurrency(transferPrice)})`,
          ],
        },
      };
    }

    // Case 1: Direct / Satellite Airport (e.g. Đà Nẵng, Phú Quốc, Đà Lạt, Nha Trang, Hội An via DAD)
    const { transferKm, transferMinutes } = computeLocalTransfer(destAirport?.distanceKm);

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
      destHub: destAirport ? { ...destAirport, distanceKm: transferKm } : undefined,
      isIsland,
      isMultiModal: false,
      details: {
        carriers: C.FLIGHT_DIRECT,
        notes: `Sau khi hạ cánh tại ${destAirportName}, bạn có thể bắt xe buýt sân bay, Grab hoặc Taxi (~${transferKm}km, ~${transferMinutes} phút) về thẳng khách sạn tại ${destCity}.`,
        routeSteps: [
          `Chặng bay chính: Khởi hành từ ${originAirportName} ──> ${destAirportName} (~${airDistanceKm}km đường bay, ~${flightDurationLabel}, ~${formatVndCurrency(baseFlightOneWay)}/vé)`,
          `Trung chuyển sân bay về trung tâm: Xe trung chuyển / Taxi từ ${destAirportName} về trung tâm ${destCity} (~${transferKm}km, ~${transferMinutes} phút)`,
        ],
      },
    };
  }
}


