import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ItinerariesController } from './itineraries.controller';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { FlightTransitStrategy } from './services/transit/strategies/flight.strategy';
import { BusTransitStrategy } from './services/transit/strategies/bus.strategy';
import { TrainTransitStrategy } from './services/transit/strategies/train.strategy';
import { RoadTransitStrategy } from './services/transit/strategies/road.strategy';
import { TransitModeEnum } from './dto/generate-itinerary.dto';
import { GeminiPlannerService } from './services/gemini-planner.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { CopilotAgentService } from './copilot/copilot-agent.service';
import { CopilotSummaryProcessor } from './copilot/copilot-summary.processor';
import { COPILOT_SUMMARY_QUEUE } from './copilot/copilot.types';
import { PrismaModule } from '../../database/prisma.module';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: COPILOT_SUMMARY_QUEUE,
    }),
  ],
  controllers: [ItinerariesController],
  providers: [
    FlightTransitStrategy,
    BusTransitStrategy,
    TrainTransitStrategy,
    {
      provide: INJECT_TOKENS.TRANSIT_STRATEGIES,
      useFactory: (
        flight: FlightTransitStrategy,
        bus: BusTransitStrategy,
        train: TrainTransitStrategy,
      ) => [
        flight,
        bus,
        train,
        new RoadTransitStrategy(TransitModeEnum.PERSONAL_MOTORBIKE),
        new RoadTransitStrategy(TransitModeEnum.PERSONAL_CAR),
      ],
      inject: [FlightTransitStrategy, BusTransitStrategy, TrainTransitStrategy],
    },
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

