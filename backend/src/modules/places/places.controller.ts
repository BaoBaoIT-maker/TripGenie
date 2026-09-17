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
} from '@nestjs/common';
import { PlacesService } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import { SemanticSearchDto, SyncEmbeddingsDto } from './dto/semantic-search.dto';
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
   * Get full details of a place by its UUID.
   * Public endpoint.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPlaceById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PlaceDetailDto> {
    return this.placesService.getPlaceById(id);
  }
}
