import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlacesService } from './places.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
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
