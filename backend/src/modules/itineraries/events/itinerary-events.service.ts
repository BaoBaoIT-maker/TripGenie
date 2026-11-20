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
import {
  ITINERARY_EVENTS_CONFIG,
  ItineraryLiveEvent,
} from './itinerary-events.constants';

@Injectable()
export class ItineraryEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(ItineraryEventsService.name);
  private readonly subjects = new Map<string, Subject<MessageEvent>>();
  private readonly listenerCounts = new Map<string, number>();
  private readonly subClient: Redis | null = null;
  private readonly activeSubChannels = new Set<string>();

  constructor(
    @Optional()
    @Inject('REDIS_CLIENT')
    private readonly redisClient?: Redis,
  ) {
    if (this.redisClient) {
      try {
        this.subClient = this.redisClient.duplicate();
        this.subClient.on('message', (channel, message) => {
          this.handleRedisMessage(channel, message);
        });
        this.subClient.on('error', (err) => {
          this.logger.warn(`Redis live-events subscriber error: ${err.message}`);
        });
      } catch (err) {
        this.logger.warn(
          `Failed to initialize Redis subscriber for live events, using in-memory fallback: ${
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
        this.logger.warn(`Error closing Redis subscriber: ${err}`);
      }
    }
    this.subjects.forEach((subject) => subject.complete());
    this.subjects.clear();
    this.listenerCounts.clear();
    this.activeSubChannels.clear();
  }

  private getChannelName(itineraryId: string): string {
    return `${ITINERARY_EVENTS_CONFIG.REDIS_CHANNEL_PREFIX}:${itineraryId}`;
  }

  private handleRedisMessage(channel: string, message: string): void {
    const prefix = `${ITINERARY_EVENTS_CONFIG.REDIS_CHANNEL_PREFIX}:`;
    if (!channel.startsWith(prefix)) return;

    const itineraryId = channel.slice(prefix.length);
    const subject = this.subjects.get(itineraryId);
    if (!subject) return;

    try {
      const parsed = JSON.parse(message) as ItineraryLiveEvent;
      subject.next({ data: parsed });
    } catch (err) {
      this.logger.warn(`Failed to parse live event message on ${channel}: ${err}`);
    }
  }

  /**
   * Broadcasts a live itinerary event.
   * If Redis is available, publishes to cluster channel; otherwise falls back directly to local Subject.
   */
  async emit<T>(event: ItineraryLiveEvent<T>): Promise<void> {
    const channel = this.getChannelName(event.itineraryId);
    const payloadStr = JSON.stringify(event);

    if (this.redisClient) {
      try {
        await this.redisClient.publish(channel, payloadStr);
        return;
      } catch (err) {
        this.logger.warn(
          `Redis publish failed for ${channel}, falling back to local memory: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // In-memory fallback
    const subject = this.subjects.get(event.itineraryId);
    if (subject) {
      subject.next({ data: event });
    }
  }

  /**
   * Creates an SSE stream for an itinerary.
   * Automatically subscribes to Redis channel on first viewer and unsubscribes on last viewer exit.
   */
  createStream(
    itineraryId: string,
    _userId: string,
  ): Observable<MessageEvent> {
    const channel = this.getChannelName(itineraryId);

    let subject = this.subjects.get(itineraryId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.subjects.set(itineraryId, subject);
    }

    const currentCount = this.listenerCounts.get(itineraryId) ?? 0;
    this.listenerCounts.set(itineraryId, currentCount + 1);

    if (this.subClient && !this.activeSubChannels.has(channel)) {
      this.activeSubChannels.add(channel);
      this.subClient.subscribe(channel).catch((err) => {
        this.logger.warn(`Failed to subscribe to Redis channel ${channel}: ${err.message}`);
      });
    }

    // Heartbeat every 30s to keep connection alive through proxies & Cloudflare
    const heartbeat$ = interval(
      ITINERARY_EVENTS_CONFIG.HEARTBEAT_INTERVAL_MS,
    ).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
        }),
      ),
    );

    return merge(subject.asObservable(), heartbeat$).pipe(
      finalize(() => {
        this.cleanupListener(itineraryId, channel);
      }),
    );
  }

  private cleanupListener(itineraryId: string, channel: string): void {
    const current = (this.listenerCounts.get(itineraryId) ?? 1) - 1;
    if (current <= 0) {
      this.listenerCounts.delete(itineraryId);
      const subject = this.subjects.get(itineraryId);
      if (subject) {
        subject.complete();
        this.subjects.delete(itineraryId);
      }

      if (this.subClient && this.activeSubChannels.has(channel)) {
        this.activeSubChannels.delete(channel);
        this.subClient.unsubscribe(channel).catch((err) => {
          this.logger.warn(`Failed to unsubscribe from Redis channel ${channel}: ${err.message}`);
        });
      }
    } else {
      this.listenerCounts.set(itineraryId, current);
    }
  }
}
