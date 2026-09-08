import { Test, TestingModule } from '@nestjs/testing';
import { DeduplicationService } from './deduplication.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  let crawlerRepo: any;

  beforeEach(async () => {
    crawlerRepo = {
      findPlaceSourceByExternal: jest.fn(),
      findNearbyPlaces: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        {
          provide: INJECT_TOKENS.CRAWLER_REPOSITORY,
          useValue: crawlerRepo,
        },
      ],
    }).compile();

    service = module.get<DeduplicationService>(DeduplicationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return existing place id if exact source match found', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue({ placeId: '123' });

    const result = await service.findDuplicate({
      externalId: 'ext1',
      provider: 'osm',
      name: 'Test',
      nameNormalized: 'test',
      latitude: 10,
      longitude: 20,
      address: null,
      description: null,
      categorySlug: 'cat1',
      tags: [],
      sourceData: {},
    });

    expect(result).toBe('123');
    expect(crawlerRepo.findPlaceSourceByExternal).toHaveBeenCalledWith('osm', 'ext1');
    expect(crawlerRepo.findNearbyPlaces).not.toHaveBeenCalled();
  });

  it('should return nearby place id if fuzzy name matches', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);
    crawlerRepo.findNearbyPlaces.mockResolvedValue([
      { id: '456', name: 'Test Place', name_normalized: 'test place' },
    ]);

    const result = await service.findDuplicate({
      externalId: 'ext1',
      provider: 'osm',
      name: 'Test Place',
      nameNormalized: 'test place',
      latitude: 10,
      longitude: 20,
      address: null,
      description: null,
      categorySlug: 'cat1',
      tags: [],
      sourceData: {},
    });

    expect(result).toBe('456');
    expect(crawlerRepo.findNearbyPlaces).toHaveBeenCalled();
  });

  it('should return null if no duplicate found', async () => {
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);
    crawlerRepo.findNearbyPlaces.mockResolvedValue([
      { id: '456', name: 'Other', name_normalized: 'other' },
    ]);

    const result = await service.findDuplicate({
      externalId: 'ext1',
      provider: 'osm',
      name: 'Test',
      nameNormalized: 'test',
      latitude: 10,
      longitude: 20,
      address: null,
      description: null,
      categorySlug: 'cat1',
      tags: [],
      sourceData: {},
    });

    expect(result).toBeNull();
  });
});
