import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityRepository } from './community.repository';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [CommunityController],
  providers: [
    CommunityService,
    LocalDiskStorageProvider,
    CloudinaryStorageProvider,
    {
      provide: INJECT_TOKENS.COMMUNITY_REPOSITORY,
      useClass: CommunityRepository,
    },
    {
      provide: INJECT_TOKENS.MEDIA_STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        localDiskProvider: LocalDiskStorageProvider,
        cloudinaryProvider: CloudinaryStorageProvider,
      ) => {
        const storageType =
          configService.get<string>('app.uploadStorage') ||
          configService.get<string>('UPLOAD_STORAGE') ||
          'local';
        return storageType.toLowerCase().trim() === 'cloudinary'
          ? cloudinaryProvider
          : localDiskProvider;
      },
      inject: [
        ConfigService,
        LocalDiskStorageProvider,
        CloudinaryStorageProvider,
      ],
    },
  ],
  exports: [
    CommunityService,
    INJECT_TOKENS.COMMUNITY_REPOSITORY,
    INJECT_TOKENS.MEDIA_STORAGE_PROVIDER,
  ],
})
export class CommunityModule {}
