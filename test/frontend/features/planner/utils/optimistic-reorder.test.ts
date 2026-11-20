import { describe, it, expect } from 'vitest';
import { swapStopsOptimistically } from '@/features/planner/utils/itinerary-schedule.util';
import type { ItineraryDetail, ItineraryActivity } from '@/types/itinerary';

function createMockActivity(id: string, name: string, visitOrder: number): ItineraryActivity {
  return {
    id,
    placeId: `place-${id}`,
    placeName: name,
    visitOrder,
    startTime: '08:00',
    endTime: '09:00',
    durationMinutes: 60,
    latitude: 16.0,
    longitude: 108.0,
    address: 'Đà Nẵng',
    imageUrl: null,
    categoryName: 'Tham quan',
    distanceToNextKm: 2.0,
    notes: null,
  };
}

function createMockItinerary(): ItineraryDetail {
  return {
    id: 'itin-1',
    title: 'Chuyến đi Đà Nẵng',
    description: 'Test',
    destination: 'Đà Nẵng',
    totalDays: 2,
    budgetLevel: 'MEDIUM',
    intercityTransit: null,
    budgetBreakdown: null,
    days: [
      {
        dayNumber: 1,
        theme: 'Khám phá bán đảo',
        activities: [
          createMockActivity('act-1', 'Chùa Linh Ứng', 1),
          createMockActivity('act-2', 'Bán đảo Sơn Trà', 2),
          createMockActivity('act-3', 'Biển Mỹ Khê', 3),
        ],
      },
      {
        dayNumber: 2,
        theme: 'Ngũ Hành Sơn',
        activities: [
          createMockActivity('act-4', 'Ngũ Hành Sơn', 1),
        ],
      },
    ],
  };
}

describe('swapStopsOptimistically', () => {
  it('swaps activity UP correctly and updates visitOrder', () => {
    const itinerary = createMockItinerary();
    const result = swapStopsOptimistically(itinerary, 'act-2', 'UP');

    const day1Activities = result.days[0].activities;
    expect(day1Activities[0].id).toBe('act-2');
    expect(day1Activities[0].visitOrder).toBe(1);
    expect(day1Activities[1].id).toBe('act-1');
    expect(day1Activities[1].visitOrder).toBe(2);
    expect(day1Activities[2].id).toBe('act-3');
    expect(day1Activities[2].visitOrder).toBe(3);

    // Day 2 untouched
    expect(result.days[1].activities[0].id).toBe('act-4');
  });

  it('swaps activity DOWN correctly and updates visitOrder', () => {
    const itinerary = createMockItinerary();
    const result = swapStopsOptimistically(itinerary, 'act-2', 'DOWN');

    const day1Activities = result.days[0].activities;
    expect(day1Activities[0].id).toBe('act-1');
    expect(day1Activities[0].visitOrder).toBe(1);
    expect(day1Activities[1].id).toBe('act-3');
    expect(day1Activities[1].visitOrder).toBe(2);
    expect(day1Activities[2].id).toBe('act-2');
    expect(day1Activities[2].visitOrder).toBe(3);
  });

  it('does nothing when trying to move the first activity UP (boundary guard)', () => {
    const itinerary = createMockItinerary();
    const result = swapStopsOptimistically(itinerary, 'act-1', 'UP');

    expect(result).toBe(itinerary);
    expect(result.days[0].activities[0].id).toBe('act-1');
  });

  it('does nothing when trying to move the last activity DOWN (boundary guard)', () => {
    const itinerary = createMockItinerary();
    const result = swapStopsOptimistically(itinerary, 'act-3', 'DOWN');

    expect(result).toBe(itinerary);
    expect(result.days[0].activities[2].id).toBe('act-3');
  });

  it('does nothing when destinationId does not exist', () => {
    const itinerary = createMockItinerary();
    const result = swapStopsOptimistically(itinerary, 'non-existent-id', 'UP');

    expect(result).toBe(itinerary);
  });

  it('does nothing for single activity days', () => {
    const itinerary = createMockItinerary();
    const resultUp = swapStopsOptimistically(itinerary, 'act-4', 'UP');
    const resultDown = swapStopsOptimistically(itinerary, 'act-4', 'DOWN');

    expect(resultUp).toBe(itinerary);
    expect(resultDown).toBe(itinerary);
  });
});
