import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityRepository } from './community.repository';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [CommunityController],
  providers: [
    CommunityService,
    {
      provide: INJECT_TOKENS.COMMUNITY_REPOSITORY,
      useClass: CommunityRepository,
    },
    {
      provide: INJECT_TOKENS.MEDIA_STORAGE_PROVIDER,
      useClass: LocalDiskStorageProvider,
    },
  ],
  exports: [CommunityService, INJECT_TOKENS.COMMUNITY_REPOSITORY],
})
export class CommunityModule {}
