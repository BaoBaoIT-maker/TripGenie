import { parseSearchQuery } from './search-query-parser.util';

describe('search-query-parser.util', () => {
  it('parses category + landmark anchor ("khách sạn view biển gần Mỹ Khê")', () => {
    const res = parseSearchQuery('khách sạn view biển gần Mỹ Khê');
    expect(res.categorySlug).toBe('khach-san');
    expect(res.landmarkAnchor).toBe('Mỹ Khê');
    expect(res.cleanedKeyword).toBe('view biển');
    expect(res.isNearbyIntent).toBe(false);
  });

  it('parses category + landmark + distance ("quán cafe gần Cầu Rồng trong khoảng 2km")', () => {
    const res = parseSearchQuery('quán cafe gần Cầu Rồng trong khoảng 2km');
    expect(res.categorySlug).toBe('ca-phe');
    expect(res.landmarkAnchor).toBe('Cầu Rồng');
    expect(res.extractedRadiusMeters).toBe(2000);
    expect(res.cleanedKeyword).toBe('');
    expect(res.isNearbyIntent).toBe(false);
  });

  it('parses nearby device query ("quán ăn quanh đây")', () => {
    const res = parseSearchQuery('quán ăn quanh đây');
    expect(res.categorySlug).toBe('nha-hang');
    expect(res.isNearbyIntent).toBe(true);
    expect(res.landmarkAnchor).toBeUndefined();
    expect(res.cleanedKeyword).toBe('');
  });

  it('parses English queries ("hotels near beach within 5km")', () => {
    const res = parseSearchQuery('hotels near beach within 5km');
    expect(res.categorySlug).toBe('khach-san');
    expect(res.landmarkAnchor).toBe('beach');
    expect(res.extractedRadiusMeters).toBe(5000);
    expect(res.isNearbyIntent).toBe(false);
  });

  it('handles raw specific name ("Bà Nà Hills")', () => {
    const res = parseSearchQuery('Bà Nà Hills');
    expect(res.categorySlug).toBeUndefined();
    expect(res.landmarkAnchor).toBeUndefined();
    expect(res.cleanedKeyword).toBe('Bà Nà Hills');
    expect(res.isNearbyIntent).toBe(false);
  });
});
