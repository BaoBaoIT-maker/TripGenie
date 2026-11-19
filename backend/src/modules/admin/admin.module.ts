import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { RedisModule } from '@/database/redis.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminModerationService } from './admin-moderation.service';
import { BannedWordsService } from './banned-words.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminController],
  providers: [AdminService, AdminModerationService, BannedWordsService],
  exports: [AdminService, AdminModerationService, BannedWordsService],
})
export class AdminModule {}
