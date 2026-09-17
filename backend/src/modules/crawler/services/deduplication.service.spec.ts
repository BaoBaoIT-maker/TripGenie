import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeduplicationService } from './deduplication.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  let crawlerRepo: any;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(50), // DEDUP_RADIUS_METERS = 50
  };

  beforeEach(async () => {
    crawlerRepo = {
      findPlaceSourceByExternal: jest.fn(),
      findNearbyPlaces: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        { provide: INJECT_TOKENS.CRAWLER_REPOSITORY, useValue: crawlerRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DeduplicationService>(DeduplicationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return existing placeId on exact source match', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue({ placeId: 'place-123' });

    const result = await service.findDuplicate({
      externalId: 'ext1', provider: 'osm', name: 'Test',
      nameNormalized: 'test', latitude: 10, longitude: 20,
      address: null, description: null, categorySlug: 'nha-hang',
      tags: [], sourceData: {},
    });

    expect(result).toBe('place-123');
    expect(crawlerRepo.findPlaceSourceByExternal).toHaveBeenCalledWith('osm', 'ext1');
    expect(crawlerRepo.findNearbyPlaces).not.toHaveBeenCalled();
  });

  it('should return nearby placeId on spatial+lexical match', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);
    crawlerRepo.findNearbyPlaces.mockResolvedValue([
      { id: 'place-456', name: 'Test Place', name_normalized: 'test place' },
    ]);

    const result = await service.findDuplicate({
      externalId: 'ext1', provider: 'osm', name: 'Test Place',
      nameNormalized: 'test place', latitude: 10, longitude: 20,
      address: null, description: null, categorySlug: 'nha-hang',
      tags: [], sourceData: {},
    });

    expect(result).toBe('place-456');
    expect(crawlerRepo.findNearbyPlaces).toHaveBeenCalledWith(10, 20, 50);
  });

  it('should return null when no duplicate found', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);
    crawlerRepo.findNearbyPlaces.mockResolvedValue([
      { id: 'place-789', name: 'Other Place', name_normalized: 'other place' },
    ]);

    const result = await service.findDuplicate({
      externalId: 'ext1', provider: 'osm', name: 'Test',
      nameNormalized: 'test', latitude: 10, longitude: 20,
      address: null, description: null, categorySlug: 'nha-hang',
      tags: [], sourceData: {},
    });

    expect(result).toBeNull();
  });
});
