import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { validationExceptionFactory } from './common/validation/validation.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Payload size limits to protect against memory exhaustion / large payload DoS
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // Contract base path: the frontend targets http://localhost:4000/api/v1.
  app.setGlobalPrefix('api/v1');

  // CORS with credentials (so the httpOnly auth cookies flow). In dev, reflect the
  // request origin so any localhost port/host works; in prod, support comma-separated origins.
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in dev mode
      if (!origin || !isProd) {
        return callback(null, true);
      }
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      if (allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
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
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: validationExceptionFactory,
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

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
