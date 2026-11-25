import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { ItineraryAccessService } from './services/itinerary-access.service';
import { TransitService } from './services/transit.service';
import { CopilotAgentService } from './copilot/copilot-agent.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { ItineraryEventsService } from './events/itinerary-events.service';
import { ItineraryLiveEventType } from './events/itinerary-events.constants';
import {
  CopilotChatDto,
  DirectSwapDto,
  ApplyProposalDto,
} from './copilot/copilot.types';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestLocale } from '@/common/decorators/request-locale.decorator';
import { AppLocale } from '@/common/i18n/locale.util';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { RateLimitTier } from '@/config/rate-limit.config';
import {
  GenerateItineraryDto,
  TransitPreviewDto,
  BulkDeleteItinerariesDto,
  UpdateTransitModeDto,
  UpdateCoverPhotoDto,
  UpdateTourBriefingDto,
  UpdatePartySizeDto,
  UpdateItineraryDto,
  AddDestinationDto,
  UpdateDestinationDto,
  MoveDestinationDto,
  UpdateItineraryLodgingDto,
} from './dto/generate-itinerary.dto';

@Controller('itineraries')
export class ItinerariesController {
  constructor(
    private readonly plannerService: ItineraryPlannerService,
    private readonly accessService: ItineraryAccessService,
    private readonly transitService: TransitService,
    private readonly copilotAgent: CopilotAgentService,
    private readonly copilotTools: CopilotToolsService,
    private readonly eventsService: ItineraryEventsService,
  ) {}

  /**
   * Generate a complete multi-day AI itinerary with transit & budget estimation.
   * Requires authentication so generated trips belong strictly to the logged-in user.
   * POST /api/v1/itineraries/generate
   */
  @UseGuards(JwtAuthGuard)
  @RateLimit({ tier: RateLimitTier.AI_GENERATE })
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @Body() dto: GenerateItineraryDto,
    @CurrentUser('id') userId: string,
    @RequestLocale() locale: AppLocale,
  ) {
    return this.plannerService.generateItinerary(dto, userId, locale);
  }

  /**
   * Fast transit preview calculation before creating a full itinerary.
   * POST /api/v1/itineraries/transit-preview
   */
  @Post('transit-preview')
  @HttpCode(HttpStatus.OK)
  previewTransit(
    @Body() dto: TransitPreviewDto,
    @RequestLocale() locale: AppLocale,
  ) {
    return this.transitService.calculateIntercityTransit({ ...dto, locale });
  }

  /**
   * Retrieve hybrid weather forecast / seasonal climate breakdown for an itinerary.
   * GET /api/v1/itineraries/:id/weather
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/weather')
  getWeather(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
    @RequestLocale() locale: AppLocale = 'vi',
  ) {
    return this.plannerService.getWeatherById(id, userId, locale);
  }

  /**
   * Retrieve 3 curated groups of lodging suggestions for a specific night.
   * GET /api/v1/itineraries/:id/lodging-suggestions?night=&budget=
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/lodging-suggestions')
  getLodgingSuggestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('night') night?: string,
    @Query('budget') budget?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.plannerService.getLodgingSuggestions(
      id,
      {
        night: night ? Number(night) : undefined,
        budget,
      },
      userId,
    );
  }

  /**
   * Update lodging for a night range [fromNight..toNight] and re-optimize affected day routes.
   * PUT /api/v1/itineraries/:id/lodging
   */
  @UseGuards(JwtAuthGuard)
  @Put(':id/lodging')
  @HttpCode(HttpStatus.OK)
  updateLodging(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItineraryLodgingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.updateLodging(id, dto, userId);
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
  list(
    @CurrentUser('id') userId?: string,
    @Query('scope') scope?: 'OWNED' | 'JOINED',
  ) {
    return this.plannerService.listItineraries(userId, scope);
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
    @RequestLocale() locale: AppLocale,
  ) {
    return this.plannerService.updateTransitMode(
      id,
      dto.transitMode,
      userId,
      locale,
    );
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
  @RateLimit({ tier: RateLimitTier.AI_CHAT })
  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  chat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CopilotChatDto,
    @CurrentUser('id') userId: string,
    @RequestLocale() locale: AppLocale,
  ) {
    return this.copilotAgent.chat(
      id,
      dto.message,
      userId,
      dto.sessionId,
      dto.autoApply,
      locale,
    );
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
    return this.copilotAgent.applyProposal(
      id,
      dto.toolName,
      dto.args,
      userId,
      dto.proposalId,
    );
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
    await this.accessService.assertCanView(id, userId);
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
    await this.accessService.assertCanEdit(id, userId);
    await this.copilotTools.swapActivityDirect(
      id,
      destinationId,
      dto.newPlaceId,
    );
    return this.plannerService.getById(id, userId);
  }

  /**
   * Add a destination directly into a specific day without LLM round-trip.
   * POST /api/v1/itineraries/:id/destinations
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/destinations')
  @HttpCode(HttpStatus.CREATED)
  async addDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDestinationDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.accessService.assertCanEdit(id, userId);
    await this.copilotTools.addActivityDirect(id, dto);
    return this.plannerService.getById(id, userId);
  }

  /**
   * Update destination day/time/notes directly without LLM round-trip.
   * PATCH /api/v1/itineraries/:id/destinations/:destinationId
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/destinations/:destinationId')
  @HttpCode(HttpStatus.OK)
  async updateDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @Body() dto: UpdateDestinationDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.accessService.assertCanEdit(id, userId);
    await this.copilotTools.updateActivityDirect(id, destinationId, dto);
    return this.plannerService.getById(id, userId);
  }

  /**
   * Move a destination one slot earlier/later within the same day (swap order + shift time + ripple).
   * POST /api/v1/itineraries/:id/destinations/:destinationId/move
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/destinations/:destinationId/move')
  @HttpCode(HttpStatus.OK)
  async moveDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @Body() dto: MoveDestinationDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.accessService.assertCanEdit(id, userId);
    await this.copilotTools.moveActivityDirect(
      id,
      destinationId,
      dto.direction,
    );
    const updated = await this.plannerService.getById(id, userId);

    void this.eventsService.emit({
      type: ItineraryLiveEventType.STOPS_REORDERED,
      itineraryId: id,
      actor: { userId },
      payload: { destinationId, direction: dto.direction },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * SSE Stream endpoint for real-time collaboration events within an itinerary.
   * Delivers live proposals, votes, and reordering updates across participants.
   * GET /api/v1/itineraries/:id/live-events
   */
  @UseGuards(JwtAuthGuard)
  @Sse(':id/live-events')
  async subscribeLiveEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.accessService.assertCanView(id, userId);
    return this.eventsService.createStream(id, userId);
  }

  /**
   * Remove a destination from the itinerary directly without LLM round-trip.
   * DELETE /api/v1/itineraries/:id/destinations/:destinationId
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/destinations/:destinationId')
  @HttpCode(HttpStatus.OK)
  async removeDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('destinationId', ParseUUIDPipe) destinationId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.accessService.assertCanEdit(id, userId);
    await this.copilotTools.removeActivityDirect(id, destinationId);
    return this.plannerService.getById(id, userId);
  }

  /**
   * Update trip metadata (title/description for OWNER/EDITOR; partySize for OWNER only).
   * PATCH /api/v1/itineraries/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateItineraryMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItineraryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.plannerService.updateItineraryMeta(id, dto, userId);
  }
}
