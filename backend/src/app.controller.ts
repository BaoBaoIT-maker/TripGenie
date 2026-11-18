import { Controller, Head, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Head(['', 'health'])
  @HttpCode(HttpStatus.OK)
  checkHealth(): void {
    return this.appService.checkHealth();
  }
}
