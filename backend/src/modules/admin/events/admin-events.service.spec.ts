import { firstValueFrom, take } from 'rxjs';
import { AdminEventsService } from './admin-events.service';
import { AdminLiveEventType } from './admin-events.constants';

describe('AdminEventsService', () => {
  let service: AdminEventsService;

  beforeEach(() => {
    service = new AdminEventsService(undefined);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('delivers emitted admin events to active SSE subscribers immediately', async () => {
    const stream$ = service.createStream();
    const receivedPromise = firstValueFrom(stream$.pipe(take(1)));

    const payload = {
      type: AdminLiveEventType.PLACE_PHOTO_SUBMITTED,
      payload: {
        imageId: 'img-1',
        placeId: 'place-1',
        placeName: 'Bãi Mỹ Khê',
      },
      timestamp: new Date().toISOString(),
    };

    await service.emit(payload);
    const event = await receivedPromise;
    expect(event.data).toEqual(payload);
  });

  it('cleans up internal subject when the last admin listener unsubscribes', async () => {
    const sub1 = service.createStream().subscribe();
    const sub2 = service.createStream().subscribe();

    sub1.unsubscribe();
    sub2.unsubscribe();

    // Emitting after all listeners left should be a safe no-op
    await expect(
      service.emit({
        type: AdminLiveEventType.REPORT_SUBMITTED,
        payload: { postId: 'p1' },
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});
