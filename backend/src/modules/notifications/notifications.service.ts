import { Inject, Injectable } from '@nestjs/common';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import {
  INotificationsRepository,
  NotificationListResult,
  QueryNotificationsParams,
} from './interfaces/notifications-repository.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(INJECT_TOKENS.NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
  ) {}

  async list(
    recipientId: string,
    params: QueryNotificationsParams,
  ): Promise<NotificationListResult> {
    return this.repository.list(recipientId, params);
  }

  async countUnread(recipientId: string): Promise<{ count: number }> {
    const count = await this.repository.countUnread(recipientId);
    return { count };
  }

  async markRead(
    recipientId: string,
    id: string,
  ): Promise<{ id: string; readAt: string }> {
    return this.repository.markRead(recipientId, id);
  }

  async markAllRead(
    recipientId: string,
  ): Promise<{ updatedCount: number; readAt: string }> {
    return this.repository.markAllRead(recipientId);
  }
}
