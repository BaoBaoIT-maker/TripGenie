import { Prisma, NotificationType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  NOTIFICATIONS_ERRORS,
  NotificationTargetType,
} from './notifications.constants';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BaseNotificationInput {
  recipientId: string;
  actorId?: string | null;
  eventKey: string;
  metadata?: Record<string, unknown>;
}

export interface PostLikedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.POST_LIKED;
  targetType: typeof NotificationTargetType.POST;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface PostCommentedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.POST_COMMENTED;
  targetType: typeof NotificationTargetType.COMMENT;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface CommentRepliedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.COMMENT_REPLIED;
  targetType: typeof NotificationTargetType.COMMENT;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface TripInvitedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface TripInvitationAcceptedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITATION_ACCEPTED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface TripInvitationDeclinedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITATION_DECLINED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
  metadata?: Record<string, never>;
}

export interface PostModeratedNotificationInput extends BaseNotificationInput {
  type:
    | typeof NotificationType.POST_APPROVED
    | typeof NotificationType.POST_FLAGGED
    | typeof NotificationType.POST_REJECTED;
  targetType: typeof NotificationTargetType.POST;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export type WriteNotificationInput =
  | PostLikedNotificationInput
  | PostCommentedNotificationInput
  | CommentRepliedNotificationInput
  | TripInvitedNotificationInput
  | TripInvitationAcceptedNotificationInput
  | TripInvitationDeclinedNotificationInput
  | PostModeratedNotificationInput;

export function validateNotificationInput(input: WriteNotificationInput): void {
  if (!UUID_REGEX.test(input.recipientId)) {
    throw new BadRequestException(NOTIFICATIONS_ERRORS.INVALID_RECIPIENT_ID);
  }
  if (input.actorId && !UUID_REGEX.test(input.actorId)) {
    throw new BadRequestException(NOTIFICATIONS_ERRORS.INVALID_ACTOR_ID);
  }
  if (!UUID_REGEX.test(input.targetId)) {
    throw new BadRequestException(NOTIFICATIONS_ERRORS.INVALID_TARGET_ID);
  }

  const inputType: string = input.type;
  const currentTargetType: string = (input as { targetType: string }).targetType;

  switch (input.type) {
    case NotificationType.POST_LIKED:
    case NotificationType.POST_APPROVED:
    case NotificationType.POST_FLAGGED:
    case NotificationType.POST_REJECTED:
      if (currentTargetType !== NotificationTargetType.POST) {
        throw new BadRequestException(
          NOTIFICATIONS_ERRORS.TARGET_TYPE_MISMATCH(inputType, NotificationTargetType.POST),
        );
      }
      break;
    case NotificationType.POST_COMMENTED:
    case NotificationType.COMMENT_REPLIED:
      if (currentTargetType !== NotificationTargetType.COMMENT) {
        throw new BadRequestException(
          NOTIFICATIONS_ERRORS.TARGET_TYPE_MISMATCH(inputType, NotificationTargetType.COMMENT),
        );
      }
      break;
    case NotificationType.TRIP_INVITED:
    case NotificationType.TRIP_INVITATION_ACCEPTED:
    case NotificationType.TRIP_INVITATION_DECLINED:
      if (currentTargetType !== NotificationTargetType.TRIP_INVITATION) {
        throw new BadRequestException(
          NOTIFICATIONS_ERRORS.TARGET_TYPE_MISMATCH(
            inputType,
            NotificationTargetType.TRIP_INVITATION,
          ),
        );
      }
      break;
    default:
      throw new BadRequestException(
        NOTIFICATIONS_ERRORS.INVALID_NOTIFICATION_TYPE(inputType),
      );
  }

  const isPostModeration =
    input.type === NotificationType.POST_APPROVED ||
    input.type === NotificationType.POST_FLAGGED ||
    input.type === NotificationType.POST_REJECTED;

  if (input.metadata !== undefined) {
    if (
      typeof input.metadata !== 'object' ||
      input.metadata === null ||
      Array.isArray(input.metadata)
    ) {
      throw new BadRequestException(NOTIFICATIONS_ERRORS.INVALID_METADATA_OBJECT);
    }
    if (!isPostModeration && Object.keys(input.metadata).length > 0) {
      throw new BadRequestException(
        NOTIFICATIONS_ERRORS.METADATA_NON_EMPTY_NOT_ALLOWED,
      );
    }
  }
}

/**
 * Transaction-safe notification writer helper.
 * - Deduplicates notifications via unique [recipientId, eventKey].
 * - Automatically skips notifications where recipient equals actor (no self-notifications).
 * - Enforces targetType + targetId discrimination at runtime and compile-time.
 */
export async function writeNotification(
  tx: Prisma.TransactionClient,
  input: WriteNotificationInput,
): Promise<void> {
  if (input.recipientId === input.actorId) {
    return;
  }

  validateNotificationInput(input);

  await tx.notification.upsert({
    where: {
      recipientId_eventKey: {
        recipientId: input.recipientId,
        eventKey: input.eventKey,
      },
    },
    create: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      eventKey: input.eventKey,
    },
    update: {
      readAt: null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
