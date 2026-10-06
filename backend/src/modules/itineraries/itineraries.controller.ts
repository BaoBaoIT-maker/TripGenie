import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { CopilotAgentService } from './copilot/copilot-agent.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { CopilotChatDto, DirectSwapDto, ApplyProposalDto } from './copilot/copilot.types';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  GenerateItineraryDto,
  TransitPreviewDto,
  BulkDeleteItinerariesDto,
  UpdateTransitModeDto,
  UpdateCoverPhotoDto,
} from './dto/generate-itinerary.dto';

@Controller('itineraries')
export class ItinerariesController {
  constructor(
    private readonly plannerService: ItineraryPlannerService,
    private readonly transitService: TransitService,
    private readonly copilotAgent: CopilotAgentService,
    private readonly copilotTools: CopilotToolsService,
  ) {}

  /**
   * Generate a complete multi-day AI itinerary with transit & budget estimation.
   * OptionalJwtAuthGuard allows both logged-in users and guests to generate itineraries.
   * POST /api/v1/itineraries/generate
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(@Body() dto: GenerateItineraryDto, @CurrentUser('id') userId?: string) {
    return this.plannerService.generateItinerary(dto, userId);
  }

  /**
   * Fast transit preview calculation before creating a full itinerary.
   * POST /api/v1/itineraries/transit-preview
   */
  @Post('transit-preview')
  @HttpCode(HttpStatus.OK)
  previewTransit(@Body() dto: TransitPreviewDto) {
    return this.transitService.calculateIntercityTransit(dto);
  }

  /**
   * Retrieve an itinerary (owner, or anyone if public) with day plans and place coordinates.
   * GET /api/v1/itineraries/:id
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.getById(id, userId);
  }

  /**
   * List recent itineraries from database.
   * GET /api/v1/itineraries
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@CurrentUser('id') userId?: string) {
    return this.plannerService.listItineraries(userId);
  }

  /**
   * Soft-delete an itinerary. If other users cloned this itinerary,
   * their cloned copies remain completely safe and untouched.
   * DELETE /api/v1/itineraries/:id
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.deleteItinerary(id, userId);
  }

  /**
   * Clone an itinerary into the current user's trips.
   * POST /api/v1/itineraries/:id/clone
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.cloneItinerary(id, userId);
  }

  /**
   * Soft-delete multiple itineraries at once.
   * POST /api/v1/itineraries/bulk-delete
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @Body() dto: BulkDeleteItinerariesDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.bulkDeleteItineraries(dto.ids, userId);
  }

  /**
   * Update the intercity transit mode of an itinerary (FLIGHT, TRAIN, SLEEPER_BUS, etc.)
   * Recalculates routes, durations, deep links, and budget.
   * PATCH /api/v1/itineraries/:id/transit-mode
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':id/transit-mode')
  @HttpCode(HttpStatus.OK)
  updateTransitMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransitModeDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.updateTransitMode(id, dto.transitMode, userId);
  }

  /**
   * Update the cover photo of an itinerary.
   * PATCH /api/v1/itineraries/:id/cover-photo
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':id/cover-photo')
  @HttpCode(HttpStatus.OK)
  updateCoverPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoverPhotoDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.updateCoverPhoto(id, dto.coverPhoto, userId);
  }

  /**
   * Conversational Genie Copilot Chat with Function Tool Calling.
   * POST /api/v1/itineraries/:id/chat
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  chat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CopilotChatDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.copilotAgent.chat(id, dto.message, userId, dto.sessionId, dto.autoApply);
  }

  /**
   * Apply a user-confirmed Copilot proposal to update itinerary in DB.
   * POST /api/v1/itineraries/:id/copilot/apply-proposal
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/copilot/apply-proposal')
  @HttpCode(HttpStatus.OK)
  applyProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyProposalDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.copilotAgent.applyProposal(id, dto.toolName, dto.args, userId, dto.proposalId);
  }

  /**
   * Get chat history for Genie Copilot.
   * GET /api/v1/itineraries/:id/chat/history
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/chat/history')
  getChatHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.copilotAgent.getChatHistory(id, sessionId);
  }

  /**
   * Fast DB alternatives for 1-click swap on place card (Hybrid model).
   * GET /api/v1/itineraries/:id/destinations/:destinationId/alternatives
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/destinations/:destinationId/alternatives')
  getAlternatives(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
  ) {
    return this.copilotTools.getAlternativesForActivity(id, destinationId);
  }

  /**
   * Direct 1-click swap on place card without calling LLM (Hybrid model).
   * POST /api/v1/itineraries/:id/destinations/:destinationId/swap
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/destinations/:destinationId/swap')
  @HttpCode(HttpStatus.OK)
  async directSwap(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @Body() dto: DirectSwapDto,
    @CurrentUser('id') userId?: string,
  ) {
    await this.copilotTools.swapActivityDirect(id, destinationId, dto.newPlaceId);
    return this.plannerService.getById(id, userId);
  }
}