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

  it('parses pure category query without extra keywords ("quán cafe", "cafe")', () => {
    const res1 = parseSearchQuery('quán cafe');
    expect(res1.categorySlug).toBe('ca-phe');
    expect(res1.cleanedKeyword).toBe('');

    const res2 = parseSearchQuery('cafe');
    expect(res2.categorySlug).toBe('ca-phe');
    expect(res2.cleanedKeyword).toBe('');
  });

  it('parses category + administrative area ("quán cafe ở Đà Nẵng", "khách sạn tại Hải Châu")', () => {
    const res1 = parseSearchQuery('quán cafe ở Đà Nẵng');
    expect(res1.categorySlug).toBe('ca-phe');
    expect(res1.areaName).toBe('Đà Nẵng');
    expect(res1.cleanedKeyword).toBe('');

    const res2 = parseSearchQuery('khách sạn view biển ở Đà Nẵng');
    expect(res2.categorySlug).toBe('khach-san');
    expect(res2.areaName).toBe('Đà Nẵng');
    expect(res2.cleanedKeyword).toBe('view biển');

    const res3 = parseSearchQuery('hotels in Da Nang');
    expect(res3.categorySlug).toBe('khach-san');
    expect(res3.areaName).toBe('Da Nang');
    expect(res3.cleanedKeyword).toBe('');
  });
});
