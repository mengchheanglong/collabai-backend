import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { authThrottlers } from './config/throttler.config';

@Module({
  imports: [
    // Global config — required so SharedModule's JwtModule factory can inject ConfigService.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Global event bus — required for @OnEvent listeners (e.g. AuthEventsListener).
    EventEmitterModule.forRoot(),
    // Named rate-limit configs registered globally. No global ThrottlerGuard yet —
    // routes opt in with the relevant named limiter in the auth controller later.
    ThrottlerModule.forRoot(authThrottlers),
    SharedModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
