import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import {
  ICollectionsRepository,
  CollectionWithCount,
  CollectionDetail,
  DEFAULT_COLLECTION_TITLE,
} from './interfaces/collections-repository.interface';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddPlaceCollectionDto } from './dto/add-place-collection.dto';
import { TogglePlaceDto } from './dto/toggle-place.dto';
import { Collection, CollectionPlace } from '@prisma/client';

@Injectable()
export class CollectionsService {
  constructor(
    @Inject(INJECT_TOKENS.COLLECTION_REPOSITORY)
    private readonly collectionsRepo: ICollectionsRepository,
  ) {}

  async getUserCollections(userId: string): Promise<CollectionWithCount[]> {
    // Ensure default "Yêu thích" exists
    await this.collectionsRepo.findOrCreateDefaultCollection(userId);
    return this.collectionsRepo.findUserCollections(userId);
  }

  async getSavedPlaceIds(userId: string): Promise<string[]> {
    return this.collectionsRepo.findSavedPlaceIds(userId);
  }

  async getCollectionDetail(
    userId: string | undefined,
    collectionId: string,
  ): Promise<CollectionDetail> {
    const col = await this.collectionsRepo.findCollectionById(collectionId);
    if (!col) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    if (!col.isPublic && (!userId || col.userId !== userId)) {
      throw new ForbiddenException('Bạn không có quyền xem bộ sưu tập này');
    }

    return col;
  }

  async createCollection(
    userId: string,
    dto: CreateCollectionDto,
  ): Promise<Collection> {
    const cleanTitle = dto.title.trim();
    if (cleanTitle.toLowerCase() === DEFAULT_COLLECTION_TITLE.toLowerCase()) {
      throw new BadRequestException(
        `Tên "${DEFAULT_COLLECTION_TITLE}" đã được dùng cho bộ sưu tập mặc định`,
      );
    }

    return this.collectionsRepo.createCollection({
      userId,
      title: cleanTitle,
      description: dto.description?.trim(),
      isPublic: dto.isPublic ?? false,
      coverImage: dto.coverImage,
    });
  }

  async updateCollection(
    userId: string,
    collectionId: string,
    dto: UpdateCollectionDto,
  ): Promise<Collection> {
    const existing = await this.collectionsRepo.findCollectionById(collectionId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bộ sưu tập này');
    }

    const isDefault = existing.title === DEFAULT_COLLECTION_TITLE;
    const trimmedTitle = dto.title?.trim();

    if (
      !isDefault &&
      trimmedTitle &&
      trimmedTitle.toLowerCase() === DEFAULT_COLLECTION_TITLE.toLowerCase()
    ) {
      throw new BadRequestException(
        `Không thể đổi tên trùng với bộ sưu tập mặc định "${DEFAULT_COLLECTION_TITLE}"`,
      );
    }

    const resolvedTitle = isDefault ? undefined : trimmedTitle || undefined;

    return this.collectionsRepo.updateCollection(collectionId, {
      title: resolvedTitle,
      description:
        dto.description !== undefined ? dto.description.trim() : undefined,
      isPublic: dto.isPublic,
      coverImage: dto.coverImage,
    });
  }

  async deleteCollection(
    userId: string,
    collectionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.collectionsRepo.findCollectionById(collectionId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa bộ sưu tập này');
    }

    if (existing.title === DEFAULT_COLLECTION_TITLE) {
      throw new BadRequestException(
        `Không thể xóa bộ sưu tập mặc định "${DEFAULT_COLLECTION_TITLE}"`,
      );
    }

    await this.collectionsRepo.softDeleteCollection(collectionId);
    return {
      success: true,
      message: 'Xóa bộ sưu tập thành công',
    };
  }

  async togglePlace(
    userId: string,
    dto: TogglePlaceDto,
  ): Promise<{ isSaved: boolean; collectionId: string; placeId: string }> {
    const targetCollectionId = dto.collectionId;

    if (targetCollectionId) {
      const existing =
        await this.collectionsRepo.findCollectionById(targetCollectionId);
      if (!existing) {
        throw new NotFoundException('Không tìm thấy bộ sưu tập');
      }
      if (existing.userId !== userId) {
        throw new ForbiddenException(
          'Bạn không có quyền thao tác trên bộ sưu tập này',
        );
      }

      const alreadySaved = await this.collectionsRepo.isPlaceInCollection(
        targetCollectionId,
        dto.placeId,
      );

      if (alreadySaved) {
        await this.collectionsRepo.removePlaceFromCollection(
          targetCollectionId,
          dto.placeId,
        );
        return {
          isSaved: false,
          collectionId: targetCollectionId,
          placeId: dto.placeId,
        };
      }

      await this.collectionsRepo.addPlaceToCollection(
        targetCollectionId,
        dto.placeId,
      );
      return {
        isSaved: true,
        collectionId: targetCollectionId,
        placeId: dto.placeId,
      };
    }

    // Global toggle: When no collectionId is specified
    const containing = await this.collectionsRepo.findCollectionsContainingPlace(
      userId,
      dto.placeId,
    );

    if (containing.length > 0) {
      await Promise.all(
        containing.map((colId) =>
          this.collectionsRepo.removePlaceFromCollection(colId, dto.placeId),
        ),
      );
      return {
        isSaved: false,
        collectionId: containing[0],
        placeId: dto.placeId,
      };
    }

    const defaultCol =
      await this.collectionsRepo.findOrCreateDefaultCollection(userId);
    await this.collectionsRepo.addPlaceToCollection(defaultCol.id, dto.placeId);
    return {
      isSaved: true,
      collectionId: defaultCol.id,
      placeId: dto.placeId,
    };
  }

  async addPlace(
    userId: string,
    collectionId: string,
    dto: AddPlaceCollectionDto,
  ): Promise<CollectionPlace> {
    const existing = await this.collectionsRepo.findCollectionById(collectionId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thêm địa điểm vào bộ sưu tập này');
    }

    return this.collectionsRepo.addPlaceToCollection(
      collectionId,
      dto.placeId,
      dto.notes,
    );
  }

  async removePlace(
    userId: string,
    collectionId: string,
    placeId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.collectionsRepo.findCollectionById(collectionId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa địa điểm khỏi bộ sưu tập này');
    }

    await this.collectionsRepo.removePlaceFromCollection(collectionId, placeId);
    return {
      success: true,
      message: 'Đã xóa địa điểm khỏi bộ sưu tập',
    };
  }

  async getCollectionsContainingPlace(
    userId: string,
    placeId: string,
  ): Promise<string[]> {
    return this.collectionsRepo.findCollectionsContainingPlace(userId, placeId);
  }
}

