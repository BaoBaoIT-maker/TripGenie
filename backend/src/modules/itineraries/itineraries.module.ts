import { Module } from '@nestjs/common';
import { ItinerariesController } from './itineraries.controller';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { GeminiPlannerService } from './services/gemini-planner.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ItinerariesController],
  providers: [ItineraryPlannerService, TransitService, GeminiPlannerService],
  exports: [ItineraryPlannerService, TransitService],
})
export class ItinerariesModule {}
