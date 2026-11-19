import { clusterPlacesByDay } from './day-clustering';

describe('day-clustering', () => {
  const fallback = { lat: 11.9404, lng: 108.4583 };

  const samplePlaces = [
    // North cluster (Langbiang area ~12.00, 108.44)
    {
      id: 'n1',
      name: 'Đỉnh Langbiang',
      latitude: 12.004,
      longitude: 108.438,
      ratingAvg: 4.8,
      category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
    },
    {
      id: 'n2',
      name: 'Thung Lũng Vàng',
      latitude: 12.012,
      longitude: 108.415,
      ratingAvg: 4.6,
      category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
    },
    {
      id: 'n3',
      name: 'Nhà Hàng Langbiang',
      latitude: 12.001,
      longitude: 108.441,
      ratingAvg: 4.5,
      category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
    },
    {
      id: 'n4',
      name: 'Quán Nướng Lạc Dương',
      latitude: 12.006,
      longitude: 108.439,
      ratingAvg: 4.4,
      category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
    },
    // South cluster (Tuyền Lâm / Datanla ~11.90, 108.44)
    {
      id: 's1',
      name: 'Hồ Tuyền Lâm',
      latitude: 11.902,
      longitude: 108.435,
      ratingAvg: 4.8,
      category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
    },
    {
      id: 's2',
      name: 'Thác Datanla',
      latitude: 11.901,
      longitude: 108.449,
      ratingAvg: 4.7,
      category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
    },
    {
      id: 's3',
      name: 'Nhà Hàng Cơm Niêu Tuyền Lâm',
      latitude: 11.905,
      longitude: 108.442,
      ratingAvg: 4.5,
      category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
    },
    {
      id: 's4',
      name: 'Quán Gà Nướng Tuyền Lâm',
      latitude: 11.899,
      longitude: 108.439,
      ratingAvg: 4.4,
      category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
    },
  ];

  it('produces deterministic clusters for identical input and separates North vs South groups', () => {
    const firstRun = clusterPlacesByDay({
      places: samplePlaces,
      totalDays: 2,
      maxStopsPerDay: 4,
      fallbackCoord: fallback,
      anchorCoord: { lat: 11.905, lng: 108.44 }, // near South cluster
    });

    const secondRun = clusterPlacesByDay({
      places: samplePlaces,
      totalDays: 2,
      maxStopsPerDay: 4,
      fallbackCoord: fallback,
      anchorCoord: { lat: 11.905, lng: 108.44 },
    });

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toHaveLength(2);
    // Day 1 should be South cluster because anchorCoord is near 11.905
    expect(firstRun[0].places.map((p) => p.id).sort()).toEqual([
      's1',
      's2',
      's3',
      's4',
    ]);
    expect(firstRun[1].places.map((p) => p.id).sort()).toEqual([
      'n1',
      'n2',
      'n3',
      'n4',
    ]);
  });
});
