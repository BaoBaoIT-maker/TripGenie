import {
  extractBrandKey,
  deduplicatePlacesByBrand,
  isLodgingCategory,
  isNonTouristicNoise,
  classifyActivityRole,
  selectBalancedCandidatePool,
} from './brand-key.util';

describe('brand-key.util', () => {
  it('reduces all 5 Tao Ngo branch variants (including Phu Yen suffix) to the same canonical key', () => {
    const variants = [
      'Lẩu Gà Lá É Tao Ngộ - 5 Đường 3/4',
      'Lẩu gà lá é Tao Ngộ - Chi nhánh 2',
      'Lẩu Gà Lá É Tao Ngộ (Cơ sở 3 Đà Lạt)',
      'Lẩu Gà Lá É Tao Ngộ, Phường 3, Đà Lạt',
      'Lẩu Gà Lá É Tao Ngộ Phú Yên',
    ];

    const keys = variants.map((v) => extractBrandKey(v));
    expect(new Set(keys)).toEqual(new Set(['lau ga la e tao ngo']));
  });

  it('deduplicates dining brand branches while keeping the first (highest-rated) and preserving attractions', () => {
    const candidates = [
      {
        id: 'tao-1',
        name: 'Lẩu Gà Lá É Tao Ngộ - Đường 3/4',
        nameNormalized: 'lau ga la e tao ngo - duong 3/4',
        ratingAvg: 4.8,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
      {
        id: 'tao-2',
        name: 'Lẩu Gà Lá É Tao Ngộ Phú Yên',
        nameNormalized: 'lau ga la e tao ngo phu yen',
        ratingAvg: 4.6,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
      {
        id: 'tao-3',
        name: 'Lẩu Gà Lá É Tao Ngộ - Lê Lai',
        nameNormalized: 'lau ga la e tao ngo - le lai',
        ratingAvg: 4.5,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
      {
        id: 'tao-4',
        name: 'Lẩu Gà Lá É Tao Ngộ Khu Hòa Bình',
        nameNormalized: 'lau ga la e tao ngo khu hoa binh',
        ratingAvg: 4.4,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
      {
        id: 'attr-1',
        name: 'Thác Datanla',
        nameNormalized: 'thac datanla',
        ratingAvg: 4.7,
        category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
      },
      {
        id: 'attr-2',
        name: 'Thác Datanla Máng Trượt',
        nameNormalized: 'thac datanla mang truot',
        ratingAvg: 4.6,
        category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên' },
      },
      {
        id: 'diff-1',
        name: 'Nhà Hàng Hoa Sen',
        nameNormalized: 'nha hang hoa sen',
        ratingAvg: 4.5,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
      {
        id: 'diff-2',
        name: 'Nhà Hàng Memory Đà Lạt',
        nameNormalized: 'nha hang memory da lat',
        ratingAvg: 4.5,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
    ];

    const deduped = deduplicatePlacesByBrand(candidates);
    expect(deduped.map((c) => c.id)).toEqual([
      'tao-1',
      'attr-1',
      'attr-2',
      'diff-1',
      'diff-2',
    ]);
  });

  it('correctly identifies lodging categories and excludes spa', () => {
    expect(isLodgingCategory({ slug: 'khach-san', nameVi: 'Khách sạn' })).toBe(
      true,
    );
    expect(isLodgingCategory({ slug: 'homestay', nameVi: 'Homestay' })).toBe(
      true,
    );
    expect(isLodgingCategory({ slug: 'spa', nameVi: 'Spa & Massage' })).toBe(
      false,
    );
    expect(isLodgingCategory({ slug: 'nha-hang', nameVi: 'Nhà hàng' })).toBe(
      false,
    );
  });

  it('classifies ActivityRole accurately and separates NIGHTLIFE and CAFE from MAIN_MEAL', () => {
    expect(
      classifyActivityRole({
        name: 'Bar Đồ Yêu - Authentic Vietnamese Cocktail',
        category: { slug: 'bar-pub', nameVi: 'Bar & Cuộc sống đêm' },
      }),
    ).toBe('NIGHTLIFE');

    expect(
      classifyActivityRole({
        name: 'Trà Sữa Nguyên Hương',
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng ẩm thực' },
      }),
    ).toBe('CAFE');

    expect(
      classifyActivityRole({
        name: 'Mỳ quảng - bánh tráng thịt heo Quê Mình',
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng ẩm thực' },
      }),
    ).toBe('MAIN_MEAL');

    expect(
      classifyActivityRole({
        name: 'Bà Nà Hills',
        category: { slug: 'diem-tham-quan', nameVi: 'Điểm tham quan' },
      }),
    ).toBe('ATTRACTION');
  });

  it('filters out non-touristic commercial noise and ranks high-review landmarks first in selectBalancedCandidatePool', () => {
    const raw = [
      {
        id: 'noise-car',
        name: 'Da Nang Private Car (Xe du lịch Đà Nẵng)',
        ratingAvg: 5.0,
        reviewCount: 142,
        category: { slug: 'diem-tham-quan', nameVi: 'Điểm tham quan' },
      },
      {
        id: 'noise-cam',
        name: 'ĐÀ THÀNH Camera Rental - Cho thuê máy ảnh',
        ratingAvg: 5.0,
        reviewCount: 516,
        category: { slug: 'diem-tham-quan', nameVi: 'Điểm tham quan' },
      },
      {
        id: 'tiny-shop',
        name: 'Quán Nước Nhỏ',
        ratingAvg: 5.0,
        reviewCount: 10,
        category: { slug: 'ca-phe', nameVi: 'Cà phê' },
      },
      {
        id: 'bana-hills',
        name: 'Bà Nà Hills',
        ratingAvg: 4.4,
        reviewCount: 99383,
        category: { slug: 'diem-tham-quan', nameVi: 'Điểm tham quan' },
      },
      {
        id: 'moc-quan',
        name: 'Mộc quán Seafood Đà Nẵng',
        ratingAvg: 4.8,
        reviewCount: 32424,
        category: { slug: 'nha-hang', nameVi: 'Nhà hàng' },
      },
    ];

    expect(isNonTouristicNoise(raw[0].name)).toBe(true);
    expect(isNonTouristicNoise(raw[1].name)).toBe(true);
    expect(isNonTouristicNoise(raw[3].name)).toBe(false);

    const pool = selectBalancedCandidatePool(raw, 10);
    expect(pool.map((p) => p.id)).toEqual([
      'moc-quan',
      'bana-hills',
      'tiny-shop',
    ]);
  });
});
