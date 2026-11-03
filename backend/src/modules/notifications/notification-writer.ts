import { Prisma, NotificationType } from '@prisma/client';

export interface BaseNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  eventKey: string;
}

export interface CommunityNotificationInput extends BaseNotificationInput {
  postId: string;
  commentId?: string | null;
  itineraryId?: never;
  invitationId?: never;
}

export interface TripInvitationNotificationInput extends BaseNotificationInput {
  itineraryId: string;
  invitationId: string;
  postId?: never;
  commentId?: never;
}

export type WriteNotificationInput =
  | CommunityNotificationInput
  | TripInvitationNotificationInput;

/**
 * Transaction-safe notification writer helper.
 * - Deduplicates notifications via unique [recipientId, eventKey].
 * - Automatically skips notifications where recipient equals actor (no self-notifications).
 */
export async function writeNotification(
  tx: Prisma.TransactionClient,
  input: WriteNotificationInput,
): Promise<void> {
  if (input.recipientId === input.actorId) {
    return;
  }

  const payload = input as any;

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
      postId: payload.postId ?? null,
      commentId: payload.commentId ?? null,
      itineraryId: payload.itineraryId ?? null,
      invitationId: payload.invitationId ?? null,
      eventKey: input.eventKey,
    },
    update: {},
  });
}
