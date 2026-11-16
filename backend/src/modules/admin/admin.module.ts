import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { RedisModule } from '@/database/redis.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminModerationService } from './admin-moderation.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminController],
  providers: [AdminService, AdminModerationService],
  exports: [AdminService, AdminModerationService],
})
export class AdminModule {}
