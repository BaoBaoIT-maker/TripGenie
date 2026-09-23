import { AddressNormalizerService } from './address-normalizer.service';
import { GeoJsonService } from './geojson.service';

describe('GeoModule Services (Unit Tests)', () => {
  let addressService: AddressNormalizerService;
  let geoJsonService: GeoJsonService;

  beforeEach(() => {
    addressService = new AddressNormalizerService();
    geoJsonService = new GeoJsonService();
  });

  describe('AddressNormalizerService', () => {
    it('should expand common abbreviations and normalize whitespace', () => {
      const raw = '123 Le Loi, Q.1, P. Ben Nghe, TPHCM, VN';
      const result = addressService.normalize(raw);
      expect(result).toContain('Quận 1');
      expect(result).toContain('Phường Ben Nghe');
      expect(result).toContain('Thành phố Hồ Chí Minh');
    });

    it('should remove accents correctly for fuzzy match', () => {
      expect(addressService.removeAccents('Đà Nẵng')).toBe('da nang');
      expect(addressService.removeAccents('Hải Châu')).toBe('hai chau');
    });
  });

  describe('GeoJsonService', () => {
    it('should validate coordinates in Vietnam territory', () => {
      expect(geoJsonService.isValidCoordinate(16.0544, 108.2022)).toBe(true); // Da Nang
      expect(geoJsonService.isValidCoordinate(35.6762, 139.6503)).toBe(false); // Tokyo (outside VN)
      expect(geoJsonService.isValidCoordinate(NaN, 108.2)).toBe(false);
    });

    it('should build GeoJSON FeatureCollection with [lng, lat] order', () => {
      const places = [
        {
          id: 'uuid-1',
          name: 'Cầu Rồng',
          address: 'Đường Nguyễn Văn Linh, Phước Ninh',
          latitude: 16.061,
          longitude: 108.223,
          ratingAvg: 4.8,
          reviewCount: 120,
        },
      ];

      const fc = geoJsonService.buildFeatureCollection(places);
      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features.length).toBe(1);
      // RFC 7946: [lng, lat]
      expect(fc.features[0].geometry.coordinates).toEqual([108.223, 16.061]);
      expect(fc.features[0].properties.name).toBe('Cầu Rồng');
    });
  });
});
