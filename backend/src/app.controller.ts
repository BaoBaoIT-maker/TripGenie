import { Controller, Get, Head, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['', 'health'])
  @Head(['', 'health'])
  @HttpCode(HttpStatus.OK)
  checkHealth(): string {
    return this.appService.checkHealth();
  }
}
