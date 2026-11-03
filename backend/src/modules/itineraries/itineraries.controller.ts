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
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { CopilotAgentService } from './copilot/copilot-agent.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { CopilotChatDto, DirectSwapDto, ApplyProposalDto } from './copilot/copilot.types';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  GenerateItineraryDto,
  TransitPreviewDto,
  BulkDeleteItinerariesDto,
  UpdateTransitModeDto,
  UpdateCoverPhotoDto,
  UpdateTourBriefingDto,
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
   * Requires authentication so generated trips belong strictly to the logged-in user.
   * POST /api/v1/itineraries/generate
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(@Body() dto: GenerateItineraryDto, @CurrentUser('id') userId: string) {
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
   * List itineraries belonging ONLY to the currently authenticated user.
   * GET /api/v1/itineraries
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@CurrentUser('id') userId?: string) {
    return this.plannerService.listItineraries(userId);
  }

  /**
   * Soft-delete an itinerary owned by the current user.
   * DELETE /api/v1/itineraries/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.deleteItinerary(id, userId);
  }

  /**
   * Clone a public (or own) itinerary into the current user's trips.
   * POST /api/v1/itineraries/:id/clone
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.cloneItinerary(id, userId);
  }

  /**
   * Soft-delete multiple itineraries owned by the current user at once.
   * POST /api/v1/itineraries/bulk-delete
   */
  @UseGuards(JwtAuthGuard)
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @Body() dto: BulkDeleteItinerariesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.bulkDeleteItineraries(dto.ids, userId);
  }

  /**
   * Update the intercity transit mode of an itinerary (owner only).
   * PATCH /api/v1/itineraries/:id/transit-mode
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/transit-mode')
  @HttpCode(HttpStatus.OK)
  updateTransitMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransitModeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.updateTransitMode(id, dto.transitMode, userId);
  }

  /**
   * Update the cover photo of an itinerary (owner only).
   * PATCH /api/v1/itineraries/:id/cover-photo
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cover-photo')
  @HttpCode(HttpStatus.OK)
  updateCoverPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoverPhotoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.updateCoverPhoto(id, dto.coverPhoto, userId);
  }

  /**
   * Update the tour leader & assembly briefing info of an itinerary (owner only).
   * PATCH /api/v1/itineraries/:id/tour-briefing
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/tour-briefing')
  @HttpCode(HttpStatus.OK)
  updateTourBriefing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTourBriefingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.updateTourBriefing(id, dto, userId);
  }

  /**
   * Conversational Genie Copilot Chat with Function Tool Calling (owner only).
   * POST /api/v1/itineraries/:id/chat
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  chat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CopilotChatDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.copilotAgent.chat(id, dto.message, userId, dto.sessionId, dto.autoApply);
  }

  /**
   * Apply a user-confirmed Copilot proposal to update itinerary in DB (owner only).
   * POST /api/v1/itineraries/:id/copilot/apply-proposal
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/copilot/apply-proposal')
  @HttpCode(HttpStatus.OK)
  applyProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyProposalDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.copilotAgent.applyProposal(id, dto.toolName, dto.args, userId, dto.proposalId);
  }

  /**
   * Get chat history for Genie Copilot (owner only).
   * GET /api/v1/itineraries/:id/chat/history
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/chat/history')
  getChatHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sessionId') sessionId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.copilotAgent.getChatHistory(id, sessionId, userId);
  }

  /**
   * Fast DB alternatives for 1-click swap on place card (owner only).
   * GET /api/v1/itineraries/:id/destinations/:destinationId/alternatives
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/destinations/:destinationId/alternatives')
  async getAlternatives(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.plannerService.assertItineraryOwnership(id, userId);
    return this.copilotTools.getAlternativesForActivity(id, destinationId);
  }

  /**
   * Direct 1-click swap on place card without calling LLM (owner only).
   * POST /api/v1/itineraries/:id/destinations/:destinationId/swap
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/destinations/:destinationId/swap')
  @HttpCode(HttpStatus.OK)
  async directSwap(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @Body() dto: DirectSwapDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.plannerService.assertItineraryOwnership(id, userId);
    await this.copilotTools.swapActivityDirect(id, destinationId, dto.newPlaceId);
    return this.plannerService.getById(id, userId);
  }
}
