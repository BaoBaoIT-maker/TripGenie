import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CopilotToolsService } from './copilot-tools.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  computeAdjacentMoveSchedule,
  parseTimeOfDay,
} from '../../../common/utils/time-of-day.util';
import { computeBottomUpActivityCosts } from '../services/itinerary-planner.service';

describe('CopilotToolsService.addActivity & Dynamic Budget Recalculation', () => {
  const mockPlace = {
    id: 'place-dragon-bridge',
    name: 'Cầu Rồng Đà Nẵng',
    address: 'Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
    latitude: 16.061,
    longitude: 108.227,
    ratingAvg: 4.8,
    priceLevel: 'LOW',
    priceRange: { min: 0, max: 50000 },
    category: {
      slug: 'diem-tham-quan',
      name: 'Sightseeing',
      nameVi: 'Điểm tham quan',
    },
  };

  let prismaMock: {
    place: { findFirst: jest.Mock; findMany: jest.Mock };
    travelArea: { findMany: jest.Mock };
    itinerary: { update: jest.Mock; findUnique: jest.Mock };
    itineraryDestination: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: CopilotToolsService;

  beforeEach(() => {
    prismaMock = {
      place: {
        findFirst: jest.fn().mockResolvedValue(mockPlace),
        findMany: jest.fn().mockResolvedValue([]),
      },
      travelArea: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      itineraryDestination: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'dest-new' }),
        update: jest.fn().mockResolvedValue({ id: 'dest-updated' }),
        delete: jest.fn().mockResolvedValue({ id: 'dest-deleted' }),
        count: jest.fn().mockResolvedValue(1),
      },
      itinerary: {
        update: jest.fn().mockResolvedValue({ id: 'itin-1' }),
        findUnique: jest.fn().mockResolvedValue({
          area: {
            bboxMinLat: 15.9,
            bboxMaxLat: 16.2,
            bboxMinLng: 107.9,
            bboxMaxLng: 108.4,
          },
        }),
      },
      $transaction: jest.fn(async (cb: (tx: typeof prismaMock) => unknown) =>
        cb(prismaMock),
      ),
    };
    service = new CopilotToolsService(prismaMock as unknown as PrismaService);
  });

  it('rejects adding a place that is already in the same day', async () => {
    prismaMock.itineraryDestination.findFirst.mockResolvedValueOnce({
      id: 'existing-dest-row',
      itineraryId: 'itin-1',
      dayNumber: 1,
      placeId: mockPlace.id,
    });

    const result = await service.addActivity('itin-1', {
      dayNumber: 1,
      placeId: mockPlace.id,
      query: mockPlace.name,
      timeSlot: 'Chiều',
      dryRun: false,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('đã có trong Ngày 1');
    expect(prismaMock.itineraryDestination.create).not.toHaveBeenCalled();
  });

  it('inserts place with base timeSlot (08:30 - 10:00) and estimatedCost when day slot is free', async () => {
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);

    const result = await service.addActivity('itin-1', {
      dayNumber: 2,
      placeId: mockPlace.id,
      query: mockPlace.name,
      timeSlot: 'Sáng',
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      dayNumber: 2,
      placeName: 'Cầu Rồng Đà Nẵng',
      startTime: '08:30',
      endTime: '10:00',
    });
    expect(prismaMock.itineraryDestination.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.itineraryDestination.create.mock.calls[0][0];
    expect(createArg.data.itineraryId).toBe('itin-1');
    expect(createArg.data.placeId).toBe(mockPlace.id);
    expect(createArg.data.dayNumber).toBe(2);
    expect(createArg.data.estimatedDurationMinutes).toBe(90);
    expect(Number(createArg.data.estimatedCost)).toBeGreaterThanOrEqual(0);
  });

  it('automatically shifts start/end time to avoid overlapping existing activities in the same day', async () => {
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    // Day 1 already has 08:30-10:00 (Morning) and 11:30-13:00 (Lunch)
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      {
        id: 'act-morning',
        visitOrder: 1,
        startTime: parseTimeOfDay('08:30'),
        endTime: parseTimeOfDay('10:00'),
      },
      {
        id: 'act-lunch',
        visitOrder: 2,
        startTime: parseTimeOfDay('11:30'),
        endTime: parseTimeOfDay('13:00'),
      },
    ]);

    const result = await service.addActivity('itin-1', {
      dayNumber: 1,
      placeId: mockPlace.id,
      query: mockPlace.name,
      timeSlot: 'Sáng',
      dryRun: false,
    });

    expect(result.success).toBe(true);
    // Fits into the morning gap [10:15 - 11:15] (15m buffer after 10:00 and 15m buffer before 11:30)
    expect(result.data).toMatchObject({
      dayNumber: 1,
      placeName: 'Cầu Rồng Đà Nẵng',
      startTime: '10:15',
      endTime: '11:15',
    });
    const createArg = prismaMock.itineraryDestination.create.mock.calls[0][0];
    expect(createArg.data.estimatedDurationMinutes).toBe(60);
  });

  it('recomputes bottom-up tickets and food costs accurately when places are added', () => {
    const initial = computeBottomUpActivityCosts(
      [
        { isDining: false, estimatedCost: 150000 },
        { isDining: true, estimatedCost: 120000 },
      ],
      1,
      'MEDIUM',
      'Đà Nẵng',
    );

    const afterAddingSightseeingAndDining = computeBottomUpActivityCosts(
      [
        { isDining: false, estimatedCost: 150000 },
        { isDining: true, estimatedCost: 120000 },
        { isDining: false, estimatedCost: 250000 }, // new ticketed attraction
        { isDining: true, estimatedCost: 300000 }, // new restaurant
      ],
      1,
      'MEDIUM',
      'Đà Nẵng',
    );

    expect(afterAddingSightseeingAndDining.tickets).toBe(
      initial.tickets + 250000,
    );
    expect(afterAddingSightseeingAndDining.food).toBeGreaterThan(initial.food);
  });

  it('addActivityDirect throws ConflictException when place already exists in the day', async () => {
    prismaMock.itineraryDestination.findFirst.mockResolvedValueOnce({
      id: 'existing-dest-row',
      itineraryId: 'itin-1',
      dayNumber: 1,
      placeId: mockPlace.id,
    });

    await expect(
      service.addActivityDirect('itin-1', {
        dayNumber: 1,
        placeId: mockPlace.id,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('updateActivityDirect rejects moving to a day with duplicate placeId and updates times/notes cleanly', async () => {
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce({
        id: 'dest-1',
        itineraryId: 'itin-1',
        dayNumber: 1,
        placeId: mockPlace.id,
        visitOrder: 1,
        startTime: parseTimeOfDay('08:30'),
        endTime: parseTimeOfDay('10:00'),
        estimatedDurationMinutes: 90,
        place: { name: mockPlace.name },
      })
      .mockResolvedValueOnce({ id: 'dest-dup' });

    await expect(
      service.updateActivityDirect('itin-1', 'dest-1', { dayNumber: 2 }),
    ).rejects.toThrow(ConflictException);

    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce({
        id: 'dest-1',
        itineraryId: 'itin-1',
        dayNumber: 1,
        placeId: mockPlace.id,
        visitOrder: 1,
        startTime: parseTimeOfDay('08:30'),
        endTime: parseTimeOfDay('10:00'),
        estimatedDurationMinutes: 90,
        place: { name: mockPlace.name },
      })
      .mockResolvedValueOnce(null);
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      { visitOrder: 2 },
    ]);

    await service.updateActivityDirect('itin-1', 'dest-1', {
      dayNumber: 2,
      startTime: '14:00',
      endTime: '16:00',
      notes: 'Ghé buổi chiều',
    });

    const updateArg = prismaMock.itineraryDestination.update.mock.calls[0][0];
    expect(updateArg.data.dayNumber).toBe(2);
    expect(updateArg.data.estimatedDurationMinutes).toBe(120);
    expect(updateArg.data.notes).toBe('Ghé buổi chiều');
  });

  it('removeActivityDirect deletes row inside $transaction, recounts totalPlaces, and throws NotFoundException if absent', async () => {
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      {
        id: 'dest-1',
        itineraryId: 'itin-1',
        dayNumber: 1,
        place: { name: mockPlace.name },
      },
    ]);
    prismaMock.itineraryDestination.count.mockResolvedValueOnce(4);

    await service.removeActivityDirect('itin-1', 'dest-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.itineraryDestination.delete).toHaveBeenCalledWith({
      where: { id: 'dest-1' },
    });
    expect(prismaMock.itinerary.update).toHaveBeenCalledWith({
      where: { id: 'itin-1' },
      data: { totalPlaces: 4 },
    });

    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
    await expect(
      service.removeActivityDirect('itin-1', 'missing-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('computeAdjacentMoveSchedule and moveActivityDirect swap order, shift times deterministically, ripple overlaps, and guard boundaries', async () => {
    const scheduleRes = computeAdjacentMoveSchedule(
      [
        {
          id: 'd-1',
          startTime: parseTimeOfDay('08:00'),
          endTime: parseTimeOfDay('10:00'),
          estimatedDurationMinutes: 120,
          visitOrder: 1,
        },
        {
          id: 'd-2',
          startTime: parseTimeOfDay('10:15'),
          endTime: parseTimeOfDay('11:00'),
          estimatedDurationMinutes: 45,
          visitOrder: 2,
        },
        {
          id: 'd-3',
          startTime: parseTimeOfDay('11:05'),
          endTime: parseTimeOfDay('12:00'),
          estimatedDurationMinutes: 55,
          visitOrder: 3,
        },
      ],
      'd-1',
      'DOWN',
    );

    expect(scheduleRes.status).toBe('MOVED');
    if (scheduleRes.status === 'MOVED') {
      // d-2 moves to slot 1 starting at 08:00 (45m -> 08:45)
      // d-1 moves to slot 2 preserving 15m gap (09:00 -> 11:00)
      // d-3 ripples forward to preserve 15m buffer after d-1 (11:15 -> 12:10)
      expect(scheduleRes.updates).toEqual([
        {
          id: 'd-2',
          visitOrder: 1,
          startTimeStr: '08:00',
          endTimeStr: '08:45',
          durationMinutes: 45,
        },
        {
          id: 'd-1',
          visitOrder: 2,
          startTimeStr: '09:00',
          endTimeStr: '11:00',
          durationMinutes: 120,
        },
        {
          id: 'd-3',
          visitOrder: 3,
          startTimeStr: '11:15',
          endTimeStr: '12:10',
          durationMinutes: 55,
        },
      ]);
    }

    prismaMock.itineraryDestination.findFirst.mockResolvedValueOnce({
      id: 'd-1',
      dayNumber: 1,
    });
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      {
        id: 'd-1',
        startTime: parseTimeOfDay('08:00'),
        endTime: parseTimeOfDay('10:00'),
        estimatedDurationMinutes: 120,
        visitOrder: 1,
      },
      {
        id: 'd-2',
        startTime: parseTimeOfDay('10:15'),
        endTime: parseTimeOfDay('11:00'),
        estimatedDurationMinutes: 45,
        visitOrder: 2,
      },
    ]);

    await service.moveActivityDirect('itin-1', 'd-1', 'DOWN');
    expect(prismaMock.itineraryDestination.update).toHaveBeenCalledTimes(2);

    prismaMock.itineraryDestination.findFirst.mockResolvedValueOnce({
      id: 'd-1',
      dayNumber: 1,
    });
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      {
        id: 'd-1',
        startTime: parseTimeOfDay('08:00'),
        endTime: parseTimeOfDay('10:00'),
        estimatedDurationMinutes: 120,
        visitOrder: 1,
      },
    ]);

    await expect(
      service.moveActivityDirect('itin-1', 'd-1', 'UP'),
    ).rejects.toThrow(BadRequestException);
  });
  it('moveActivityDirect only writes rows whose order or time actually changed', async () => {
    prismaMock.itineraryDestination.findFirst.mockResolvedValueOnce({
      id: 'd-1',
      dayNumber: 1,
    });
    prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
      {
        id: 'd-1',
        startTime: parseTimeOfDay('08:00'),
        endTime: parseTimeOfDay('10:00'),
        estimatedDurationMinutes: 120,
        visitOrder: 1,
      },
      {
        id: 'd-2',
        startTime: parseTimeOfDay('10:15'),
        endTime: parseTimeOfDay('11:00'),
        estimatedDurationMinutes: 45,
        visitOrder: 2,
      },
      {
        id: 'd-3',
        startTime: parseTimeOfDay('14:00'),
        endTime: parseTimeOfDay('15:00'),
        estimatedDurationMinutes: 60,
        visitOrder: 3,
      },
    ]);

    await service.moveActivityDirect('itin-1', 'd-1', 'DOWN');

    const writtenIds = prismaMock.itineraryDestination.update.mock.calls.map(
      (call: Array<{ where: { id: string } }>) => call[0].where.id,
    );
    expect(writtenIds).toEqual(['d-2', 'd-1']);
  });

  describe('searchPlacesForItinerary', () => {
    it('excludes scheduled places, filters noise & hotels by default, ranks by popularity, and truncates description', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([
        { placeId: 'already-in-trip' },
      ]);
      const longDesc = 'A'.repeat(160);
      prismaMock.place.findMany.mockResolvedValueOnce([
        {
          id: 'noise-1',
          name: 'Công ty TNHH Cho thuê xe máy Đà Nẵng',
          address: 'Đà Nẵng',
          ratingAvg: 5.0,
          reviewCount: 200,
          priceLevel: 'LOW',
          description: longDesc,
          tags: [],
          category: { slug: 'diem-tham-quan', name: 'Attraction', nameVi: 'Điểm tham quan' },
        },
        {
          id: 'hotel-1',
          name: 'Khách sạn Biển Xanh',
          address: 'Đà Nẵng',
          ratingAvg: 4.9,
          reviewCount: 500,
          priceLevel: 'MEDIUM',
          description: longDesc,
          tags: [],
          category: { slug: 'khach-san', name: 'Hotel', nameVi: 'Khách sạn' },
        },
        {
          id: 'veg-low-rev',
          name: 'Quán Chay Mới',
          address: '10 Lê Lợi',
          ratingAvg: 5.0,
          reviewCount: 1,
          priceLevel: 'LOW',
          description: longDesc,
          tags: ['chay'],
          category: { slug: 'nha-hang', name: 'Restaurant', nameVi: 'Nhà hàng' },
        },
        {
          id: 'veg-top',
          name: 'Quán Chay Liên Hoa',
          address: '49 Lê Hồng Phong',
          ratingAvg: 4.8,
          reviewCount: 900,
          priceLevel: 'LOW',
          description: longDesc,
          tags: ['chay'],
          category: { slug: 'nha-hang', name: 'Restaurant', nameVi: 'Nhà hàng' },
        },
      ]);

      const res = await service.searchPlacesForItinerary('itin-1', {
        query: 'quán chay nhé',
        categorySlug: 'nha-hang',
        limit: 5,
      });

      const queryArgs = prismaMock.place.findMany.mock.calls[0][0];
      expect(queryArgs.where.id).toEqual({ notIn: ['already-in-trip'] });
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('SUCCESS');
      const places = res.data?.places as Array<{ id: string; description?: string }>;
      expect(places.map((p) => p.id)).toEqual(['veg-top', 'veg-low-rev']);
      expect(places[0].description?.length).toBe(100);
    });

    it('allows lodging candidates when user explicitly asks for homestay or hotel', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      prismaMock.place.findMany.mockResolvedValueOnce([
        {
          id: 'homestay-1',
          name: 'Mộc Nhiên Homestay',
          address: 'Sơn Trà, Đà Nẵng',
          ratingAvg: 4.7,
          reviewCount: 120,
          priceLevel: 'MEDIUM',
          description: 'Homestay gần biển Mỹ Khê',
          tags: ['homestay'],
          category: { slug: 'homestay', name: 'Homestay', nameVi: 'Homestay' },
        },
      ]);

      const res = await service.searchPlacesForItinerary('itin-1', {
        query: 'homestay gần biển',
        categorySlug: 'homestay',
      });

      expect(res.success).toBe(true);
      const places = res.data?.places as Array<{ id: string }>;
      expect(places).toHaveLength(1);
      expect(places[0].id).toBe('homestay-1');
    });

    it('returns NO_MATCH cleanly when no places match the query', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      prismaMock.place.findMany.mockResolvedValueOnce([]);

      const res = await service.searchPlacesForItinerary(
        'itin-1',
        { query: 'quán không tồn tại' },
        'en',
      );

      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({ status: 'NO_MATCH', totalMatched: 0, places: [] });
      expect(res.message).toBe('No matching places were found in the trip area.');
    });

    it('resolves landmark anchor objectively inside tripBbox, filters by radiusKm & minRating, and sorts nearest-first with distanceKm', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      prismaMock.place.findMany
        // Anchor resolution query
        .mockResolvedValueOnce([
          {
            name: 'Cầu Rồng',
            nameNormalized: 'cau rong',
            latitude: 16.061,
            longitude: 108.227,
            reviewCount: 5000,
          },
        ])
        // Nearby place search query
        .mockResolvedValueOnce([
          {
            id: 'anchor-self',
            name: 'Cầu Rồng',
            address: 'Hải Châu, Đà Nẵng',
            latitude: 16.061,
            longitude: 108.227,
            ratingAvg: 4.9,
            reviewCount: 5000,
            priceLevel: 'LOW',
            tags: [],
            category: { slug: 'diem-tham-quan', name: 'Attraction', nameVi: 'Điểm tham quan' },
          },
          {
            id: 'cafe-corner-outside-circle',
            name: 'Cafe Ngoài Bán Kính',
            address: 'Góc rìa 2.6km',
            latitude: 16.078,
            longitude: 108.244,
            ratingAvg: 4.9,
            reviewCount: 999,
            priceLevel: 'MEDIUM',
            tags: ['cafe'],
            category: { slug: 'ca-phe', name: 'Cafe', nameVi: 'Cà phê' },
          },
          {
            id: 'cafe-farther',
            name: 'Cafe Cách 1.5km',
            address: '12 Bạch Đằng',
            latitude: 16.070,
            longitude: 108.216,
            ratingAvg: 4.9,
            reviewCount: 600,
            priceLevel: 'MEDIUM',
            tags: ['cafe'],
            category: { slug: 'ca-phe', name: 'Cafe', nameVi: 'Cà phê' },
          },
          {
            id: 'cafe-closest',
            name: 'Cafe Gần Cầu Rồng',
            address: '01 Trần Hưng Đạo',
            latitude: 16.063,
            longitude: 108.230,
            ratingAvg: 4.6,
            reviewCount: 80,
            priceLevel: 'LOW',
            tags: ['cafe'],
            category: { slug: 'ca-phe', name: 'Cafe', nameVi: 'Cà phê' },
          },
        ]);

      const res = await service.searchPlacesForItinerary('itin-1', {
        query: 'cafe',
        categorySlug: 'ca-phe',
        nearPlaceName: 'Cầu Rồng',
        radiusKm: 2,
        minRating: 4.5,
      });

      const searchWhere = prismaMock.place.findMany.mock.calls[1][0].where;
      expect(searchWhere.ratingAvg).toEqual({ gte: 4.5 });
      expect(res.data?.status).toBe('SUCCESS');
      expect(res.data?.anchorName).toBe('Cầu Rồng');
      expect(res.data?.radiusKm).toBe(2);
      const places = res.data?.places as Array<{ id: string; distanceKm?: number }>;
      expect(places.map((p) => p.id)).toEqual(['cafe-closest', 'cafe-farther']);
      expect(places[0].distanceKm).toBeLessThan(places[1].distanceKm!);
    });

    it('falls back to travelArea inside tripBbox when nearPlaceName matches a district/zone', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      prismaMock.place.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'zone-cafe-1',
            name: 'Cafe Bán Đảo Sơn Trà',
            address: 'Sơn Trà, Đà Nẵng',
            latitude: 16.102,
            longitude: 108.248,
            ratingAvg: 4.7,
            reviewCount: 150,
            priceLevel: 'MEDIUM',
            tags: ['cafe'],
            category: { slug: 'ca-phe', name: 'Cafe', nameVi: 'Cà phê' },
          },
        ]);
      prismaMock.travelArea.findMany.mockResolvedValueOnce([
        {
          name: 'Son Tra',
          nameVi: 'Sơn Trà',
          bboxMinLat: 16.08,
          bboxMaxLat: 16.12,
          bboxMinLng: 108.22,
          bboxMaxLng: 108.28,
        },
      ]);

      const res = await service.searchPlacesForItinerary('itin-1', {
        nearPlaceName: 'Sơn Trà',
        radiusKm: 5,
      });

      expect(res.data?.status).toBe('SUCCESS');
      expect(res.data?.anchorName).toBe('Sơn Trà');
      const places = res.data?.places as Array<{ id: string; distanceKm?: number }>;
      expect(places).toHaveLength(1);
      expect(places[0].id).toBe('zone-cafe-1');
      expect(typeof places[0].distanceKm).toBe('number');
    });

    it('returns fail-honest ANCHOR_NOT_FOUND when nearPlaceName does not exist in tripBbox', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      prismaMock.place.findMany.mockResolvedValueOnce([]);
      prismaMock.travelArea.findMany.mockResolvedValueOnce([]);

      const res = await service.searchPlacesForItinerary(
        'itin-1',
        { query: 'cafe', nearPlaceName: 'Tháp Eiffel' },
        'vi',
      );

      expect(prismaMock.place.findMany).toHaveBeenCalledTimes(1);
      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({
        status: 'ANCHOR_NOT_FOUND',
        anchorName: 'Tháp Eiffel',
        totalMatched: 0,
        places: [],
      });
    });

    it('clamps requested limit down to MAX_SEARCH_PLACES_LIMIT (10)', async () => {
      prismaMock.itineraryDestination.findMany.mockResolvedValueOnce([]);
      const candidates = Array.from({ length: 14 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `Quán ${i + 1}`,
        address: 'Đà Nẵng',
        ratingAvg: 4.8,
        reviewCount: 100 - i,
        priceLevel: 'MEDIUM',
        tags: [],
        category: { slug: 'nha-hang', name: 'Restaurant', nameVi: 'Nhà hàng' },
      }));
      prismaMock.place.findMany.mockResolvedValueOnce(candidates);

      const res = await service.searchPlacesForItinerary('itin-1', {
        limit: 20,
      });

      const places = res.data?.places as Array<{ id: string }>;
      expect(places).toHaveLength(10);
    });
  });
});
