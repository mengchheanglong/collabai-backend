import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailService } from './shared/services/email.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: 'EmailService',
          useValue: { activeBackend: 'resend' },
        },
      ],
    })
      .useMocker((token) => {
        if (token === EmailService || token === 'EmailService') {
          return { activeBackend: 'resend' };
        }
        return {};
      })
      .compile();

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
