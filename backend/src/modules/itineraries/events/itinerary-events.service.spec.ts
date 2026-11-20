import { ItineraryEventsService } from './itinerary-events.service';
import {
  ItineraryLiveEventType,
  ItineraryLiveEvent,
} from './itinerary-events.constants';
import { firstValueFrom, take } from 'rxjs';

describe('ItineraryEventsService', () => {
  let service: ItineraryEventsService;

  beforeEach(() => {
    // Test in-memory fallback without Redis
    service = new ItineraryEventsService(undefined);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should stream emitted live events to active subscribers of the itinerary', async () => {
    const itineraryId = 'itinerary-uuid-123';
    const stream$ = service.createStream(itineraryId, 'user-1');

    const testEvent: ItineraryLiveEvent<{ proposalId: string; voteCount: number }> = {
      type: ItineraryLiveEventType.PROPOSAL_VOTED,
      itineraryId,
      actor: { userId: 'user-2', fullName: 'Nguyen Van A' },
      payload: { proposalId: 'proposal-999', voteCount: 4 },
      timestamp: new Date().toISOString(),
    };

    // Listen for the first event
    const receivedPromise = firstValueFrom(stream$.pipe(take(1)));

    // Emit event
    await service.emit(testEvent);

    const messageEvent = await receivedPromise;
    expect(messageEvent.data).toEqual(testEvent);
  });

  it('should isolate events by itineraryId and not leak to other itineraries', async () => {
    const itineraryA = 'itinerary-A';
    const itineraryB = 'itinerary-B';

    const eventsA: unknown[] = [];
    const subA = service.createStream(itineraryA, 'user-A').subscribe((evt) => {
      if (evt.type !== 'heartbeat') eventsA.push(evt.data);
    });

    const eventsB: unknown[] = [];
    const subB = service.createStream(itineraryB, 'user-B').subscribe((evt) => {
      if (evt.type !== 'heartbeat') eventsB.push(evt.data);
    });

    await service.emit({
      type: ItineraryLiveEventType.PROPOSAL_CREATED,
      itineraryId: itineraryA,
      actor: { userId: 'user-A' },
      payload: { id: 'prop-A' },
      timestamp: new Date().toISOString(),
    });

    // Wait short tick for microtask dispatch
    await new Promise((r) => setTimeout(r, 20));

    expect(eventsA).toHaveLength(1);
    expect(eventsB).toHaveLength(0);

    subA.unsubscribe();
    subB.unsubscribe();
  });
});
