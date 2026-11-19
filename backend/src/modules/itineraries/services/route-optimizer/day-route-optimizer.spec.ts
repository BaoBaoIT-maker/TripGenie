import { optimizeDayRoute, OptimizableActivity } from './day-route-optimizer';

describe('day-route-optimizer', () => {
  it('reorders free sightseeing slots to eliminate zigzag while keeping lunch locked in the meal slot', () => {
    // Lodging at (11.940, 108.440)
    const lodging = { lat: 11.94, lng: 108.44 };

    // Intentional zigzag order from LLM:
    // Slot 1 (08:30 FREE): Far North (12.00, 108.44)
    // Slot 2 (10:15 FREE): Near Lodging (11.945, 108.44)
    // Slot 3 (12:00 MEAL): Restaurant in Middle (11.97, 108.44)
    // Slot 4 (14:30 FREE): Near North (11.995, 108.44)
    const zigzagActivities: OptimizableActivity[] = [
      {
        placeId: 'far-north',
        placeName: 'Đỉnh Langbiang',
        startTime: '08:30',
        endTime: '10:00',
        durationMinutes: 90,
        visitOrder: 1,
        latitude: 12.0,
        longitude: 108.44,
        isDining: false,
      },
      {
        placeId: 'near-lodging',
        placeName: 'Hồ Xuân Hương',
        startTime: '10:15',
        endTime: '11:30',
        durationMinutes: 75,
        visitOrder: 2,
        latitude: 11.945,
        longitude: 108.44,
        isDining: false,
      },
      {
        placeId: 'mid-lunch',
        placeName: 'Nhà Hàng Giữa Đường',
        startTime: '12:00',
        endTime: '13:15',
        durationMinutes: 75,
        visitOrder: 3,
        latitude: 11.97,
        longitude: 108.44,
        isDining: true,
      },
      {
        placeId: 'near-north',
        placeName: 'Thung Lũng Vàng',
        startTime: '14:30',
        endTime: '16:30',
        durationMinutes: 120,
        visitOrder: 4,
        latitude: 11.995,
        longitude: 108.44,
        isDining: false,
      },
    ];

    const optimized = optimizeDayRoute({
      activities: zigzagActivities,
      startAnchor: lodging,
      endAnchor: lodging,
    });

    // Lunch stays at slot index 2 (12:00-13:15)
    expect(optimized[2].placeId).toBe('mid-lunch');
    expect(optimized[2].startTime).toBe('12:00');

    // Near-lodging (11.945) should be visited either first (slot 0) or last (slot 3),
    // while far-north (12.00) and near-north (11.995) are grouped together on the northern leg!
    const ids = optimized.map((a) => a.placeId);
    const northAdjacent =
      (ids[0] === 'far-north' && ids[1] === 'near-north') ||
      (ids[0] === 'near-north' && ids[1] === 'far-north');
    expect(northAdjacent).toBe(true);
    expect(optimized.map((a) => a.visitOrder)).toEqual([1, 2, 3, 4]);
  });

  it('penalizes places that are CLOSED at a slot time and swaps them to an open slot', () => {
    const activities: OptimizableActivity[] = [
      {
        placeId: 'night-market',
        placeName: 'Chợ Đêm Đà Lạt',
        startTime: '08:30',
        endTime: '10:00',
        durationMinutes: 90,
        visitOrder: 1,
        latitude: 11.942,
        longitude: 108.436,
        isDining: false,
        openingHours: { raw: 'Mo-Su 17:00-23:00' },
      },
      {
        placeId: 'morning-pagoda',
        placeName: 'Chùa Linh Phước',
        startTime: '18:00',
        endTime: '19:30',
        durationMinutes: 90,
        visitOrder: 2,
        latitude: 11.944,
        longitude: 108.5,
        isDining: false,
        openingHours: { raw: 'Mo-Su 07:00-16:30' },
      },
    ];

    const optimized = optimizeDayRoute({
      activities,
      dayDate: '2026-11-18',
    });

    expect(optimized[0].placeId).toBe('morning-pagoda');
    expect(optimized[0].startTime).toBe('08:30');
    expect(optimized[1].placeId).toBe('night-market');
    expect(optimized[1].startTime).toBe('18:00');
  });

  it('never swaps a NIGHTLIFE bar into breakfast (07:30) or MAIN_MEAL into morning sightseeing (08:30) even when bar is next to the hotel', () => {
    const hotel = { lat: 16.0616, lng: 108.2185 };

    // Bar is 0.17km from hotel, but must stay locked at 20:30 NIGHT slot!
    const day1: OptimizableActivity[] = [
      {
        placeId: 'bar-do-yeu',
        placeName: 'Bar Đồ Yêu - Authentic Vietnamese Cocktail',
        startTime: '07:30',
        endTime: '08:30',
        durationMinutes: 60,
        visitOrder: 1,
        latitude: 16.0629,
        longitude: 108.2195,
        isDining: true,
        category: { slug: 'bar-pub', nameVi: 'Bar & Cuộc sống đêm' },
      },
      {
        placeId: 'my-quang',
        placeName: 'Mỳ quảng - bánh tráng thịt heo Quê Mình',
        startTime: '08:30',
        endTime: '11:00',
        durationMinutes: 150,
        visitOrder: 2,
        latitude: 16.0539,
        longitude: 108.2325,
        isDining: true,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng ẩm thực' },
      },
      {
        placeId: 'bun-cha-ca',
        placeName: 'Bún Chả Cá Má Hai',
        startTime: '11:30',
        endTime: '13:15',
        durationMinutes: 105,
        visitOrder: 3,
        latitude: 16.0552,
        longitude: 108.2352,
        isDining: true,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng ẩm thực' },
      },
      {
        placeId: 'bao-tang-cham',
        placeName: 'Bảo tàng Điêu khắc Chăm Đà Nẵng',
        startTime: '20:30',
        endTime: '22:00',
        durationMinutes: 90,
        visitOrder: 4,
        latitude: 16.0604,
        longitude: 108.2235,
        isDining: false,
        category: { slug: 'di-tich-lich-su', nameVi: 'Di tích lịch sử' },
      },
    ];

    const optimized = optimizeDayRoute({
      activities: day1,
      startAnchor: hotel,
      endAnchor: hotel,
    });

    // 07:30 (BREAKFAST) and 11:30 (LUNCH) get the two MAIN_MEAL places
    expect(['my-quang', 'bun-cha-ca']).toContain(optimized[0].placeId);
    expect(['my-quang', 'bun-cha-ca']).toContain(optimized[2].placeId);
    // 08:30 (MORNING_ACTIVITY) gets the ATTRACTION (Bảo tàng Chăm)
    expect(optimized[1].placeId).toBe('bao-tang-cham');
    // 20:30 (NIGHT) gets the NIGHTLIFE bar (Bar Đồ Yêu)
    expect(optimized[3].placeId).toBe('bar-do-yeu');
  });
});
