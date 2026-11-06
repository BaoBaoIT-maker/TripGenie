import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { CrawlerController } from './crawler.controller';
import { CrawlJobService } from './services/crawl-job.service';
import { CrawlerQueueName } from '../../common/enums/crawler.enum';

describe('CrawlerController', () => {
  let controller: CrawlerController;
  let crawlJobService: any;
  let enrichQueue: any;

  beforeEach(async () => {
    crawlJobService = {
      triggerRegionCrawl: jest.fn(),
      getJobStatus: jest.fn(),
    };

    enrichQueue = {
      add: jest.fn().mockResolvedValue({ id: 'enrich-job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrawlerController],
      providers: [
        { provide: CrawlJobService, useValue: crawlJobService },
        { provide: getQueueToken(CrawlerQueueName.ENRICH), useValue: enrichQueue },
      ],
    }).compile();

    controller = module.get<CrawlerController>(CrawlerController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /crawler/trigger', () => {
    it('should return TriggerCrawlResponseDto on success', async () => {
      const mockResult = { message: 'Crawl job started successfully', jobId: 'job-1', area: 'Da Nang' };
      crawlJobService.triggerRegionCrawl.mockResolvedValue(mockResult);

      const result = await controller.triggerCrawl(
        { areaId: 1 },
        { user: { id: 'user-1', role: 'ADMIN' } },
      );

      expect(result).toEqual(mockResult);
      expect(crawlJobService.triggerRegionCrawl).toHaveBeenCalledWith({ areaId: 1 }, 'user-1');
    });

    it('should propagate NotFoundException when area not found', async () => {
      crawlJobService.triggerRegionCrawl.mockRejectedValue(new NotFoundException('Area not found'));
      await expect(
        controller.triggerCrawl({ areaId: 999 }, { user: { id: 'user-1', role: 'ADMIN' } }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /crawler/enrich', () => {
    it('should push enrichment job to BullMQ queue and return jobId', async () => {
      const result = await controller.triggerEnrichment({ areaId: 1, limit: 10 });

      expect(result).toEqual({
        message: 'Enrichment job queued for area 1',
        jobId: 'enrich-job-1',
      });
      expect(enrichQueue.add).toHaveBeenCalledWith(
        'area-enrich',
        { areaId: 1, limit: 10 },
        expect.any(Object),
      );
    });
  });

  describe('GET /crawler/jobs/:id', () => {
    it('should return CrawlJobStatusDto on success', async () => {
      const mockJob = { id: 'job-1', status: 'COMPLETED', processedItems: 100, insertedCount: 80 };
      crawlJobService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual(mockJob);
      expect(crawlJobService.getJobStatus).toHaveBeenCalledWith('job-1');
    });

    it('should propagate NotFoundException when job not found', async () => {
      crawlJobService.getJobStatus.mockRejectedValue(new NotFoundException('Job not found'));
      await expect(controller.getJobStatus('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
