import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeRepository } from './knowledge.repository';
import { PlacesModule } from '../places/places.module';
import { PrismaModule } from '../../database/prisma.module';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  imports: [PrismaModule, PlacesModule],
  providers: [
    KnowledgeService,
    {
      provide: INJECT_TOKENS.KNOWLEDGE_REPOSITORY,
      useClass: KnowledgeRepository,
    },
  ],
  exports: [KnowledgeService, INJECT_TOKENS.KNOWLEDGE_REPOSITORY],
})
export class KnowledgeModule {}
