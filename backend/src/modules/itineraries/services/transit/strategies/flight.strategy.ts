import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { PRICING_CONFIG, checkTransitSafety } from '../../../../../config/pricing.config';
import { TransitModeEnum } from '../../../dto/generate-itinerary.dto';
import {
  ITransitStrategy,
  TransitStrategyContext,
  IntercityTransitResult,
  TransitHubDto,
} from '../transit.types';

@Injectable()
export class FlightTransitStrategy implements ITransitStrategy {
  readonly mode = TransitModeEnum.FLIGHT;

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

  private async findNearestAirport(lat: number, lng: number): Promise<TransitHubDto | null> {
    const hubs = await this.prisma.transitHub.findMany({
      where: { isActive: true, hubType: 'AIRPORT' },
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
      departDate,
      returnDate,
      originCoords,
      destCoords,
      roadDistanceKm,
      isIsland,
    } = ctx;

    const originAirport = await this.findNearestAirport(originCoords.lat, originCoords.lng);
    const destAirport = await this.findNearestAirport(destCoords.lat, destCoords.lng);

    const originCode = originAirport?.id || 'SGN';
    const destCode = destAirport?.id || (isIsland ? 'PQC' : 'DAD');

    // Google Flights deeplink per user requirement
    const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${destCode}%20from%20${originCode}%20on%20${departDate}${returnDate ? `%20through%20${returnDate}` : ''}`;

    const F = PRICING_CONFIG.INTERCITY.FLIGHT;
    const isLong = roadDistanceKm > F.LONG_HAUL_KM;
    const flightDurationMinutes = isLong ? F.MINUTES_LONG : F.MINUTES_SHORT;
    const baseFlightOneWay = isLong ? F.ONE_WAY_LONG : F.ONE_WAY_SHORT;

    const transferKm = destAirport?.distanceKm || (isIsland ? 12 : 30);
    const transferMinutes = Math.max(20, Math.round(transferKm * 1.3));

    const routeSteps = [
      `Khởi hành từ ${originAirport?.name || originCity} ──> ${destAirport?.name || destCity} (~${Math.floor(flightDurationMinutes / 60)}h${flightDurationMinutes % 60 ? flightDurationMinutes % 60 + 'p' : ''}, ~${baseFlightOneWay.toLocaleString()}đ)`,
      `Xe trung chuyển/Taxi từ ${destAirport?.name || 'sân bay'} về trung tâm ${destCity} (~${transferKm}km, ~${transferMinutes} phút)`,
    ];

    const safetyAdvisory = checkTransitSafety(TransitModeEnum.FLIGHT, roadDistanceKm);

    return {
      mode: 'FLIGHT',
      originName: originAirport?.name || `${originCity} (${originCode})`,
      destName: destAirport?.name || `${destCity} (${destCode})`,
      distanceKm: roadDistanceKm,
      durationMinutes: flightDurationMinutes,
      estimatedPriceOneWay: baseFlightOneWay,
      estimatedPriceRoundTrip: baseFlightOneWay * 2,
      deepLinks: {
        googleFlights: googleFlightsUrl,
      },
      safetyAdvisory,
      originHub: originAirport || undefined,
      destHub: destAirport || undefined,
      isIsland,
      isMultiModal: false,
      details: {
        carriers: 'Vietnam Airlines, Vietjet Air, Bamboo Airways',
        notes: 'Sau khi hạ cánh, xe trung chuyển đón tận cửa ga về thẳng khách sạn.',
        routeSteps,
      },
    };
  }
}
