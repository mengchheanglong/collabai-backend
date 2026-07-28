import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Public health check. With the global prefix this serves at GET /api/v1/health and,
  // via the envelope interceptor, returns { success: true, data: { status, service } }.
  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'collabai-api' };
  }
}
