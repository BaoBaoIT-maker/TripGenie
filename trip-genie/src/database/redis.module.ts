import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Global RedisModule — provides a single shared Redis connection across all modules.
 *
 * By marking @Global(), any module that imports RedisModule (or AppModule)
 * automatically gets REDIS_CLIENT injected without re-declaring it.
 *
 * This follows DRY: Redis connection config lives in exactly one place.
 */
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);

        const client = redisUrl?.startsWith('redis')
          ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 })
          : new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: 3 });

        client.on('error', (err) => {
          // Prevent unhandled error event crash on Redis connection errors
        });

        client.connect().catch(() => {
          // Connection errors are non-fatal — services degrade gracefully
        });

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
