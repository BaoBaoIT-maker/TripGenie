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
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CrawlerModule,
    PlacesModule,
    GeoModule,
    ItinerariesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
