import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { json, RequestHandler } from 'express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ApiErrorResponseDto } from './common/dto/api-error-response.dto';
import { PaginatedResponseDto } from './common/dto/pagination-query.dto';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  // XLSX is base64 in JSON (2 MiB binary -> <3 MiB request). Other endpoints
  // retain Nest/Express's default body limit.
  const uploadJson = json({ limit: '3mb' });
  // Wrapping prevents Nest's parser-name detection from suppressing its
  // default JSON parser on unrelated routes.
  app.use('/api/v1/admin/schedule/upload', ((req, res, next) => uploadJson(req, res, next)) as RequestHandler);
  app.use('/api/v1/requests/reports/debt-snapshots', ((req, res, next) => uploadJson(req, res, next)) as RequestHandler);

  const configService = app.get<ConfigService>(ConfigService);

  // Sentry
  const sentryDsn = configService.get('SENTRY_DSN');
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.getOrThrow('nodeEnv'),
      tracesSampleRate: configService.get<number>('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    });
  }

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  const corsOrigins = configService
    .get<string>('CORS_ORIGIN', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Root routes (bypass /api prefix)
  const httpAdapter = app.getHttpAdapter();
  if (configService.getOrThrow('nodeEnv') === 'production') {
    // Docker Nginx normalizes X-Forwarded-For to the real client address after
    // accepting X-Real-IP only from the configured host-Nginx bridge gateway.
    httpAdapter.getInstance().set('trust proxy', 1);
  }
  const isProduction = configService.getOrThrow('nodeEnv') === 'production';
  if (!isProduction) {
    httpAdapter.get('/', (_req, res) => {
      res.redirect('/api/v1/docs');
    });
  }
  httpAdapter.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('НаПаре API')
      .setDescription('Версионированный API НаПаре. Коллекции возвращают { data, meta }; ошибки возвращают statusCode, code, message, details, timestamp и path.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ApiErrorResponseDto, PaginatedResponseDto],
    });
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  // Start
  const port = configService.get('PORT', 3000);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/v1/docs`);
}

bootstrap();
