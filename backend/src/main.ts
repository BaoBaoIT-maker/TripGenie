import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Disable default 100kb bodyParser so custom limits take effect
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Increase payload limit for cover photo uploads and base64 images
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);

  // Security Headers via Helmet (configured for cross-origin frontend resources)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie Parser Middleware for HttpOnly cookies
  app.use(cookieParser());

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // CORS Configuration (credentials: true for HttpOnly cookies)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Pipes & Interceptors & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  await app.listen(port);
  logger.log(`🚀 TripGenie Backend server running on: http://localhost:${port}/api/v1`);
}

bootstrap();
