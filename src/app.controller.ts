import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { EmailService } from './shared/services/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  getHello(): { message: string; docs: string; health: string } {
    // Friendly root banner — a raw "Cannot GET /" here looks like an outage.
    return {
      message: 'CollabAI API is running',
      docs: '/api/docs',
      health: '/api/v1/health',
    };
  }

  // Public health check. With the global prefix this serves at GET /api/v1/health and,
  // via the envelope interceptor, returns { success: true, data: { status, service, emailBackend } }.
  @Get('health')
  health(): { status: string; service: string; emailBackend: string } {
    return {
      status: 'ok',
      service: 'collabai-api',
      emailBackend: this.emailService.activeBackend,
    };
  }
}
