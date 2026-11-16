import { Prisma, NotificationType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { NotificationTargetType } from './notifications.constants';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BaseNotificationInput {
  recipientId: string;
  actorId?: string | null;
  eventKey: string;
  metadata?: Record<string, never>; // MVP accepts only empty object {}
}

export interface PostLikedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.POST_LIKED;
  targetType: typeof NotificationTargetType.POST;
  targetId: string;
}

export interface PostCommentedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.POST_COMMENTED;
  targetType: typeof NotificationTargetType.COMMENT;
  targetId: string;
}

export interface CommentRepliedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.COMMENT_REPLIED;
  targetType: typeof NotificationTargetType.COMMENT;
  targetId: string;
}

export interface TripInvitedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
}

export interface TripInvitationAcceptedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITATION_ACCEPTED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
}

export interface TripInvitationDeclinedNotificationInput extends BaseNotificationInput {
  type: typeof NotificationType.TRIP_INVITATION_DECLINED;
  targetType: typeof NotificationTargetType.TRIP_INVITATION;
  targetId: string;
}

export type WriteNotificationInput =
  | PostLikedNotificationInput
  | PostCommentedNotificationInput
  | CommentRepliedNotificationInput
  | TripInvitedNotificationInput
  | TripInvitationAcceptedNotificationInput
  | TripInvitationDeclinedNotificationInput;

export function validateNotificationInput(input: WriteNotificationInput): void {
  if (!UUID_REGEX.test(input.recipientId)) {
    throw new BadRequestException('recipientId không phải UUID hợp lệ');
  }
  if (input.actorId && !UUID_REGEX.test(input.actorId)) {
    throw new BadRequestException('actorId không phải UUID hợp lệ');
  }
  if (!UUID_REGEX.test(input.targetId)) {
    throw new BadRequestException('targetId không phải UUID hợp lệ');
  }

  const inputType: string = input.type;

  switch (input.type) {
    case NotificationType.POST_LIKED:
      if ((input as any).targetType !== NotificationTargetType.POST) {
        throw new BadRequestException('POST_LIKED phải có targetType là POST');
      }
      break;
    case NotificationType.POST_COMMENTED:
    case NotificationType.COMMENT_REPLIED:
      if ((input as any).targetType !== NotificationTargetType.COMMENT) {
        throw new BadRequestException(`${inputType} phải có targetType là COMMENT`);
      }
      break;
    case NotificationType.TRIP_INVITED:
    case NotificationType.TRIP_INVITATION_ACCEPTED:
    case NotificationType.TRIP_INVITATION_DECLINED:
      if ((input as any).targetType !== NotificationTargetType.TRIP_INVITATION) {
        throw new BadRequestException(`${inputType} phải có targetType là TRIP_INVITATION`);
      }
      break;
    default:
      throw new BadRequestException(`NotificationType không hợp lệ: ${inputType}`);
  }

  if (input.metadata !== undefined) {
    if (
      typeof input.metadata !== 'object' ||
      input.metadata === null ||
      Array.isArray(input.metadata) ||
      Object.keys(input.metadata).length > 0
    ) {
      throw new BadRequestException('Metadata trong MVP chỉ chấp nhận object rỗng {}');
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
      metadata: input.metadata ?? {},
      eventKey: input.eventKey,
    },
    update: {},
  });
}
