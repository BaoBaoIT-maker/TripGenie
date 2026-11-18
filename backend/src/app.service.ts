import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  checkHealth(): void {
    // Server is up and running
  }
}
