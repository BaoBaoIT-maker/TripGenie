import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { TransitService } from './services/transit.service';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  GenerateItineraryDto,
  TransitPreviewDto,
  BulkDeleteItinerariesDto,
  UpdateTransitModeDto,
} from './dto/generate-itinerary.dto';

@Controller('itineraries')
export class ItinerariesController {
  constructor(
    private readonly plannerService: ItineraryPlannerService,
    private readonly transitService: TransitService,
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
}