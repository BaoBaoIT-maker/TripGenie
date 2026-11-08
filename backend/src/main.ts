import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded, static as expressStatic } from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { COMMUNITY_CONSTANTS } from './modules/community/community.constants';

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

  // ponytail: express.static HTTP 206 Range streaming + immutable browser cache covers single-node deployments up to ~50 concurrent video streams; upgrade by swapping IMediaStorageProvider to S3+CloudFront / Cloudflare Stream when scaling horizontally.
  app.use(
    '/api/v1/uploads',
    expressStatic(join(process.cwd(), COMMUNITY_CONSTANTS.UPLOAD_ROOT_DIR), {
      maxAge: COMMUNITY_CONSTANTS.STATIC_UPLOAD_CACHE_MAX_AGE,
      immutable: true,
    }),
  );

  // CORS Configuration (credentials: true for HttpOnly cookies, supports loopback equivalence)
  const frontendUrl = configService.getOrThrow<string>('FRONTEND_BASE_URL');
  const allowedOrigins = Array.from(
    new Set([
      ...frontendUrl.split(',').map((o) => o.trim()),
      frontendUrl.replace('localhost', '127.0.0.1'),
      frontendUrl.replace('127.0.0.1', 'localhost'),
    ]),
  );
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Cookie', 'X-Requested-With'],
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
