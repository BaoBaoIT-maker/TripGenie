import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma, NotificationType } from '@prisma/client';
import {
  INotificationsRepository,
  NotificationItem,
  NotificationListResult,
  QueryNotificationsParams,
} from './interfaces/notifications-repository.interface';
import { NOTIFICATIONS_CONSTANTS } from './notifications.constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RawNotificationRow {
  id: string;
  type: NotificationType;
  target_type: string;
  target_id: string;
  created_at: Date | string;
  read_at: Date | string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  post_id: string | null;
  post_title: string | null;
  comment_id: string | null;
  itinerary_id: string | null;
  itinerary_title: string | null;
  invitation_id: string | null;
}

@Injectable()
export class NotificationsRepository implements INotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private encodeCursor(createdAt: Date, id: string): string {
    const raw = `${createdAt.toISOString()}${NOTIFICATIONS_CONSTANTS.CURSOR_SEPARATOR}${id}`;
    return Buffer.from(raw, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parts = raw.split(NOTIFICATIONS_CONSTANTS.CURSOR_SEPARATOR);
      if (parts.length !== 2) {
        throw new Error('Invalid cursor format');
      }
      const [dateStr, id] = parts;
      const createdAt = new Date(dateStr);
      if (Number.isNaN(createdAt.getTime()) || !UUID_REGEX.test(id)) {
        throw new Error('Invalid cursor values');
      }
      return { createdAt, id };
    } catch {
      throw new BadRequestException('Cursor phân trang không hợp lệ');
    }
  }

  /**
   * Unified visibility predicate for all notification queries:
   * 1. POST: post exists and deleted_at IS NULL
   * 2. COMMENT: comment and parent post exist and both deleted_at IS NULL
   * 3. TRIP_INVITATION: invitation, trip group and itinerary exist, itinerary deleted_at IS NULL,
   *    and recipient matches invited person or inviter depending on event type.
   */
  getVisibilityPredicate(alias = 'n'): Prisma.Sql {
    const a = Prisma.raw(alias);
    return Prisma.sql`
      (
        (${a}.target_type = 'POST' AND EXISTS (
          SELECT 1 FROM community_posts p
          WHERE p.id = ${a}.target_id AND p.deleted_at IS NULL
        ))
        OR
        (${a}.target_type = 'COMMENT' AND EXISTS (
          SELECT 1 FROM post_comments c
          JOIN community_posts p ON p.id = c.post_id
          WHERE c.id = ${a}.target_id AND c.deleted_at IS NULL AND p.deleted_at IS NULL
        ))
        OR
        (${a}.target_type = 'TRIP_INVITATION' AND EXISTS (
          SELECT 1 FROM trip_invitations ti
          JOIN trip_groups tg ON tg.id = ti.trip_group_id
          JOIN itineraries it ON it.id = tg.itinerary_id
          WHERE ti.id = ${a}.target_id AND it.deleted_at IS NULL
            AND (
              (${a}.type = 'TRIP_INVITED' AND ti.invitee_id = ${a}.recipient_id)
              OR
              (${a}.type IN ('TRIP_INVITATION_ACCEPTED', 'TRIP_INVITATION_DECLINED') AND ti.inviter_id = ${a}.recipient_id)
            )
        ))
      )
    `;
  }

  async list(
    recipientId: string,
    params: QueryNotificationsParams,
  ): Promise<NotificationListResult> {
    const limit = Math.min(
      Math.max(params.limit ?? NOTIFICATIONS_CONSTANTS.DEFAULT_LIMIT, 1),
      NOTIFICATIONS_CONSTANTS.MAX_LIMIT,
    );

    const visibility = this.getVisibilityPredicate('n');
    const filterSql =
      params.filter === 'UNREAD'
        ? Prisma.sql`AND n.read_at IS NULL`
        : Prisma.empty;

    let cursorSql = Prisma.empty;
    if (params.cursor) {
      const { createdAt: cursorDate, id: cursorId } = this.decodeCursor(params.cursor);
      cursorSql = Prisma.sql`
        AND (
          n.created_at < ${cursorDate}
          OR (n.created_at = ${cursorDate} AND n.id < ${cursorId}::uuid)
        )
      `;
    }

    const rows = await this.prisma.$queryRaw<RawNotificationRow[]>(
      Prisma.sql`
        SELECT
          n.id,
          n.type,
          n.target_type,
          n.target_id,
          n.created_at,
          n.read_at,
          u.id AS actor_id,
          u.full_name AS actor_name,
          u.avatar_url AS actor_avatar,
          CASE
            WHEN n.target_type = 'POST' THEN p.id
            WHEN n.target_type = 'COMMENT' THEN cp_p.id
            ELSE NULL
          END AS post_id,
          CASE
            WHEN n.target_type = 'POST' THEN p.title
            WHEN n.target_type = 'COMMENT' THEN cp_p.title
            ELSE NULL
          END AS post_title,
          CASE
            WHEN n.target_type = 'COMMENT' THEN c.id
            ELSE NULL
          END AS comment_id,
          CASE
            WHEN n.target_type = 'TRIP_INVITATION' THEN it.id
            ELSE NULL
          END AS itinerary_id,
          CASE
            WHEN n.target_type = 'TRIP_INVITATION' THEN it.title
            ELSE NULL
          END AS itinerary_title,
          CASE
            WHEN n.target_type = 'TRIP_INVITATION' THEN ti.id
            ELSE NULL
          END AS invitation_id
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        LEFT JOIN community_posts p ON (n.target_type = 'POST' AND p.id = n.target_id)
        LEFT JOIN post_comments c ON (n.target_type = 'COMMENT' AND c.id = n.target_id)
        LEFT JOIN community_posts cp_p ON (n.target_type = 'COMMENT' AND cp_p.id = c.post_id)
        LEFT JOIN trip_invitations ti ON (n.target_type = 'TRIP_INVITATION' AND ti.id = n.target_id)
        LEFT JOIN trip_groups tg ON (n.target_type = 'TRIP_INVITATION' AND tg.id = ti.trip_group_id)
        LEFT JOIN itineraries it ON (n.target_type = 'TRIP_INVITATION' AND it.id = tg.itinerary_id)
        WHERE n.recipient_id = ${recipientId}::uuid
          AND ${visibility}
          ${filterSql}
          ${cursorSql}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ${limit + 1}
      `,
    );

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNext && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor(new Date(last.created_at), last.id);
    }

    const mappedItems: NotificationItem[] = items.map((r) => ({
      id: r.id,
      type: r.type,
      actor: r.actor_id
        ? {
            id: r.actor_id,
            fullName: r.actor_name ?? '',
            avatarUrl: r.actor_avatar,
          }
        : null,
      post: r.post_id
        ? {
            id: r.post_id,
            title: r.post_title ?? '',
          }
        : null,
      commentId: r.comment_id ?? null,
      itinerary: r.itinerary_id
        ? {
            id: r.itinerary_id,
            title: r.itinerary_title ?? '',
          }
        : null,
      invitationId: r.invitation_id ?? null,
      createdAt: new Date(r.created_at).toISOString(),
      readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
    }));

    return {
      items: mappedItems,
      nextCursor,
    };
  }

  async countUnread(recipientId: string): Promise<number> {
    const visibility = this.getVisibilityPredicate('n');
    const result = await this.prisma.$queryRaw<{ count: bigint | number }[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM notifications n
        WHERE n.recipient_id = ${recipientId}::uuid
          AND n.read_at IS NULL
          AND ${visibility}
      `,
    );

    return Number(result[0]?.count ?? 0);
  }

  async markRead(
    recipientId: string,
    id: string,
  ): Promise<{ id: string; readAt: string }> {
    const visibility = this.getVisibilityPredicate('n');
    const rows = await this.prisma.$queryRaw<{ id: string; read_at: Date | string | null }[]>(
      Prisma.sql`
        SELECT n.id, n.read_at
        FROM notifications n
        WHERE n.id = ${id}::uuid
          AND n.recipient_id = ${recipientId}::uuid
          AND ${visibility}
        LIMIT 1
      `,
    );

    const existing = rows[0];
    if (!existing) {
      throw new NotFoundException('Thông báo không tồn tại hoặc đã bị xóa');
    }

    if (existing.read_at) {
      return {
        id: existing.id,
        readAt: new Date(existing.read_at).toISOString(),
      };
    }

    const now = new Date();
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE notifications
        SET read_at = ${now}
        WHERE id = ${existing.id}::uuid
          AND recipient_id = ${recipientId}::uuid
      `,
    );

    return {
      id: existing.id,
      readAt: now.toISOString(),
    };
  }

  async markAllRead(
    recipientId: string,
  ): Promise<{ updatedCount: number; readAt: string }> {
    const cutoff = new Date();
    const visibility = this.getVisibilityPredicate('notifications');
    const updatedCount = await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE notifications
        SET read_at = ${cutoff}
        WHERE recipient_id = ${recipientId}::uuid
          AND read_at IS NULL
          AND created_at <= ${cutoff}
          AND ${visibility}
      `,
    );

    return {
      updatedCount,
      readAt: cutoff.toISOString(),
    };
  }
}
