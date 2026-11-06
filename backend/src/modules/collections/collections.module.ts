import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { CollectionsRepository } from './collections.repository';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CollectionsController],
  providers: [
    CollectionsService,
    {
      provide: INJECT_TOKENS.COLLECTION_REPOSITORY,
      useClass: CollectionsRepository,
    },
  ],
  exports: [CollectionsService, INJECT_TOKENS.COLLECTION_REPOSITORY],
})
export class CollectionsModule {}
