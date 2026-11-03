import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Global RedisModule — provides a single shared Redis connection across all modules.
 */
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const redisUrl = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);

        const commonOptions = {
          lazyConnect: true,
          maxRetriesPerRequest: 10,
          connectTimeout: 10000,
          retryStrategy: (times: number) => {
            if (times > 10) {
              logger.error(`Redis reconnection failed after ${times} attempts.`);
              return null;
            }
            return Math.min(times * 100, 3000);
          },
        };

        let client: Redis;
        if (redisUrl?.startsWith('redis')) {
          const isLocal = redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');
          const url = !isLocal && redisUrl.startsWith('redis://')
            ? redisUrl.replace('redis://', 'rediss://')
            : redisUrl;

          client = new Redis(url, {
            ...commonOptions,
            tls: isLocal ? undefined : { rejectUnauthorized: false },
          });
        } else {
          client = new Redis({
            host,
            port,
            ...commonOptions,
          });
        }

        client.on('connect', () => {
          logger.log('✅ Connected to Redis successfully');
        });

        client.on('error', (err) => {
          logger.warn(`Redis connection issue: ${err.message}`);
        });

        client.connect().catch((err) => {
          logger.error(`Initial Redis connection failed: ${err.message}`);
        });

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
