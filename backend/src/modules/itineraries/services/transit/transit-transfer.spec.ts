import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  PRICING_CONFIG,
  buildGoogleFlightsUrl,
  buildGoogleMapsDirUrl,
  buildVexereBusUrl,
  calculateFlightDuration,
  calculateFlightFare,
} from '../../../../config/pricing.config';
import { INJECT_TOKENS } from '../../../../common/constants/inject-tokens';
import { OptionalJwtAuthGuard } from '../../../../common/guards/optional-jwt-auth.guard';
import { PrismaService } from '../../../../database/prisma.service';
import { TransitModeEnum } from '../../dto/generate-itinerary.dto';
import { ItinerariesController } from '../../itineraries.controller';
import { ItineraryPlannerService } from '../itinerary-planner.service';
import { GeminiPlannerService } from '../gemini-planner.service';
import { CopilotAgentService } from '../../copilot/copilot-agent.service';
import { CopilotToolsService } from '../../copilot/copilot-tools.service';
import {
  TransitService,
  TransitHubDto,
  computeHaversineDistance,
  computeLocalTransfer,
  findNearestHub,
  isDirectCityHub,
} from '../transit.service';
import { FlightTransitStrategy } from './strategies/flight.strategy';
import { TrainTransitStrategy } from './strategies/train.strategy';
import { BusTransitStrategy } from './strategies/bus.strategy';
import { RoadTransitStrategy } from './strategies/road.strategy';

const MOCK_HUBS: TransitHubDto[] = [
  // Airports
  {
    id: 'SGN',
    name: 'Sân bay Quốc tế Tân Sơn Nhất (SGN)',
    hubType: 'AIRPORT',
    latitude: 10.8188,
    longitude: 106.6519,
    areaId: 10, // TP.HCM
  },
  {
    id: 'HAN',
    name: 'Sân bay Quốc tế Nội Bài (HAN)',
    hubType: 'AIRPORT',
    latitude: 21.2212,
    longitude: 105.8072,
    areaId: 20, // Hà Nội
  },
  {
    id: 'DAD',
    name: 'Sân bay Quốc tế Đà Nẵng (DAD)',
    hubType: 'AIRPORT',
    latitude: 16.0439,
    longitude: 108.1994,
    areaId: 30, // Đà Nẵng
  },
  {
    id: 'DLI',
    name: 'Sân bay Liên Khương (DLI)',
    hubType: 'AIRPORT',
    latitude: 11.7506,
    longitude: 108.3736,
    areaId: 40, // Đà Lạt / Lâm Đồng
  },
  {
    id: 'PQC',
    name: 'Sân bay Quốc tế Phú Quốc (PQC)',
    hubType: 'AIRPORT',
    latitude: 10.1698,
    longitude: 103.9931,
    areaId: 50, // Phú Quốc
  },
  {
    id: 'VCL',
    name: 'Sân bay Chu Lai (VCL)',
    hubType: 'AIRPORT',
    latitude: 15.4061,
    longitude: 108.7056,
    areaId: 60, // Quảng Nam
  },
  // Train Stations
  {
    id: 'SGO',
    name: 'Ga Sài Gòn',
    hubType: 'TRAIN_STATION',
    latitude: 10.7825,
    longitude: 106.6769,
    areaId: 10,
  },
  {
    id: 'DNA',
    name: 'Ga Đà Nẵng',
    hubType: 'TRAIN_STATION',
    latitude: 16.0718,
    longitude: 108.2131,
    areaId: 30,
  },
  {
    id: 'TCH',
    name: 'Ga Tháp Chàm (Phan Rang)',
    hubType: 'TRAIN_STATION',
    latitude: 11.5806,
    longitude: 108.9606,
    areaId: 45,
  },
  {
    id: 'QNG',
    name: 'Ga Quảng Ngãi',
    hubType: 'TRAIN_STATION',
    latitude: 15.1189,
    longitude: 108.7867,
    areaId: 76,
  },
  // Bus Terminals
  {
    id: 'BXMD',
    name: 'Bến xe Miền Đông Mới',
    hubType: 'BUS_TERMINAL',
    latitude: 10.8794,
    longitude: 106.8147,
    areaId: 10,
  },
  {
    id: 'BXDL',
    name: 'Bến xe Liên tỉnh Đà Lạt',
    hubType: 'BUS_TERMINAL',
    latitude: 11.9269,
    longitude: 108.4453,
    areaId: 40,
  },
  // Ferry Terminals
  {
    id: 'SA_KY',
    name: 'Cảng Sa Kỳ (Quảng Ngãi)',
    hubType: 'FERRY_TERMINAL',
    latitude: 15.2225,
    longitude: 108.9261,
    areaId: 76,
  },
  {
    id: 'RACH_GIA',
    name: 'Bến tàu Rạch Giá (Kiên Giang)',
    hubType: 'FERRY_TERMINAL',
    latitude: 10.0125,
    longitude: 105.0758,
    areaId: 51,
  },
];

