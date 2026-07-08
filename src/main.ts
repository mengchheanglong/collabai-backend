import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Global cross-cutting concerns.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  // Opt-in response envelope (changes every response body), enable if desired:
  //   app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
