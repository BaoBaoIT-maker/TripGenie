import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { RedisModule } from '@/database/redis.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminPlacesService } from './services/admin-places.service';
import { AdminCommunityService } from './services/admin-community.service';
import { AdminModerationService } from './admin-moderation.service';
import { BannedWordsService } from './banned-words.service';
import { AdminEventsService } from './events/admin-events.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminUsersService,
    AdminPlacesService,
    AdminCommunityService,
    AdminModerationService,
    BannedWordsService,
    AdminEventsService,
  ],
  exports: [
    AdminService,
    AdminUsersService,
    AdminPlacesService,
    AdminCommunityService,
    AdminModerationService,
    BannedWordsService,
    AdminEventsService,
  ],
})
export class AdminModule {}
