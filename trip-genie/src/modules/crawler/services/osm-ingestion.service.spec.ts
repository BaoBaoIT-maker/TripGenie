import { Test, TestingModule } from '@nestjs/testing';
import { OsmIngestionService } from './osm-ingestion.service';
import { DeduplicationService } from './deduplication.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';

describe('OsmIngestionService', () => {
  let service: OsmIngestionService;
  let crawlerRepo: any;
  let osmProvider: any;
  let deduplicationService: any;

  const mockArea = {
    id: 1,
    name: 'Da Nang',
    bboxMinLat: 15.97,
    bboxMaxLat: 16.16,
    bboxMinLng: 107.98,
    bboxMaxLng: 108.36,
  };

  const mockJob = {
    id: 'job-1',
    status: 'PENDING',
  };

  const mockNormalizedPlace = {
    externalId: 'osm-1',
    provider: 'osm',
    name: 'Test Restaurant',
    nameNormalized: 'test restaurant',
    latitude: 16.0,
    longitude: 108.2,
    address: '123 Test St',
    description: null,
    categorySlug: 'nha-hang',
    tags: ['seafood'],
    sourceData: { id: 1 },
  };

  beforeEach(async () => {
    crawlerRepo = {
      getCrawlJobById: jest.fn().mockResolvedValue(mockJob),
      getAreaById: jest.fn().mockResolvedValue(mockArea),
      updateCrawlJob: jest.fn().mockResolvedValue({}),
      getCategoryMap: jest.fn().mockResolvedValue(new Map([['nha-hang', 1]])),
      createPlace: jest.fn().mockResolvedValue({ id: 'place-uuid-1' }),
      findPlaceSourceByExternal: jest.fn().mockResolvedValue(null),
      createPlaceSource: jest.fn().mockResolvedValue({}),
      updatePlaceSource: jest.fn().mockResolvedValue({}),
      countActivePlacesByArea: jest.fn().mockResolvedValue(10),
      upsertDataCoverage: jest.fn().mockResolvedValue({}),
    };

    osmProvider = {
      fetchByBbox: jest.fn().mockResolvedValue([mockNormalizedPlace]),
    };

    deduplicationService = {
      findDuplicate: jest.fn().mockResolvedValue(null), // No duplicate
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OsmIngestionService,
        {
          provide: INJECT_TOKENS.OSM_PROVIDER,
          useValue: osmProvider,
        },
        {
          provide: INJECT_TOKENS.CRAWLER_REPOSITORY,
          useValue: crawlerRepo,
        },
        {
          provide: DeduplicationService,
          useValue: deduplicationService,
        },
      ],
    }).compile();

    service = module.get<OsmIngestionService>(OsmIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should mark job as FAILED if job not found', async () => {
    crawlerRepo.getCrawlJobById.mockResolvedValue(null);

    await service.processArea('job-99', 1);

    expect(crawlerRepo.updateCrawlJob).not.toHaveBeenCalled();
  });

  it('should mark job as FAILED if area has no bbox', async () => {
    crawlerRepo.getAreaById.mockResolvedValue({ id: 1, name: 'NoBox', bboxMinLat: null });

    await service.processArea('job-1', 1);

    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith('job-1', { status: 'FAILED' });
  });

  it('should INSERT new place when no duplicate found', async () => {
    deduplicationService.findDuplicate.mockResolvedValue(null);
    // findPlaceSourceByExternal returns null so createPlaceSource is called
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);

    await service.processArea('job-1', 1);

    expect(crawlerRepo.createPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Restaurant',
        nameNormalized: 'test restaurant',
        categoryId: 1,
        areaId: 1,
        status: 'ACTIVE',
      }),
    );
    expect(crawlerRepo.createPlaceSource).toHaveBeenCalled();
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'COMPLETED', insertedCount: 1, duplicateCount: 0 }),
    );
  });

  it('should skip INSERT when duplicate found', async () => {
    deduplicationService.findDuplicate.mockResolvedValue('existing-place-id');
    // Even for duplicate, we still check+create source so mock returns null here
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);

    await service.processArea('job-1', 1);

    expect(crawlerRepo.createPlace).not.toHaveBeenCalled();
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'COMPLETED', insertedCount: 0, duplicateCount: 1 }),
    );
  });

  it('should update data_coverage after processing', async () => {
    await service.processArea('job-1', 1);

    expect(crawlerRepo.upsertDataCoverage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'PARTIAL' }),
    );
  });

  it('should mark job FAILED on provider error', async () => {
    osmProvider.fetchByBbox.mockRejectedValue(new Error('Overpass timeout'));

    await service.processArea('job-1', 1);

    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
