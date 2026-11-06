import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  async countUnread(@CurrentUser('id') recipientId: string) {
    return this.notificationsService.countUnread(recipientId);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser('id') recipientId: string) {
    return this.notificationsService.markAllRead(recipientId);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser('id') recipientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(recipientId, id);
  }

  @Get()
  async list(
    @CurrentUser('id') recipientId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.list(recipientId, query);
  }
}