describe('Transit & Transfer Engine — Unit & Integration Test Suite', () => {
  // =========================================================================
  // PART 1: UNIT TESTS — PURE DOMAIN HELPERS & URL BUILDERS
  // =========================================================================
  describe('1. Pure Domain Helpers & URL Builders', () => {
    it('computeHaversineDistance calculates accurate great-circle distance (Đà Lạt center to Liên Khương ~23km)', () => {
      const dist = computeHaversineDistance(11.9404, 108.4583, 11.7506, 108.3736);
      expect(Math.round(dist)).toBeGreaterThanOrEqual(22);
      expect(Math.round(dist)).toBeLessThanOrEqual(25);
    });

    it('isDirectCityHub satisfies both Tier 1 (areaId match for international >45km) and Tier 2 (<=45km satellite)', () => {
      const limitKm = PRICING_CONFIG.INTERCITY.TRANSFER.LOCAL_HUB_MAX_DISTANCE_KM;

      // International airport 60km away with matching areaId (e.g. Tokyo Narita NRT) -> Direct Local Hub
      const naritaHub: TransitHubDto = {
        id: 'NRT',
        name: 'Narita International Airport (NRT)',
        hubType: 'AIRPORT',
        latitude: 35.772,
        longitude: 140.3929,
        distanceKm: 60,
        areaId: 500,
      };
      expect(isDirectCityHub(naritaHub, 500, limitKm)).toBe(true);

      // Satellite airport 28km away with different areaId (e.g. Hội An areaId=60 using Đà Nẵng DAD areaId=30) -> Direct Local Hub
      const dadForHoiAn: TransitHubDto = {
        ...MOCK_HUBS.find((h) => h.id === 'DAD')!,
        distanceKm: 28,
      };
      expect(isDirectCityHub(dadForHoiAn, 60, limitKm)).toBe(true);

      // Regional airport 245km away with different areaId (e.g. Sa Pa areaId=99 using Nội Bài HAN areaId=20) -> NOT Direct Hub
      const hanForSaPa: TransitHubDto = {
        ...MOCK_HUBS.find((h) => h.id === 'HAN')!,
        distanceKm: 245,
      };
      expect(isDirectCityHub(hanForSaPa, 99, limitKm)).toBe(false);
    });

    it('computeLocalTransfer clamps urban minimum distance and falls back cleanly when distance is 0/undefined', () => {
      // Urban airport 2km from center -> clamped to MIN_LOCAL_TRANSFER_KM (4km) and MIN_LOCAL_TRANSFER_MINUTES (15p)
      const near = computeLocalTransfer(2);
      expect(near.transferKm).toBe(PRICING_CONFIG.INTERCITY.TRANSFER.MIN_LOCAL_TRANSFER_KM);
      expect(near.transferMinutes).toBe(PRICING_CONFIG.INTERCITY.TRANSFER.MIN_LOCAL_TRANSFER_MINUTES);

      // Missing/0 distance -> falls back to DEFAULT_AIRPORT_TRANSFER_KM (12km)
      const fallback = computeLocalTransfer(0);
      expect(fallback.transferKm).toBe(PRICING_CONFIG.INTERCITY.TRANSFER.DEFAULT_AIRPORT_TRANSFER_KM);

      // Liên Khương 28km -> keeps 28km and computes realistic minutes (~36p)
      const dalat = computeLocalTransfer(28);
      expect(dalat.transferKm).toBe(28);
      expect(dalat.transferMinutes).toBe(
        Math.round(28 * PRICING_CONFIG.INTERCITY.TRANSFER.LOCAL_TRANSFER_MINS_PER_KM),
      );
    });

    it('URL builders generate properly encoded provider deep-links without hardcoded strings in strategies', () => {
      const gf = buildGoogleFlightsUrl({
        originCode: 'SGN',
        destCode: 'DAD',
        departDate: '2026-10-20',
        returnDate: '2026-10-22',
      });
      expect(gf).toContain(PRICING_CONFIG.DEEP_LINKS.GOOGLE_FLIGHTS_BASE);
      expect(gf).toContain('SGN');
      expect(gf).toContain('DAD');

      const gmaps = buildGoogleMapsDirUrl({
        origin: 'TP. Hồ Chí Minh',
        destination: 'Vũng Tàu',
        travelMode: 'driving',
      });
      expect(gmaps).toContain('travelmode=driving');

      const vexere = buildVexereBusUrl({
        fromSlug: 'sai-gon',
        toSlug: 'da-lat',
        fromExternalId: '29',
        toExternalId: '24',
        departDateVn: '20-10-2026',
      });
      expect(vexere).toContain('ve-xe-khach-tu-sai-gon-di-da-lat-29t241.html?date=20-10-2026');
    });

    it('calculateFlightDuration & calculateFlightFare calculate smooth continuous affine pricing and duration based on air distance (km)', () => {
      // 1. Short route: Đà Lạt air distance ~215km
      const dalat = calculateFlightFare({ airDistanceKm: 215 });
      expect(dalat.baseFare).toBe(650_000 + 215 * 950); // 854,250 -> rounded to 850,000
      expect(dalat.finalFare).toBe(850_000);
      expect(dalat.flightDurationMinutes).toBe(calculateFlightDuration(215));
      expect(dalat.flightDurationMinutes).toBeLessThan(60); // ~47 mins

      // 2. Medium route: Đà Nẵng air distance ~605km
      const danang = calculateFlightFare({ airDistanceKm: 605 });
      expect(danang.finalFare).toBe(1_220_000); // 650k + 605*950 = 1,224,750 -> 1,220,000
      expect(danang.flightDurationMinutes).toBe(78); // 30 + 48 = 78 mins (~1h18m)

      // 3. Long route: Hà Nội air distance ~1140km
      const hanoi = calculateFlightFare({ airDistanceKm: 1140 });
      expect(hanoi.finalFare).toBe(1_730_000); // 650k + 1140*950 = 1,733,000 -> 1,730,000
      expect(hanoi.flightDurationMinutes).toBe(121); // 30 + 91 = 121 mins (~2h01m)
    });

    it('calculateFlightFare applies contextual multipliers dynamically (Budget Tier, Seasonality, Day of Week)', () => {
      // Base: Đà Nẵng (605km) baseFare = 1,224,750
      const lowBudget = calculateFlightFare({ airDistanceKm: 605, budgetLevel: 'LOW' });
      // 1,224,750 * 0.8 = 979,800 -> 980,000
      expect(lowBudget.finalFare).toBe(980_000);

      const highBudget = calculateFlightFare({ airDistanceKm: 605, budgetLevel: 'HIGH' });
      // 1,224,750 * 1.7 = 2,082,075 -> 2,080,000
      expect(highBudget.finalFare).toBe(2_080_000);

      // Tet Lunar New Year window departure (e.g., Feb 5)
      const tetPeak = calculateFlightFare({
        airDistanceKm: 605,
        budgetLevel: 'MEDIUM',
        departDate: '2027-02-05',
      });
      expect(tetPeak.multipliers.season).toBe(PRICING_CONFIG.INTERCITY.FLIGHT.PEAK_MULTIPLIERS.TET_PEAK);
      expect(tetPeak.finalFare).toBeGreaterThan(1_500_000);
    });
  });

  // =========================================================================
  // PART 2: UNIT TESTS — ALL 5 TRANSIT STRATEGIES
  // =========================================================================
  describe('2. Strategy Unit Tests (Flight, Train, Bus, Motorbike, Car)', () => {
    const flightStrategy = new FlightTransitStrategy({} as never);
    const trainStrategy = new TrainTransitStrategy({} as never);
    const busStrategy = new BusTransitStrategy({
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never);
    const motorbikeStrategy = new RoadTransitStrategy(TransitModeEnum.PERSONAL_MOTORBIKE);
    const carStrategy = new RoadTransitStrategy(TransitModeEnum.PERSONAL_CAR);

    it('Flight Case 1: Local / Satellite Airport Transfer (TP.HCM -> Đà Lạt via Liên Khương & TP.HCM -> Hội An via Đà Nẵng)', async () => {
      const dalatRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đà Lạt',
        departDate: '2026-10-20',
        returnDate: '2026-10-22',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 11.9404, lng: 108.4583, areaId: 40 },
        roadDistanceKm: 308,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });

      expect(dalatRes.isMultiModal).toBe(false);
      expect(dalatRes.destHub?.id).toBe('DLI');
      expect(dalatRes.destHub?.distanceKm).toBe(23); // Real Haversine distance, not 0 or 30
      expect(dalatRes.details.routeSteps).toHaveLength(2);
      expect(dalatRes.details.routeSteps?.[1]).toContain('23km');
      expect(dalatRes.details.routeSteps?.[1]).toContain('về trung tâm Đà Lạt');

      // Satellite airport: Hội An (areaId=60) is ~24km from DAD (areaId=30) -> uses DAD as local satellite airport
      const hoiAnRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Hội An',
        departDate: '2026-10-20',
        returnDate: '2026-10-22',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 15.8801, lng: 108.338, areaId: 60 },
        roadDistanceKm: 920,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });

      expect(hoiAnRes.isMultiModal).toBe(false);
      expect(hoiAnRes.destHub?.id).toBe('DAD');
      expect(hoiAnRes.details.routeSteps?.[1]).toContain('về trung tâm Hội An');
    });

    it('Flight Case 2: Regional Bus Multi-Modal (>45km & different areaId, e.g. TP.HCM -> Sa Pa via Nội Bài)', async () => {
      const sapaRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Sa Pa',
        departDate: '2026-10-20',
        returnDate: '2026-10-23',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 22.3364, lng: 103.8438, areaId: 99 },
        roadDistanceKm: 1680,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });

      expect(sapaRes.isMultiModal).toBe(true);
      expect(sapaRes.destHub?.id).toBe('HAN');
      expect(sapaRes.transferLeg?.type).toBe('BUS');
      expect(sapaRes.transferLeg?.fromName).toContain('Nội Bài');
      expect(sapaRes.transferLeg?.toName).toBe('Sa Pa');
      expect(sapaRes.estimatedPriceOneWay).toBeGreaterThan(
        PRICING_CONFIG.INTERCITY.FLIGHT.ONE_WAY_LONG,
      );
    });

    it('Flight Case 3: Island Ferry Multi-Modal (Đảo Lý Sơn via Chu Lai + Cảng Sa Kỳ) vs Direct Island Airport (Phú Quốc)', async () => {
      const saKyPort = findNearestHub(MOCK_HUBS, 'FERRY_TERMINAL', 15.3804, 109.1167);
      const lySonRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đảo Lý Sơn',
        departDate: '2026-10-20',
        returnDate: '2026-10-23',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 15.3804, lng: 109.1167, areaId: 77 },
        roadDistanceKm: 750,
        isIsland: true,
        nearestFerryHub: saKyPort,
        activeHubs: MOCK_HUBS,
      });

      expect(lySonRes.isMultiModal).toBe(true);
      expect(lySonRes.destHub?.id).toBe('VCL');
      expect(lySonRes.transferLeg?.type).toBe('FERRY');
      expect(lySonRes.transferLeg?.title).toContain('Cảng Sa Kỳ');
      expect(lySonRes.transferLeg?.toName).toBe('Đảo Lý Sơn');

      const phuQuocRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Phú Quốc',
        departDate: '2026-10-20',
        returnDate: '2026-10-23',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 10.227, lng: 103.9632, areaId: 50 },
        roadDistanceKm: 390,
        isIsland: true,
        activeHubs: MOCK_HUBS,
      });

      expect(phuQuocRes.isMultiModal).toBe(false);
      expect(phuQuocRes.destHub?.id).toBe('PQC');
      expect(phuQuocRes.details.routeSteps?.[1]).toContain('về trung tâm Phú Quốc');
    });

    it('Flight Case 4: Same-Gateway / Short-Haul Fallback (TP.HCM -> Vũng Tàu shares SGN)', async () => {
      const vungTauRes = await flightStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Vũng Tàu',
        departDate: '2026-10-20',
        returnDate: '2026-10-22',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 10.346, lng: 107.0843, areaId: 88 },
        roadDistanceKm: 96,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });

      expect(vungTauRes.isMultiModal).toBe(true);
      expect(vungTauRes.transferLeg?.type).toBe('BUS');
      expect(vungTauRes.details.routeSteps?.[0]).toContain('Lưu ý cửa ngõ hàng không');
      expect(vungTauRes.deepLinks.googleFlights).toBeUndefined();
      expect(vungTauRes.deepLinks.googleMaps).toBeDefined();
    });

    it('TrainTransitStrategy handles Direct Station (Đà Nẵng), Regional Station Transfer (Đà Lạt via Tháp Chàm), and Dynamic Island Ferry (Lý Sơn via Ga Quảng Ngãi + Cảng Sa Kỳ)', async () => {
      // 1. Direct station: Đà Nẵng
      const directTrain = await trainStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đà Nẵng',
        departDate: '2026-10-20',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 16.0544, lng: 108.2022, areaId: 30 },
        roadDistanceKm: 960,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });
      expect(directTrain.isMultiModal).toBe(false);
      expect(directTrain.destHub?.id).toBe('DNA');
      expect(directTrain.details.routeSteps?.[1]).toContain('Trung chuyển về khách sạn');

      // 2. Regional station transfer: Đà Lạt via Ga Tháp Chàm (~68km)
      const dalatTrain = await trainStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đà Lạt',
        departDate: '2026-10-20',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 11.9404, lng: 108.4583, areaId: 40 },
        roadDistanceKm: 308,
        isIsland: false,
        activeHubs: MOCK_HUBS,
      });
      expect(dalatTrain.isMultiModal).toBe(true);
      expect(dalatTrain.destHub?.id).toBe('TCH');
      expect(dalatTrain.transferLeg?.type).toBe('BUS');
      expect(dalatTrain.transferLeg?.fromName).toContain('Ga Tháp Chàm');

      // 3. Island train + ferry: Hà Nội -> Đảo Lý Sơn (must use Ga Quảng Ngãi & Cảng Sa Kỳ, NOT hardcoded Sài Gòn / Rạch Giá!)
      const saKyPort = findNearestHub(MOCK_HUBS, 'FERRY_TERMINAL', 15.3804, 109.1167);
      const lySonTrain = await trainStrategy.calculate({
        originCity: 'Hà Nội',
        destCity: 'Đảo Lý Sơn',
        departDate: '2026-10-20',
        originCoords: { lat: 21.0285, lng: 105.8542, areaId: 20 },
        destCoords: { lat: 15.3804, lng: 109.1167, areaId: 77 },
        roadDistanceKm: 890,
        isIsland: true,
        nearestFerryHub: saKyPort,
        activeHubs: MOCK_HUBS,
      });
      expect(lySonTrain.isMultiModal).toBe(true);
      expect(lySonTrain.transferLeg?.type).toBe('FERRY');
      expect(lySonTrain.transferLeg?.fromName).toBe('Ga Quảng Ngãi');
      expect(lySonTrain.transferLeg?.title).toContain('Cảng Sa Kỳ (Quảng Ngãi)');
      expect(lySonTrain.details.routeSteps?.join(' ')).not.toContain('Rạch Giá');
    });

    it('BusTransitStrategy & RoadTransitStrategy handle mainland, island ferry, and safety thresholds accurately', async () => {
      const rachGiaPort = findNearestHub(MOCK_HUBS, 'FERRY_TERMINAL', 10.227, 103.9632);

      // Bus to Phú Quốc
      const busIsland = await busStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Phú Quốc',
        departDate: '2026-10-20',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 10.227, lng: 103.9632, areaId: 50 },
        roadDistanceKm: 390,
        isIsland: true,
        nearestFerryHub: rachGiaPort,
        activeHubs: MOCK_HUBS,
      });
      expect(busIsland.isMultiModal).toBe(true);
      expect(busIsland.transferLeg?.type).toBe('FERRY');
      expect(busIsland.transferLeg?.fromName).toBe('Bến tàu Rạch Giá (Kiên Giang)');

      // Motorbike > 350km triggers WARNING safetyAdvisory
      const longBike = await motorbikeStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đà Nẵng',
        departDate: '2026-10-20',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 16.0544, lng: 108.2022, areaId: 30 },
        roadDistanceKm: 960,
        isIsland: false,
      });
      expect(longBike.safetyAdvisory?.level).toBe('WARNING');
      expect(motorbikeStrategy.summarize(longBike, 960)?.warning).toBe('Chú ý cự ly xa');

      // Car > 600km triggers INFO safetyAdvisory and computes highway BOT toll
      const longCar = await carStrategy.calculate({
        originCity: 'TP. Hồ Chí Minh',
        destCity: 'Đà Nẵng',
        departDate: '2026-10-20',
        originCoords: { lat: 10.7769, lng: 106.7009, areaId: 10 },
        destCoords: { lat: 16.0544, lng: 108.2022, areaId: 30 },
        roadDistanceKm: 960,
        isIsland: false,
      });
      expect(longCar.safetyAdvisory?.level).toBe('INFO');
      expect(longCar.details.highwayToll).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // PART 3: INTEGRATION TESTS — NESTJS DI, TRANSIT SERVICE & CONTROLLER HTTP
  // =========================================================================
  describe('3. Integration Tests — NestJS Module DI, TransitService & ItinerariesController', () => {
    let app: INestApplication;
    let transitService: TransitService;
    let plannerService: ItineraryPlannerService;

    const mockItineraryId = '550e8400-e29b-41d4-a716-446655440000';
    let storedItineraryState: any;

    const mockPrisma = {
      transitHub: {
        findMany: jest.fn().mockResolvedValue(MOCK_HUBS),
      },
      $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join(' ');
        // Mock travel_areas bbox center lookup
        if (sql.includes('FROM travel_areas') && sql.includes('bbox_min_lat')) {
          const term = String(values[0] || '').toLowerCase();
          if (term.includes('hồ chí minh')) {
            return Promise.resolve([{ lat: 10.7769, lng: 106.7009, area_id: 10 }]);
          }
          if (term.includes('đà lạt')) {
            return Promise.resolve([{ lat: 11.9404, lng: 108.4583, area_id: 40 }]);
          }
          if (term.includes('đà nẵng')) {
            return Promise.resolve([{ lat: 16.0544, lng: 108.2022, area_id: 30 }]);
          }
          if (term.includes('sa pa')) {
            return Promise.resolve([{ lat: 22.3364, lng: 103.8438, area_id: 99 }]);
          }
        }
        return Promise.resolve([]);
      }),
      itinerary: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(storedItineraryState)),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(storedItineraryState)),
        update: jest.fn().mockImplementation(({ data }) => {
          storedItineraryState = {
            ...storedItineraryState,
            totalBudget: data.totalBudget,
            estimatedCost: data.estimatedCost,
            aiPreferences: data.aiPreferences,
          };
          return Promise.resolve(storedItineraryState);
        }),
      },
    };

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [ItinerariesController],
        providers: [
          { provide: PrismaService, useValue: mockPrisma },
          FlightTransitStrategy,
          BusTransitStrategy,
          TrainTransitStrategy,
          {
            provide: INJECT_TOKENS.TRANSIT_STRATEGIES,
            useFactory: (
              flight: FlightTransitStrategy,
              bus: BusTransitStrategy,
              train: TrainTransitStrategy,
            ) => [
              flight,
              bus,
              train,
              new RoadTransitStrategy(TransitModeEnum.PERSONAL_MOTORBIKE),
              new RoadTransitStrategy(TransitModeEnum.PERSONAL_CAR),
            ],
            inject: [FlightTransitStrategy, BusTransitStrategy, TrainTransitStrategy],
          },
          TransitService,
          ItineraryPlannerService,
          { provide: GeminiPlannerService, useValue: {} },
          { provide: CopilotAgentService, useValue: {} },
          { provide: CopilotToolsService, useValue: {} },
        ],
      })
        .overrideGuard(OptionalJwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      transitService = moduleFixture.get<TransitService>(TransitService);
      plannerService = moduleFixture.get<ItineraryPlannerService>(ItineraryPlannerService);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      // Seed a legacy itinerary snapshot where destName was saved as airport name and routeSteps was empty
      storedItineraryState = {
        id: mockItineraryId,
        creatorId: null,
        title: 'Khám phá Đà Nẵng 3N2Đ',
        destination: 'Đà Nẵng',
        startDate: new Date('2026-10-20T00:00:00.000Z'),
        endDate: new Date('2026-10-22T00:00:00.000Z'),
        totalBudget: 6500000,
        estimatedCost: 6500000,
        budgetLevel: 'MEDIUM',
        status: 'DRAFT',
        isPublic: true,
        isAiGenerated: true,
        totalPlaces: 0,
        deletedAt: null,
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
        updatedAt: new Date('2026-10-10T00:00:00.000Z'),
        area: { id: 30, name: 'Da Nang', nameVi: 'Đà Nẵng', slug: 'da-nang' },
        destinations: [],
        aiPreferences: {
          originCity: 'TP. Hồ Chí Minh',
          destCity: 'Đà Nẵng',
          transitMode: 'FLIGHT',
          intracityMode: 'MOTORBIKE_RENTAL',
          pace: 'BALANCED',
          budgetBreakdown: {
            transitRoundTrip: 2800000,
            accommodation: 1300000,
            food: 840000,
            tickets: 360000,
            localTransit: 510000,
            totalEstimated: 5810000,
          },
          intercityTransit: {
            mode: 'FLIGHT',
            originName: 'Sân bay Quốc tế Tân Sơn Nhất (SGN)',
            destName: 'Sân bay Quốc tế Đà Nẵng (DAD)', // Legacy bug: airport name stored in destName
            distanceKm: 850,
            durationMinutes: 80,
            estimatedPriceOneWay: 1400000,
            estimatedPriceRoundTrip: 2800000,
            deepLinks: { googleFlights: 'https://www.google.com/travel/flights' },
            safetyAdvisory: null,
            originHub: MOCK_HUBS[0],
            destHub: { ...MOCK_HUBS[2], distanceKm: 5 },
            isIsland: false,
            isMultiModal: false,
            details: {
              carriers: 'Vietnam Airlines, Vietjet Air',
              // Legacy bug: routeSteps missing
            },
          },
        },
      };
    });

    it('POST /itineraries/transit-preview resolves bbox center coordinates (preventing 0km->30km bug) and returns allModesSummary via DI strategies', async () => {
      const response = await request(app.getHttpServer())
        .post('/itineraries/transit-preview')
        .send({
          originCity: 'TP. Hồ Chí Minh',
          destCity: 'Đà Lạt',
          transitMode: 'FLIGHT',
          departDate: '2026-10-20',
          returnDate: '2026-10-22',
        })
        .expect(200);

      const body = response.body;
      expect(body.mode).toBe('FLIGHT');
      expect(body.destName).toBe('Đà Lạt');
      expect(body.destHub.id).toBe('DLI');
      expect(body.destHub.distanceKm).toBe(23); // True bbox center -> DLI distance
      expect(body.isMultiModal).toBe(false);
      expect(body.details.routeSteps).toHaveLength(2);
      expect(body.allModesSummary).toHaveLength(4);
      expect(body.allModesSummary.map((m: any) => m.mode)).toEqual([
        'FLIGHT',
        'SLEEPER_BUS',
        'TRAIN',
        'PERSONAL_MOTORBIKE',
      ]);
    });

    it('GET /itineraries/:id normalizes legacy stored intercityTransit snapshots automatically', async () => {
      const response = await request(app.getHttpServer())
        .get(`/itineraries/${mockItineraryId}`)
        .expect(200);

      const transit = response.body.intercityTransit;
      expect(transit).toBeDefined();
      // Legacy destName ('Sân bay Quốc tế Đà Nẵng (DAD)') is normalized to 'Đà Nẵng'
      expect(transit.destName).toBe('Đà Nẵng');
      // Missing routeSteps is populated with 2 steps including local airport-to-downtown transfer
      expect(transit.details.routeSteps).toHaveLength(2);
      expect(transit.details.routeSteps[1]).toContain('Trung chuyển sân bay về trung tâm');
      expect(transit.details.routeSteps[1]).toContain('về trung tâm Đà Nẵng (~5km');
    });

    it('PATCH /itineraries/:id/transit-mode recalculates multi-modal/transfer steps and updates budgetBreakdown in DB', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/itineraries/${mockItineraryId}/transit-mode`)
        .send({ transitMode: 'TRAIN' })
        .expect(200);

      const updated = response.body;
      expect(updated.intercityTransit.mode).toBe('TRAIN');
      expect(updated.intercityTransit.destHub.id).toBe('DNA');
      expect(updated.intercityTransit.details.routeSteps).toHaveLength(2);
      expect(updated.intercityTransit.details.routeSteps[1]).toContain(
        'Trung chuyển về khách sạn: Đón Taxi / Grab từ Ga Đà Nẵng về trung tâm Đà Nẵng',
      );
      expect(updated.budgetBreakdown.transitRoundTrip).toBe(
        updated.intercityTransit.estimatedPriceRoundTrip,
      );
      expect(mockPrisma.itinerary.update).toHaveBeenCalled();
    });
  });
});
