import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { RateLimitTier } from '@/config/rate-limit.config';
import { RawUploadFile } from '../community/interfaces/media-storage.interface';
import { PLACE_PHOTO_CONTRIBUTION_CONFIG } from './places.constants';
import { ContributePlacePhotoDto } from './dto/contribute-place-photo.dto';
import { PlacesService } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import {
  SemanticSearchDto,
  SyncEmbeddingsDto,
} from './dto/semantic-search.dto';
import { GeoJsonFeatureCollection } from '../geo/interfaces/geo.interface';
import {
  PaginatedPlacesResponseDto,
  PlaceDetailDto,
  PlaceItemDto,
  CategoryItemDto,
  TravelAreaItemDto,
} from './dto/place-response.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  /**
   * Search and filter places based on multi-criteria filter form.
   * Public endpoint.
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchPlaces(
    @Query() dto: SearchPlacesDto,
  ): Promise<PaginatedPlacesResponseDto> {
    return this.placesService.searchPlaces(dto);
  }

  /**
   * Search places and return as standard RFC 7946 GeoJSON FeatureCollection.
   * Public endpoint for interactive map rendering.
   */
  @Get('geojson')
  @HttpCode(HttpStatus.OK)
  async searchPlacesGeoJson(
    @Query() dto: SearchPlacesDto,
  ): Promise<GeoJsonFeatureCollection> {
    return this.placesService.searchPlacesGeoJson(dto);
  }

  /**
   * Natural language semantic search using Gemini Vector Embeddings & pgvector.
   * Public endpoint.
   */
  @Get('semantic-search')
  @HttpCode(HttpStatus.OK)
  async searchSemantic(
    @Query() dto: SemanticSearchDto,
  ): Promise<PlaceItemDto[]> {
    return this.placesService.searchSemantic(dto);
  }

  /**
   * Quick endpoint to find nearby places using GPS coordinates.
   * Public endpoint.
   */
  @Get('nearby')
  @HttpCode(HttpStatus.OK)
  async getNearbyPlaces(
    @Query() dto: NearbyPlacesDto,
  ): Promise<PlaceItemDto[]> {
    return this.placesService.getNearbyPlaces(dto);
  }

  /**
   * Sync and generate vector embeddings for places without embeddings.
   */
  @UseGuards(AuthGuard('jwt')) // burns Gemini quota: authenticated callers only
  @Post('sync-embeddings')
  @HttpCode(HttpStatus.OK)
  async syncEmbeddings(
    @Body() dto: SyncEmbeddingsDto,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    return this.placesService.syncEmbeddings(dto);
  }

  /**
   * List all categories for the frontend filter form and navigation pills.
   * Public endpoint.
   */
  @Get('categories')
  @HttpCode(HttpStatus.OK)
  async getCategories(): Promise<CategoryItemDto[]> {
    return this.placesService.getCategories();
  }

  /**
   * List active travel areas for the destination dropdown.
   * Public endpoint.
   */
  @Get('travel-areas')
  @HttpCode(HttpStatus.OK)
  async getTravelAreas(): Promise<TravelAreaItemDto[]> {
    return this.placesService.getTravelAreas();
  }

  /**
   * Contribute a real photo for a place (images only; videos strictly rejected).
   * Stored with PENDING status until approved by Admin.
   * POST /api/v1/places/:id/photos/contribute
   */
  @Post(':id/photos/contribute')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ tier: RateLimitTier.MEDIA_UPLOAD })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: PLACE_PHOTO_CONTRIBUTION_CONFIG.MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async contributePlacePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: RawUploadFile,
    @Body() dto: ContributePlacePhotoDto,
  ) {
    return this.placesService.contributePlacePhoto(
      id,
      userId,
      file,
      dto.caption,
    );
  }

  /**
   * Get full details of a place by its UUID.
   * Public endpoint; when logged in, also includes the viewer's own PENDING contributed photos.
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPlaceById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') viewerId?: string,
  ): Promise<PlaceDetailDto> {
    return this.placesService.getPlaceById(id, viewerId);
  }
}
