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

  describe('root', () => {
    it('should return a friendly service banner with docs + health links', () => {
      expect(appController.getHello()).toEqual({
        message: 'CollabAI API is running',
        docs: '/api/docs',
        health: '/api/v1/health',
      });
    });
  });
});
