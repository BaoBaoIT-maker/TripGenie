import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './database/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlacesModule } from './modules/places/places.module';
import { GeoModule } from './modules/geo/geo.module';
import { ItinerariesModule } from './modules/itineraries/itineraries.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AdvisorModule } from './modules/advisor/advisor.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CommunityModule } from './modules/community/community.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WeatherModule } from './modules/weather/weather.module';
import { AdminModule } from './modules/admin/admin.module';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  aiConfig,
  weatherConfig,
} from './config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        aiConfig,
        weatherConfig,
      ],
      validationSchema: envValidationSchema,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl?.startsWith('redis')) {
          try {
            const parsed = new URL(redisUrl);
            const isRediss = redisUrl.startsWith('rediss://');
            return {
              connection: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                tls: isRediss ? { rejectUnauthorized: false } : undefined,
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
    PlacesModule,
    GeoModule,
    ItinerariesModule,
    KnowledgeModule,
    AdvisorModule,
    CollectionsModule,
    CommunityModule,
    NotificationsModule,
    WeatherModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
