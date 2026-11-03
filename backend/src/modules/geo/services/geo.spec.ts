import { GeoJsonService } from './geojson.service';

describe('GeoModule Services (Unit Tests)', () => {
  let geoJsonService: GeoJsonService;

  beforeEach(() => {
    geoJsonService = new GeoJsonService();
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
