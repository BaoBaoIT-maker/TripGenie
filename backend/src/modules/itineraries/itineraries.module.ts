import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ItinerariesController } from './itineraries.controller';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { GeminiPlannerService } from './services/gemini-planner.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { CopilotAgentService } from './copilot/copilot-agent.service';
import { CopilotSummaryProcessor } from './copilot/copilot-summary.processor';
import { COPILOT_SUMMARY_QUEUE } from './copilot/copilot.types';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: COPILOT_SUMMARY_QUEUE,
    }),
  ],
  controllers: [ItinerariesController],
  providers: [
    ItineraryPlannerService,
    TransitService,
    GeminiPlannerService,
    CopilotToolsService,
    CopilotAgentService,
    CopilotSummaryProcessor,
  ],
  exports: [ItineraryPlannerService, TransitService, CopilotToolsService, CopilotAgentService],
})
export class ItinerariesModule {}
