import { NotificationType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  writeNotification,
  validateNotificationInput,
  WriteNotificationInput,
} from './notification-writer';
import { NotificationTargetType } from './notifications.constants';

describe('notification-writer', () => {
  const recipientId = '11111111-1111-4111-8111-111111111111';
  const actorId = '22222222-2222-4222-8222-222222222222';
  const targetId = '33333333-3333-4333-8333-333333333333';

  let mockTx: {
    notification: {
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    mockTx = {
      notification: {
        upsert: jest.fn().mockResolvedValue({ id: 'created-notif-id' }),
      },
    };
  });

  describe('validateNotificationInput', () => {
    it('should pass with valid POST_LIKED input', () => {
      expect(() =>
        validateNotificationInput({
          recipientId,
          actorId,
          type: NotificationType.POST_LIKED,
          targetType: NotificationTargetType.POST,
          targetId,
          eventKey: 'like:1',
        }),
      ).not.toThrow();
    });

    it('should throw BadRequestException for invalid recipient UUID', () => {
      expect(() =>
        validateNotificationInput({
          recipientId: 'invalid-uuid',
          actorId,
          type: NotificationType.POST_LIKED,
          targetType: NotificationTargetType.POST,
          targetId,
          eventKey: 'like:1',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetType does not match POST_LIKED', () => {
      expect(() =>
        validateNotificationInput({
          recipientId,
          actorId,
          type: NotificationType.POST_LIKED,
          targetType: 'COMMENT' as any,
          targetId,
          eventKey: 'like:1',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetType does not match COMMENT_REPLIED', () => {
      expect(() =>
        validateNotificationInput({
          recipientId,
          actorId,
          type: NotificationType.COMMENT_REPLIED,
          targetType: 'POST' as any,
          targetId,
          eventKey: 'reply:1',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetType does not match TRIP_INVITED', () => {
      expect(() =>
        validateNotificationInput({
          recipientId,
          actorId,
          type: NotificationType.TRIP_INVITED,
          targetType: 'POST' as any,
          targetId,
          eventKey: 'invite:1',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if metadata is not an empty object', () => {
      expect(() =>
        validateNotificationInput({
          recipientId,
          actorId,
          type: NotificationType.POST_LIKED,
          targetType: NotificationTargetType.POST,
          targetId,
          eventKey: 'like:1',
          metadata: { unexpectedKey: 'value' } as any,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('writeNotification', () => {
    it('should skip notification when recipientId equals actorId', async () => {
      await writeNotification(mockTx as any, {
        recipientId,
        actorId: recipientId, // Self notification
        type: NotificationType.POST_LIKED,
        targetType: NotificationTargetType.POST,
        targetId,
        eventKey: 'like:self',
      });

      expect(mockTx.notification.upsert).not.toHaveBeenCalled();
    });

    it('should upsert notification when valid and not self-notification', async () => {
      const input: WriteNotificationInput = {
        recipientId,
        actorId,
        type: NotificationType.TRIP_INVITATION_ACCEPTED,
        targetType: NotificationTargetType.TRIP_INVITATION,
        targetId,
        eventKey: 'result:1:ACCEPTED',
      };

      await writeNotification(mockTx as any, input);

      expect(mockTx.notification.upsert).toHaveBeenCalledWith({
        where: {
          recipientId_eventKey: {
            recipientId,
            eventKey: 'result:1:ACCEPTED',
          },
        },
        create: {
          recipientId,
          actorId,
          type: NotificationType.TRIP_INVITATION_ACCEPTED,
          targetType: NotificationTargetType.TRIP_INVITATION,
          targetId,
          metadata: {},
          eventKey: 'result:1:ACCEPTED',
        },
        update: {},
      });
    });
  });
});
