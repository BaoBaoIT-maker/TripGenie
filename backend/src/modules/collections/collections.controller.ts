import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddPlaceCollectionDto } from './dto/add-place-collection.dto';
import { TogglePlaceDto } from './dto/toggle-place.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyCollections(@CurrentUser() user: AuthenticatedUser) {
    const collections = await this.collectionsService.getUserCollections(user.id);
    return {
      message: 'Lấy danh sách bộ sưu tập thành công',
      collections,
    };
  }

  @Get('saved-place-ids')
  @UseGuards(JwtAuthGuard)
  async getSavedPlaceIds(@CurrentUser() user: AuthenticatedUser) {
    const savedPlaceIds = await this.collectionsService.getSavedPlaceIds(user.id);
    return {
      savedPlaceIds,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ) {
    const collection = await this.collectionsService.createCollection(user.id, dto);
    return {
      message: 'Tạo bộ sưu tập mới thành công',
      collection,
    };
  }

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async togglePlace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TogglePlaceDto,
  ) {
    const result = await this.collectionsService.togglePlace(user.id, dto);
    return {
      message: result.isSaved
        ? 'Đã lưu địa điểm vào bộ sưu tập'
        : 'Đã bỏ lưu địa điểm khỏi bộ sưu tập',
      ...result,
    };
  }

  @Get('containing/:placeId')
  @UseGuards(JwtAuthGuard)
  async getCollectionsContainingPlace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('placeId', ParseUUIDPipe) placeId: string,
  ) {
    const collectionIds =
      await this.collectionsService.getCollectionsContainingPlace(
        user.id,
        placeId,
      );
    return { collectionIds };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getCollectionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
  ) {
    const collection = await this.collectionsService.getCollectionDetail(userId, id);
    return {
      collection,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCollectionDto,
  ) {
    const collection = await this.collectionsService.updateCollection(
      user.id,
      id,
      dto,
    );
    return {
      message: 'Cập nhật bộ sưu tập thành công',
      collection,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionsService.deleteCollection(user.id, id);
  }

  @Post(':id/places')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addPlace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPlaceCollectionDto,
  ) {
    const result = await this.collectionsService.addPlace(user.id, id, dto);
    return {
      message: 'Thêm địa điểm vào bộ sưu tập thành công',
      result,
    };
  }

  @Delete(':id/places/:placeId')
  @UseGuards(JwtAuthGuard)
  async removePlace(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionsService.removePlace(user.id, id, placeId);
  }
}
