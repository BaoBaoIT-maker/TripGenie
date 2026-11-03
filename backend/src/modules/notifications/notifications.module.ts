import { Module } from '@nestjs/common';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: INJECT_TOKENS.NOTIFICATIONS_REPOSITORY,
      useClass: NotificationsRepository,
    },
  ],
  exports: [NotificationsService, INJECT_TOKENS.NOTIFICATIONS_REPOSITORY],
})
export class NotificationsModule {}
