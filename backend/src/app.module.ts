import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './database/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { PlacesModule } from './modules/places/places.module';
import { GeoModule } from './modules/geo/geo.module';
import { ItinerariesModule } from './modules/itineraries/itineraries.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AdvisorModule } from './modules/advisor/advisor.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { appConfig, databaseConfig, jwtConfig, redisConfig, aiConfig, crawlerConfig } from './config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, aiConfig, crawlerConfig],
      validationSchema: envValidationSchema,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl?.startsWith('redis')) {
          const isLocal = redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');
          try {
            const parsed = new URL(redisUrl);
            return {
              connection: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                tls: isLocal ? undefined : { rejectUnauthorized: false },
                maxRetriesPerRequest: null,
              },
            };
          } catch {
            // fallback to host/port
          }
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CrawlerModule,
    PlacesModule,
    GeoModule,
    ItinerariesModule,
    KnowledgeModule,
    AdvisorModule,
    CollectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
