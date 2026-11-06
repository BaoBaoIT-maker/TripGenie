import { CopilotToolsService } from './copilot-tools.service';
import { PrismaService } from '../../../database/prisma.service';
import { parseTimeOfDay } from '../../../common/utils/time-of-day.util';
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
    place: { findUnique: jest.Mock };
    itineraryDestination: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    itinerary: { update: jest.Mock };
  };
  let service: CopilotToolsService;

  beforeEach(() => {
    prismaMock = {
      place: {
        findUnique: jest.fn().mockResolvedValue(mockPlace),
      },
      itineraryDestination: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'dest-new' }),
      },
      itinerary: {
        update: jest.fn().mockResolvedValue({ id: 'itin-1' }),
      },
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

    expect(afterAddingSightseeingAndDining.tickets).toBe(initial.tickets + 250000);
    expect(afterAddingSightseeingAndDining.food).toBeGreaterThan(initial.food);
  });
});
