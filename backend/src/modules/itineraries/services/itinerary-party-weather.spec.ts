import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ItineraryAccessService } from './itinerary-access.service';
import { ItineraryPlannerService } from './itinerary-planner.service';
import { GeminiPlannerService } from './gemini-planner.service';
import { TransitService } from './transit.service';
import { WeatherService } from '../../weather/weather.service';
import {
  WeatherCondition,
  WeatherSource,
  type DayWeather,
} from '../../weather/weather.constants';
import { PrismaService } from '../../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('Itinerary partySize scaling, LLM weather prompt, and weather retrieval', () => {
  it('injects partySize and buildWeatherGuidance into GeminiPlannerService.buildPrompt', () => {
    const gemini = new GeminiPlannerService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const dailyWeather: DayWeather[] = [
      {
        dayNumber: 1,
        date: '2026-11-12',
        source: WeatherSource.FORECAST,
        isForecast: true,
        condition: WeatherCondition.RAINY,
        labelVi: 'Mưa rào',
        tempMinC: 23,
        tempMaxC: 27,
        tempAvgC: 25,
        precipitationProbabilityMax: 85,
        uvIndexMax: 4,
        weatherCode: 61,
      },
      {
        dayNumber: 2,
        date: '2026-11-13',
        source: WeatherSource.SEASONAL_AVERAGE,
        isForecast: false,
        condition: WeatherCondition.SUNNY,
        labelVi: 'Nắng ấm',
        tempMinC: 24,
        tempMaxC: 35,
        tempAvgC: 30,
        precipitationProbabilityMax: 15,
        uvIndexMax: 9,
        weatherCode: null,
      },
    ];

    const prompt = (gemini as any).buildPrompt({
      originCity: 'TP. Hồ Chí Minh',
      destCity: 'Đà Nẵng',
      destLat: 16.0544,
      destLng: 108.2022,
      totalDays: 2,
      partySize: 4,
      budgetLevel: 'MEDIUM',
      pace: 'BALANCED',
      travelStyles: ['CULTURE', 'FOOD'],
      dietaryRestrictions: [],
      preferredCategories: [],
      dailyWeather,
      places: [
        {
          id: 'p-1',
          name: 'Bảo tàng Chăm',
          cat: 'Bảo tàng',
          rating: 4.7,
          tags: [],
        },
      ],
    });

    expect(prompt).toContain('4 người');
    expect(prompt).toContain('THỜI TIẾT TỪNG NGÀY TẠI ĐIỂM ĐẾN');
    expect(prompt).toContain('ƯU TIÊN điểm trong nhà');
    expect(prompt).toContain('Xu hướng khí hậu mùa, không phải dự báo');
  });

  it('updatePartySize updates budget deterministically without calling LLM, blocks non-owner, and keeps partySize independent of memberCount', async () => {
    let rowState: any = {
      id: 'itin-party-1',
      creatorId: 'owner-1',
      title: 'Đà Nẵng 3N2Đ',
      description: 'Test',
      destination: 'Đà Nẵng',
      startDate: new Date('2026-11-12T00:00:00.000Z'),
      endDate: new Date('2026-11-14T00:00:00.000Z'),
      budgetLevel: 'MEDIUM',
      isPublic: false,
      partySize: 2,
      updatedAt: new Date('2026-11-11T00:00:00.000Z'),
      area: null,
      destinations: [],
      tripGroup: {
        id: 'grp-1',
        members: [
          {
            userId: 'owner-1',
            role: 'OWNER',
            user: { id: 'owner-1', fullName: 'Owner', avatarUrl: null },
          },
          {
            userId: 'u-2',
            role: 'EDITOR',
            user: { id: 'u-2', fullName: 'M2', avatarUrl: null },
          },
          {
            userId: 'u-3',
            role: 'VIEWER',
            user: { id: 'u-3', fullName: 'M3', avatarUrl: null },
          },
          {
            userId: 'u-4',
            role: 'VIEWER',
            user: { id: 'u-4', fullName: 'M4', avatarUrl: null },
          },
        ],
      },
      aiPreferences: {
        originCity: 'TP. Hồ Chí Minh',
        transitMode: 'FLIGHT',
        intracityMode: 'MOTORBIKE_RENTAL',
        intercityTransit: {
          mode: 'FLIGHT',
          originName: 'SGN',
          destName: 'Đà Nẵng',
          distanceKm: 850,
          durationMinutes: 80,
          estimatedPriceOneWay: 1000000,
          estimatedPriceRoundTrip: 2000000,
          deepLinks: {},
          details: {},
        },
        baseBudgetBreakdown: {
          transitRoundTrip: 2000000,
          accommodation: 1000000,
          food: 600000,
          tickets: 400000,
          localTransit: 300000,
        },
        budgetBreakdown: {
          transitRoundTrip: 4000000,
          accommodation: 1000000,
          food: 1200000,
          tickets: 800000,
          localTransit: 300000,
          totalEstimated: 7300000,
          perPersonEstimated: 3650000,
          partySize: 2,
        },
      },
    };

    const prismaMock = {
      itinerary: {
        findFirst: jest.fn(async () => rowState),
        update: jest.fn(async ({ data }: any) => {
          rowState = { ...rowState, ...data };
          return rowState;
        }),
      },
    };

    const accessService = new ItineraryAccessService(
      prismaMock as unknown as PrismaService,
    );
    const geminiMock = { plan: jest.fn() };
    const weatherMock = {
      getTripWeather: jest
        .fn()
        .mockResolvedValue({ days: [], hasForecastDays: false }),
    };

    const planner = new ItineraryPlannerService(
      prismaMock as unknown as PrismaService,
      {
        computeHaversineDistance: jest.fn(() => 2),
      } as unknown as TransitService,
      geminiMock as unknown as GeminiPlannerService,
      accessService,
      weatherMock as unknown as WeatherService,
    );

    // Non-owner (even EDITOR) cannot mutate partySize
    await expect(
      planner.updatePartySize('itin-party-1', 5, 'u-2'),
    ).rejects.toThrow(ForbiddenException);

    // memberCount = 4 > target partySize = 2: update to 2 succeeds without blocking or overwriting with 4
    const updatedTo2 = await planner.updatePartySize(
      'itin-party-1',
      2,
      'owner-1',
    );
    expect(updatedTo2.partySize).toBe(2);
    expect(updatedTo2.memberCount).toBe(4);
    expect(updatedTo2.budgetBreakdown?.accommodation).toBe(1000000); // 1 room for 2 people
    expect(updatedTo2.budgetBreakdown?.transitRoundTrip).toBe(4000000);
    expect(updatedTo2.budgetBreakdown?.food).toBe(1200000);

    // Scale up to 5 -> ceil(5/2) = 3 rooms, 5x tickets/food/flight
    const updatedTo5 = await planner.updatePartySize(
      'itin-party-1',
      5,
      'owner-1',
    );
    expect(updatedTo5.partySize).toBe(5);
    expect(updatedTo5.budgetBreakdown?.accommodation).toBe(3000000);
    expect(updatedTo5.budgetBreakdown?.transitRoundTrip).toBe(10000000);
    expect(updatedTo5.budgetBreakdown?.food).toBe(3000000);
    expect(updatedTo5.budgetBreakdown?.tickets).toBe(2000000);
    expect(geminiMock.plan).not.toHaveBeenCalled();

    // Scale back to 2 -> idempotent exact match using preserved baseBudgetBreakdown
    const backTo2 = await planner.updatePartySize('itin-party-1', 2, 'owner-1');
    expect(backTo2.budgetBreakdown?.totalEstimated).toBe(
      updatedTo2.budgetBreakdown?.totalEstimated,
    );
  });

  it('updatePartySize is idempotent for legacy rows without baseBudgetBreakdown and reads the row only once', async () => {
    let rowState: any = {
      id: 'itin-legacy',
      creatorId: 'owner-1',
      title: 'Legacy',
      description: null,
      destination: 'Đà Nẵng',
      startDate: new Date('2026-11-12T00:00:00.000Z'),
      endDate: new Date('2026-11-14T00:00:00.000Z'),
      budgetLevel: 'MEDIUM',
      isPublic: false,
      partySize: 3,
      updatedAt: new Date('2026-11-11T00:00:00.000Z'),
      area: null,
      destinations: [],
      tripGroup: null,
      aiPreferences: {
        intracityMode: 'MOTORBIKE_RENTAL',
        intercityTransit: {
          mode: 'FLIGHT',
          originName: 'SGN',
          destName: 'Đà Nẵng',
          estimatedPriceRoundTrip: 2000000,
          details: {},
        },
        budgetBreakdown: {
          transitRoundTrip: 6000000,
          accommodation: 2000000,
          food: 0,
          tickets: 0,
          localTransit: 600000,
          totalEstimated: 8600000,
        },
      },
    };
    const prismaMock = {
      itinerary: {
        findFirst: jest.fn(async () => rowState),
        update: jest.fn(async ({ data }: any) => {
          rowState = { ...rowState, ...data };
          return rowState;
        }),
      },
    };
    const planner = new ItineraryPlannerService(
      prismaMock as unknown as PrismaService,
      {
        computeHaversineDistance: jest.fn(() => 2),
      } as unknown as TransitService,
      { plan: jest.fn() } as unknown as GeminiPlannerService,
      new ItineraryAccessService(prismaMock as unknown as PrismaService),
    );

    const first = await planner.updatePartySize('itin-legacy', 3, 'owner-1');
    const toFive = await planner.updatePartySize('itin-legacy', 5, 'owner-1');
    const backToThree = await planner.updatePartySize(
      'itin-legacy',
      3,
      'owner-1',
    );

    expect(toFive.budgetBreakdown?.totalEstimated).toBeGreaterThan(
      first.budgetBreakdown!.totalEstimated,
    );
    expect(backToThree.budgetBreakdown).toEqual(first.budgetBreakdown);
    // assertOwner (1 read) + updatePartySize row load (1 read) per call; no trailing getById read.
    const reads = prismaMock.itinerary.findFirst.mock.calls.length;
    expect(reads).toBe(3 * 2);
  });

  it('getWeatherById checks assertCanView, averages stop coordinates, and delegates to WeatherService', async () => {
    const row = {
      id: 'itin-w-1',
      creatorId: 'owner-1',
      isPublic: true,
      deletedAt: null,
      updatedAt: new Date(),
      destination: 'Đà Lạt',
      startDate: new Date('2026-11-12T00:00:00.000Z'),
      endDate: new Date('2026-11-14T00:00:00.000Z'),
      aiPreferences: {},
      area: null,
      tripGroup: { id: 'grp', members: [] },
      destinations: [
        { dayNumber: 1, place: { latitude: 11.94, longitude: 108.44 } },
        { dayNumber: 2, place: { latitude: 11.96, longitude: 108.46 } },
      ],
    };
    const prismaMock = { itinerary: { findFirst: jest.fn(async () => row) } };
    const accessService = new ItineraryAccessService(
      prismaMock as unknown as PrismaService,
    );
    const getTripWeather = jest.fn().mockResolvedValue({
      destination: 'Đà Lạt',
      coordinates: { lat: 11.95, lng: 108.45 },
      timezone: 'Asia/Ho_Chi_Minh',
      hasForecastDays: true,
      days: [],
      guidance: '',
    });

    const planner = new ItineraryPlannerService(
      prismaMock as unknown as PrismaService,
      {} as TransitService,
      {} as GeminiPlannerService,
      accessService,
      { getTripWeather } as unknown as WeatherService,
    );

    await planner.getWeatherById('itin-w-1');
    expect(getTripWeather).toHaveBeenCalledWith({
      lat: 11.95,
      lng: 108.45,
      destination: 'Đà Lạt',
      startDate: row.startDate,
      totalDays: 3,
    });
  });

  it('respects RELAXED, BALANCED, and PACKED pace in GeminiPlannerService prompt and deterministic fallback slots', () => {
    const gemini = new GeminiPlannerService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const samplePlaces = Array.from({ length: 8 }, (_, idx) => ({
      id: `p-${idx + 1}`,
      name: `Điểm ${idx + 1}`,
      cat: 'Tham quan',
      rating: 4.6,
      tags: [],
    }));

    const packedPrompt = (gemini as any).buildPrompt({
      originCity: 'Hà Nội',
      destCity: 'Đà Nẵng',
      totalDays: 2,
      partySize: 2,
      budgetLevel: 'MEDIUM',
      pace: 'PACKED',
      travelStyles: ['FOOD'],
      places: samplePlaces,
    });
    expect(packedPrompt).toContain('Khám phá nhiều (6–7 điểm/ngày)');
    expect(packedPrompt).toContain('MẬT ĐỘ HOẠT ĐỘNG (PACKED)');

    const relaxedPlan = (gemini as any).buildFallbackPlan({
      destCity: 'Đà Nẵng',
      totalDays: 1,
      pace: 'RELAXED',
      places: samplePlaces,
    });
    const balancedPlan = (gemini as any).buildFallbackPlan({
      destCity: 'Đà Nẵng',
      totalDays: 1,
      pace: 'BALANCED',
      places: samplePlaces,
    });
    const packedPlan = (gemini as any).buildFallbackPlan({
      destCity: 'Đà Nẵng',
      totalDays: 1,
      pace: 'PACKED',
      places: samplePlaces,
    });

    expect(relaxedPlan.days[0].activities).toHaveLength(3);
    expect(balancedPlan.days[0].activities).toHaveLength(4);
    expect(packedPlan.days[0].activities).toHaveLength(6);
  });

  it('updateItineraryMeta lets EDITOR update title/description, requires OWNER for partySize, and rejects empty payload', async () => {
    let rowState: any = {
      id: 'itin-meta-1',
      creatorId: 'owner-1',
      title: 'Tên cũ',
      description: 'Mô tả cũ',
      destination: 'Đà Nẵng',
      startDate: new Date('2026-11-12T00:00:00.000Z'),
      endDate: new Date('2026-11-13T00:00:00.000Z'),
      budgetLevel: 'MEDIUM',
      isPublic: false,
      partySize: 2,
      updatedAt: new Date('2026-11-11T00:00:00.000Z'),
      area: null,
      destinations: [],
      tripGroup: { members: [{ role: 'EDITOR' }] },
      aiPreferences: {
        budgetBreakdown: {
          transitRoundTrip: 0,
          accommodation: 0,
          food: 0,
          tickets: 0,
          localTransit: 0,
          totalEstimated: 0,
        },
      },
    };

    const prismaMock = {
      itinerary: {
        findFirst: jest.fn(async () => rowState),
        update: jest.fn(async ({ data }: any) => {
          rowState = { ...rowState, ...data };
          return rowState;
        }),
      },
    };
    const accessService = new ItineraryAccessService(
      prismaMock as unknown as PrismaService,
    );
    const planner = new ItineraryPlannerService(
      prismaMock as unknown as PrismaService,
      {} as TransitService,
      {} as GeminiPlannerService,
      accessService,
    );

    const edited = await planner.updateItineraryMeta(
      'itin-meta-1',
      { title: '  Đà Nẵng 3N2Đ Mới  ', description: '' },
      'editor-1',
    );
    expect(edited.title).toBe('Đà Nẵng 3N2Đ Mới');
    expect(edited.description).toBeNull();
    // Title/description-only path: single access read, no extra DETAIL_INCLUDE pre-read.
    expect(prismaMock.itinerary.findFirst).toHaveBeenCalledTimes(1);

    await expect(
      planner.updateItineraryMeta('itin-meta-1', { partySize: 4 }, 'editor-1'),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      planner.updateItineraryMeta('itin-meta-1', {}, 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
