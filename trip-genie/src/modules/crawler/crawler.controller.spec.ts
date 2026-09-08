import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerController } from './crawler.controller';
import { CrawlJobService } from './services/crawl-job.service';

describe('CrawlerController', () => {
  let controller: CrawlerController;
  let crawlJobService: any;

  beforeEach(async () => {
    crawlJobService = {
      triggerRegionCrawl: jest.fn(),
      getJobStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrawlerController],
      providers: [
        {
          provide: CrawlJobService,
          useValue: crawlJobService,
        },
      ],
    }).compile();

    controller = module.get<CrawlerController>(CrawlerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /crawler/trigger', () => {
    it('should trigger a crawl job and return job info', async () => {
      const mockResult = { message: 'Crawl job started', jobId: 'job-1', area: 'Da Nang' };
      crawlJobService.triggerRegionCrawl.mockResolvedValue(mockResult);

      const dto = { areaId: 1 };
      const req = { user: { id: 'user-1' } };

      const result = await controller.triggerCrawl(dto, req);

      expect(result).toEqual(mockResult);
      expect(crawlJobService.triggerRegionCrawl).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('GET /crawler/jobs/:id', () => {
    it('should return job status', async () => {
      const mockJob = { id: 'job-1', status: 'COMPLETED', processedItems: 100 };
      crawlJobService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual(mockJob);
      expect(crawlJobService.getJobStatus).toHaveBeenCalledWith('job-1');
    });

    it('should throw error if job not found', async () => {
      crawlJobService.getJobStatus.mockRejectedValue(new Error('Job not found'));

      await expect(controller.getJobStatus('invalid-id')).rejects.toThrow('Job not found');
    });
  });
});
