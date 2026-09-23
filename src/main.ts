import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import * as Sentry from '@sentry/nestjs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Contract base path: the frontend targets http://localhost:4000/api/v1.
  app.setGlobalPrefix('api/v1');
  // Allow the documented 100,000-character Markdown body, including JSON escaping.
  app.useBodyParser('json', { limit: '1mb' });

  // CORS with credentials (so the httpOnly auth cookies flow). In dev, reflect the
  // request origin so any localhost port/host works; in prod, lock to FRONTEND_ORIGIN.
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd
      ? (process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200')
      : true,
    credentials: true,
  });

  // Parse cookies so guards/handlers can read httpOnly auth cookies.
  app.use(cookieParser());

  // Validate + strip request bodies against the DTOs' class-validator rules.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global cross-cutting concerns. The envelope interceptor wraps every success response
  // in the contract shape; AllExceptionsFilter does the same for errors.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseEnvelopeInterceptor(),
  );

  // Swagger / OpenAPI — served at /api/docs (JSON at /api/docs-json).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CollabAI Auth API')
    .setDescription(
      'CollabAI backend API. Access tokens go in the `Authorization: Bearer` ' +
        'header; refresh tokens are carried in the httpOnly `refresh_token` cookie.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth('refresh_token')
    .addTag('Auth', 'Authentication & session management')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // withCredentials so Swagger UI "Try it out" sends/receives the httpOnly auth cookies,
  // which the register -> verify -> login -> refresh -> logout flow depends on.
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { withCredentials: true, persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
