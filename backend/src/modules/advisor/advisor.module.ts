import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PlacesModule } from '../places/places.module';
import { AdvisorToolsService } from './advisor-tools.service';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [PrismaModule, KnowledgeModule, PlacesModule, ItinerariesModule],
  controllers: [AdvisorController],
  providers: [AdvisorToolsService, AdvisorService],
  exports: [AdvisorService, AdvisorToolsService],
})
export class AdvisorModule {}
