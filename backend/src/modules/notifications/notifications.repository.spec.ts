import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsRepository } from './notifications.repository';
import { PrismaService } from '@/database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

describe('NotificationsRepository', () => {
  let repo: NotificationsRepository;
  let prisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    notification: {
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const recipientId = '11111111-1111-4111-8111-111111111111';
  const notificationId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';
  const postId = '44444444-4444-4444-8444-444444444444';
  const commentId = '55555555-5555-4555-8555-555555555555';
  const itineraryId = '66666666-6666-4666-8666-666666666666';
  const invitationId = '77777777-7777-4777-8777-777777777777';

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      notification: {
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repo = module.get<NotificationsRepository>(NotificationsRepository);
  });

  describe('list', () => {
    it('should query notifications and map post, comment, itinerary and actor correctly', async () => {
      const now = new Date('2026-11-04T10:00:00.000Z');
      const rawRows = [
        {
          id: notificationId,
          type: NotificationType.POST_LIKED,
          target_type: 'POST',
          target_id: postId,
          created_at: now,
          read_at: null,
          actor_id: actorId,
          actor_name: 'Nguyen Van A',
          actor_avatar: 'https://example.com/avatar.jpg',
          post_id: postId,
          post_title: 'Bài viết du lịch',
          comment_id: null,
          itinerary_id: null,
          itinerary_title: null,
          invitation_id: null,
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          type: NotificationType.COMMENT_REPLIED,
          target_type: 'COMMENT',
          target_id: commentId,
          created_at: new Date('2026-11-04T09:00:00.000Z'),
          read_at: null,
          actor_id: actorId,
          actor_name: 'Nguyen Van A',
          actor_avatar: null,
          post_id: postId,
          post_title: 'Bài viết du lịch',
          comment_id: commentId,
          itinerary_id: null,
          itinerary_title: null,
          invitation_id: null,
        },
        {
          id: '99999999-9999-4999-8999-999999999999',
          type: NotificationType.TRIP_INVITED,
          target_type: 'TRIP_INVITATION',
          target_id: invitationId,
          created_at: new Date('2026-11-04T08:00:00.000Z'),
          read_at: null,
          actor_id: actorId,
          actor_name: 'Nguyen Van A',
          actor_avatar: null,
          post_id: null,
          post_title: null,
          comment_id: null,
          itinerary_id: itineraryId,
          itinerary_title: 'Chuyến đi Đà Lạt',
          invitation_id: invitationId,
        },
      ];

      prisma.$queryRaw.mockResolvedValue(rawRows);

      const result = await repo.list(recipientId, { limit: 10 });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeNull();

      // Verify POST_LIKED item shape
      expect(result.items[0]).toEqual({
        id: notificationId,
        type: NotificationType.POST_LIKED,
        actor: {
          id: actorId,
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        post: {
          id: postId,
          title: 'Bài viết du lịch',
        },
        commentId: null,
        itinerary: null,
        invitationId: null,
        createdAt: now.toISOString(),
        readAt: null,
      });

      // Verify COMMENT_REPLIED item shape
      expect(result.items[1].commentId).toBe(commentId);
      expect(result.items[1].post?.id).toBe(postId);

      // Verify TRIP_INVITED item shape
      expect(result.items[2].itinerary).toEqual({
        id: itineraryId,
        title: 'Chuyến đi Đà Lạt',
      });
      expect(result.items[2].invitationId).toBe(invitationId);
    });

    it('should generate nextCursor when result count exceeds limit', async () => {
      const rows = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          type: NotificationType.POST_LIKED,
          target_type: 'POST',
          target_id: postId,
          created_at: new Date('2026-11-04T10:00:00.000Z'),
          read_at: null,
          actor_id: null,
          actor_name: null,
          actor_avatar: null,
          post_id: postId,
          post_title: 'P1',
          comment_id: null,
          itinerary_id: null,
          itinerary_title: null,
          invitation_id: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          type: NotificationType.POST_LIKED,
          target_type: 'POST',
          target_id: postId,
          created_at: new Date('2026-11-04T09:00:00.000Z'),
          read_at: null,
          actor_id: null,
          actor_name: null,
          actor_avatar: null,
          post_id: postId,
          post_title: 'P2',
          comment_id: null,
          itinerary_id: null,
          itinerary_title: null,
          invitation_id: null,
        },
      ];

      // Asking for limit 1, DB returns 2 rows (meaning hasNext = true)
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await repo.list(recipientId, { limit: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeDefined();
      expect(typeof result.nextCursor).toBe('string');
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      await expect(
        repo.list(recipientId, { cursor: 'invalid-cursor-string' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('countUnread', () => {
    it('should return unread count from database query', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 4 }]);

      const count = await repo.countUnread(recipientId);

      expect(count).toBe(4);
    });

    it('should return 0 when no rows returned', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const count = await repo.countUnread(recipientId);

      expect(count).toBe(0);
    });
  });

  describe('markRead', () => {
    it('should throw NotFoundException if notification does not exist or target is deleted', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(repo.markRead(recipientId, notificationId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should be idempotent if notification is already read', async () => {
      const readAt = new Date('2026-11-04T09:30:00.000Z');
      prisma.$queryRaw.mockResolvedValue([{ id: notificationId, read_at: readAt }]);

      const result = await repo.markRead(recipientId, notificationId);

      expect(result).toEqual({
        id: notificationId,
        readAt: readAt.toISOString(),
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should update read_at when notification is unread', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: notificationId, read_at: null }]);
      prisma.$executeRaw.mockResolvedValue(1);

      const result = await repo.markRead(recipientId, notificationId);

      expect(result.id).toBe(notificationId);
      expect(result.readAt).toBeDefined();
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('should mark all visible unread notifications as read and return updated count', async () => {
      prisma.$executeRaw.mockResolvedValue(5);

      const result = await repo.markAllRead(recipientId);

      expect(result.updatedCount).toBe(5);
      expect(result.readAt).toBeDefined();
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
