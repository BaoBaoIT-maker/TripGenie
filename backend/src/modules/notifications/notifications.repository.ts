import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  INotificationsRepository,
  NotificationItem,
  NotificationListResult,
  QueryNotificationsParams,
} from './interfaces/notifications-repository.interface';
import { NOTIFICATIONS_CONSTANTS } from './notifications.constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  private getVisibilityWhere(recipientId: string): Prisma.NotificationWhereInput {
    return {
      recipientId,
      OR: [
        {
          postId: { not: null },
          post: { deletedAt: null },
          OR: [{ commentId: null }, { comment: { deletedAt: null } }],
        },
        {
          invitationId: { not: null },
          itineraryId: { not: null },
          itinerary: { deletedAt: null },
        },
      ],
    };
  }

  async list(
    recipientId: string,
    params: QueryNotificationsParams,
  ): Promise<NotificationListResult> {
    const limit = Math.min(
      Math.max(params.limit ?? NOTIFICATIONS_CONSTANTS.DEFAULT_LIMIT, 1),
      NOTIFICATIONS_CONSTANTS.MAX_LIMIT,
    );

    const baseWhere = this.getVisibilityWhere(recipientId);
    const andConditions: Prisma.NotificationWhereInput[] = [baseWhere];

    if (params.filter === 'UNREAD') {
      andConditions.push({ readAt: null });
    }

    if (params.cursor) {
      const { createdAt: cursorDate, id: cursorId } = this.decodeCursor(params.cursor);
      andConditions.push({
        OR: [
          { createdAt: { lt: cursorDate } },
          {
            createdAt: cursorDate,
            id: { lt: cursorId },
          },
        ],
      });
    }

    const rows = await this.prisma.notification.findMany({
      where: { AND: andConditions },
      select: {
        id: true,
        type: true,
        commentId: true,
        createdAt: true,
        readAt: true,
        actor: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
        itinerary: {
          select: {
            id: true,
            title: true,
          },
        },
        invitationId: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNext && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor(last.createdAt, last.id);
    }

    const mappedItems: NotificationItem[] = items.map((r: (typeof items)[number]) => ({
      id: r.id,
      type: r.type,
      actor: r.actor,
      post: r.post,
      commentId: r.commentId,
      itinerary: r.itinerary,
      invitationId: r.invitationId,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    }));

    return {
      items: mappedItems,
      nextCursor,
    };
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        ...this.getVisibilityWhere(recipientId),
        readAt: null,
      },
    });
  }

  async markRead(
    recipientId: string,
    id: string,
  ): Promise<{ id: string; readAt: string }> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id,
        ...this.getVisibilityWhere(recipientId),
      },
      select: { id: true, readAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Thông báo không tồn tại hoặc đã bị xóa');
    }

    if (existing.readAt) {
      return {
        id: existing.id,
        readAt: existing.readAt.toISOString(),
      };
    }

    const now = new Date();
    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: now },
      select: { id: true, readAt: true },
    });

    return {
      id: updated.id,
      readAt: (updated.readAt ?? now).toISOString(),
    };
  }

  async markAllRead(
    recipientId: string,
  ): Promise<{ updatedCount: number; readAt: string }> {
    const cutoff = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        ...this.getVisibilityWhere(recipientId),
        readAt: null,
        createdAt: { lte: cutoff },
      },
      data: { readAt: cutoff },
    });

    return {
      updatedCount: result.count,
      readAt: cutoff.toISOString(),
    };
  }
}
