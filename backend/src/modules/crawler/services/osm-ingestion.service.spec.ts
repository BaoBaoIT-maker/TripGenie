import { Test, TestingModule } from '@nestjs/testing';
import { OsmIngestionService } from './osm-ingestion.service';
import { DeduplicationService } from './deduplication.service';
import { INJECT_TOKENS } from '../../../common/constants/inject-tokens';
import { CrawlJobStatus, DataCoverageStatus, PlaceStatus } from '../../../common/enums/crawler.enum';

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

  const mockJob = { id: 'job-1', status: CrawlJobStatus.PENDING };

  const mockPlace = {
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

    osmProvider = { fetchByBbox: jest.fn().mockResolvedValue([mockPlace]) };
    deduplicationService = { findDuplicate: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OsmIngestionService,
        { provide: INJECT_TOKENS.OSM_PROVIDER, useValue: osmProvider },
        { provide: INJECT_TOKENS.CRAWLER_REPOSITORY, useValue: crawlerRepo },
        { provide: DeduplicationService, useValue: deduplicationService },
      ],
    }).compile();

    service = module.get<OsmIngestionService>(OsmIngestionService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should return early if job not found', async () => {
    crawlerRepo.getCrawlJobById.mockResolvedValue(null);
    await service.processArea('job-99', 1);
    expect(crawlerRepo.updateCrawlJob).not.toHaveBeenCalled();
  });

  it('should mark FAILED if area has no bbox', async () => {
    crawlerRepo.getAreaById.mockResolvedValue({ id: 1, name: 'X', bboxMinLat: null });
    await service.processArea('job-1', 1);
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith('job-1', { status: CrawlJobStatus.FAILED });
  });

  it('should INSERT new place and source when no duplicate found', async () => {
    deduplicationService.findDuplicate.mockResolvedValue(null);
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);

    await service.processArea('job-1', 1);

    expect(crawlerRepo.createPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Restaurant',
        nameNormalized: 'test restaurant',
        categoryId: 1,
        areaId: 1,
        status: PlaceStatus.ACTIVE,
      }),
    );
    expect(crawlerRepo.createPlaceSource).toHaveBeenCalled();
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: CrawlJobStatus.COMPLETED, insertedCount: 1, duplicateCount: 0 }),
    );
  });

  it('should skip INSERT and count duplicate when duplicate found', async () => {
    deduplicationService.findDuplicate.mockResolvedValue('existing-place-id');
    crawlerRepo.findPlaceSourceByExternal.mockResolvedValue(null);

    await service.processArea('job-1', 1);

    expect(crawlerRepo.createPlace).not.toHaveBeenCalled();
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: CrawlJobStatus.COMPLETED, insertedCount: 0, duplicateCount: 1 }),
    );
  });

  it('should increment errorCount when a single item fails', async () => {
    deduplicationService.findDuplicate.mockRejectedValue(new Error('DB timeout'));

    await service.processArea('job-1', 1);

    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: CrawlJobStatus.COMPLETED, errorCount: 1 }),
    );
  });

  it('should update data_coverage with PARTIAL status', async () => {
    await service.processArea('job-1', 1);
    expect(crawlerRepo.upsertDataCoverage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: DataCoverageStatus.PARTIAL }),
    );
  });

  it('should mark FAILED and record lastError on provider error', async () => {
    osmProvider.fetchByBbox.mockRejectedValue(new Error('Overpass timeout'));
    await service.processArea('job-1', 1);
    expect(crawlerRepo.updateCrawlJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: CrawlJobStatus.FAILED, lastError: 'Overpass timeout' }),
    );
  });
});
