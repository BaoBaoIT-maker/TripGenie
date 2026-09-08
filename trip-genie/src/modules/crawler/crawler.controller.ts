import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrawlJobService } from './services/crawl-job.service';
import { TriggerRegionCrawlDto } from './dto/trigger-region-crawl.dto';

@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlJobService: CrawlJobService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('trigger')
  async triggerCrawl(@Body() dto: TriggerRegionCrawlDto, @Request() req: any) {
    return this.crawlJobService.triggerRegionCrawl(dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('jobs/:id')
  async getJobStatus(@Param('id') id: string) {
    return this.crawlJobService.getJobStatus(id);
  }
}
