import {
  selectDefaultLodging,
  buildLodgingSuggestions,
  LodgingCandidate,
} from './lodging-selector';

describe('lodging-selector', () => {
  const centroid = { lat: 11.94, lng: 108.44 };

  const candidates: LodgingCandidate[] = [
    {
      id: 'hotel-central-mid',
      name: 'Khách sạn Trung Tâm Đà Lạt',
      latitude: 11.941,
      longitude: 108.441,
      ratingAvg: 4.6,
      reviewCount: 150,
      priceLevel: 'MEDIUM',
      category: { slug: 'khach-san', nameVi: 'Khách sạn' },
    },
    {
      id: 'hotel-far-luxury',
      name: 'Resort Xa Trung Tâm',
      latitude: 12.01,
      longitude: 108.5,
      ratingAvg: 4.9,
      reviewCount: 300,
      priceLevel: 'LUXURY',
      category: { slug: 'khach-san', nameVi: 'Khách sạn' },
    },
    {
      id: 'homestay-near',
      name: 'Homestay Ấm Áp',
      latitude: 11.9405,
      longitude: 108.4402,
      ratingAvg: 4.4,
      reviewCount: 40,
      priceLevel: 'LOW',
      category: { slug: 'homestay', nameVi: 'Homestay' },
    },
    {
      id: 'spa-ignored',
      name: 'Spa Thư Giãn',
      latitude: 11.94,
      longitude: 108.44,
      ratingAvg: 5.0,
      reviewCount: 500,
      priceLevel: 'MEDIUM',
      category: { slug: 'spa', nameVi: 'Spa' },
    },
  ];

  it('selects the best-matching lodging for MEDIUM budget and ignores spa', () => {
    const winner = selectDefaultLodging(candidates, {
      budgetLevel: 'MEDIUM',
      referenceCoord: centroid,
    });

    expect(winner).not.toBeNull();
    expect(winner?.place.id).toBe('hotel-central-mid');
  });

  it('returns 3 suggestion groups and excludes currentPlaceId', () => {
    const groups = buildLodgingSuggestions(candidates, {
      budgetLevel: 'MEDIUM',
      dayCentroid: centroid,
      currentPlaceId: 'hotel-central-mid',
      limit: 5,
    });

    expect(groups.nearest.map((x) => x.place.id)).not.toContain(
      'hotel-central-mid',
    );
    expect(groups.nearest.map((x) => x.place.id)).not.toContain('spa-ignored');
    expect(groups.nearest[0].place.id).toBe('homestay-near');
    expect(groups.topRated[0].place.id).toBe('hotel-far-luxury');
  });
});
