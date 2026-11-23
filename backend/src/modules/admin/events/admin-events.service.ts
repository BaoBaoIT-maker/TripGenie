import {
  Injectable,
  Inject,
  Optional,
  Logger,
  OnModuleDestroy,
  MessageEvent,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Subject, Observable, interval, merge, map, finalize } from 'rxjs';
import { REDIS_CLIENT_TOKEN } from '@/database/redis.module';
import {
  ADMIN_EVENTS_CONFIG,
  AdminLiveEvent,
} from './admin-events.constants';

@Injectable()
export class AdminEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(AdminEventsService.name);
  private subject: Subject<MessageEvent> | null = null;
  private listenerCount = 0;
  private isSubscribed = false;
  private readonly subClient: Redis | null = null;

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT_TOKEN)
    private readonly redisClient?: Redis,
  ) {
    if (this.redisClient) {
      try {
        this.subClient = this.redisClient.duplicate();
        this.subClient.on('message', (channel, message) => {
          if (channel !== ADMIN_EVENTS_CONFIG.REDIS_CHANNEL) return;
          this.dispatchRawMessage(message);
        });
        this.subClient.on('error', (err) => {
          this.logger.warn(`Admin live-events Redis error: ${err.message}`);
        });
      } catch (err) {
        this.logger.warn(
          `Admin live-events Redis subscriber unavailable, using in-memory fallback: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        this.subClient = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subClient) {
      try {
        await this.subClient.quit();
      } catch (err) {
        this.logger.warn(`Error closing admin Redis subscriber: ${err}`);
      }
    }
    this.subject?.complete();
    this.subject = null;
    this.listenerCount = 0;
    this.isSubscribed = false;
  }

  private dispatchRawMessage(raw: string): void {
    if (!this.subject) return;
    try {
      const parsed = JSON.parse(raw) as AdminLiveEvent;
      this.subject.next({ data: parsed });
    } catch (err) {
      this.logger.warn(`Failed to parse admin live event: ${err}`);
    }
  }

  /**
   * Publishes an admin operational event across instances (via Redis) or locally if Redis is down.
   */
  async emit<T>(event: AdminLiveEvent<T>): Promise<void> {
    const serialized = JSON.stringify(event);

    if (this.redisClient) {
      try {
        await this.redisClient.publish(
          ADMIN_EVENTS_CONFIG.REDIS_CHANNEL,
          serialized,
        );
        return;
      } catch (err) {
        this.logger.warn(
          `Redis publish failed on ${ADMIN_EVENTS_CONFIG.REDIS_CHANNEL}, using local memory: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.subject?.next({ data: event });
  }

  /**
   * Opens an SSE stream for an authenticated Admin.
   * Reference-counted: subscribes to Redis on first online Admin and unsubscribes when last exits.
   */
  createStream(): Observable<MessageEvent> {
    if (!this.subject) {
      this.subject = new Subject<MessageEvent>();
    }
    this.listenerCount += 1;

    if (this.subClient && !this.isSubscribed) {
      this.isSubscribed = true;
      this.subClient
        .subscribe(ADMIN_EVENTS_CONFIG.REDIS_CHANNEL)
        .catch((err) => {
          this.isSubscribed = false;
          this.logger.warn(
            `Failed to subscribe to ${ADMIN_EVENTS_CONFIG.REDIS_CHANNEL}: ${err.message}`,
          );
        });
    }

    const heartbeat$ = interval(ADMIN_EVENTS_CONFIG.HEARTBEAT_INTERVAL_MS).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
        }),
      ),
    );

    return merge(this.subject.asObservable(), heartbeat$).pipe(
      finalize(() => {
        this.cleanupListener();
      }),
    );
  }

  private cleanupListener(): void {
    this.listenerCount = Math.max(0, this.listenerCount - 1);
    if (this.listenerCount > 0) return;

    this.subject?.complete();
    this.subject = null;

    if (this.subClient && this.isSubscribed) {
      this.isSubscribed = false;
      this.subClient
        .unsubscribe(ADMIN_EVENTS_CONFIG.REDIS_CHANNEL)
        .catch((err) => {
          this.logger.warn(
            `Failed to unsubscribe from ${ADMIN_EVENTS_CONFIG.REDIS_CHANNEL}: ${err.message}`,
          );
        });
    }
  }
}
