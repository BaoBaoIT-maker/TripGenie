import { Test, TestingModule } from '@nestjs/testing';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { NotificationsService } from './notifications.service';
import { NotificationFilter } from './notifications.constants';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockRepo: {
    list: jest.Mock;
    countUnread: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      list: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: INJECT_TOKENS.NOTIFICATIONS_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('list should delegate to repository with recipientId and params', async () => {
    mockRepo.list.mockResolvedValue({ items: [], nextCursor: null });

    const params = { filter: NotificationFilter.ALL, limit: 20 };
    const result = await service.list('user-1', params);

    expect(mockRepo.list).toHaveBeenCalledWith('user-1', params);
    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it('countUnread should delegate to repository and wrap in count object', async () => {
    mockRepo.countUnread.mockResolvedValue(5);

    const result = await service.countUnread('user-1');

    expect(mockRepo.countUnread).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ count: 5 });
  });

  it('markRead should delegate to repository', async () => {
    const isoDate = new Date().toISOString();
    mockRepo.markRead.mockResolvedValue({ id: 'notif-1', readAt: isoDate });

    const result = await service.markRead('user-1', 'notif-1');

    expect(mockRepo.markRead).toHaveBeenCalledWith('user-1', 'notif-1');
    expect(result).toEqual({ id: 'notif-1', readAt: isoDate });
  });

  it('markAllRead should delegate to repository', async () => {
    const isoDate = new Date().toISOString();
    mockRepo.markAllRead.mockResolvedValue({ updatedCount: 3, readAt: isoDate });

    const result = await service.markAllRead('user-1');

    expect(mockRepo.markAllRead).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ updatedCount: 3, readAt: isoDate });
  });
});
