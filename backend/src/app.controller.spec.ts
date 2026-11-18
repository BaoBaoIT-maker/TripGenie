import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health (HEAD)', () => {
    it('should be defined and return void', () => {
      expect(appController.checkHealth).toBeDefined();
      expect(appController.checkHealth()).toBeUndefined();
    });
  });
});
