import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  AuditAction,
  PlaceImageStatus,
  PlaceStatus,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { normalizeVietnamese } from '@/common/utils/string.util';
import { AdminRequestMeta } from '../dto/admin-users.dto';
import {
  AdminCreatePlaceDto,
  AdminUpdatePlaceDto,
  QueryAdminPlacesDto,
} from '../dto/admin-places.dto';
import {
  AdminApprovePlacePhotoDto,
  AdminRejectPlacePhotoDto,
  QueryAdminPlacePhotosDto,
} from '../dto/admin-place-photos.dto';
import { ADMIN_CONSTANTS, ADMIN_ERRORS } from '../admin.constants';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminPlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  private normalizePlaceName(name: string): string {
    return normalizeVietnamese(name)
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ');
  }

  private async validatePlaceReferencesAndBounds(
    tx: Prisma.TransactionClient,
    params: {
      latitude: number;
      longitude: number;
      areaId?: number | null;
      categoryId?: number | null;
    },
  ) {
    const { latitude, longitude, areaId, categoryId } = params;

    const isValidWGS84 =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= ADMIN_CONSTANTS.COORDINATES.MIN_LAT &&
      latitude <= ADMIN_CONSTANTS.COORDINATES.MAX_LAT &&
      longitude >= ADMIN_CONSTANTS.COORDINATES.MIN_LNG &&
      longitude <= ADMIN_CONSTANTS.COORDINATES.MAX_LNG &&
      !(latitude === 0 && longitude === 0);

    if (!isValidWGS84) {
      throw new BadRequestException(ADMIN_ERRORS.INVALID_COORDINATES);
    }

    if (categoryId !== undefined && categoryId !== null) {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(ADMIN_ERRORS.CATEGORY_NOT_FOUND);
      }
    }

    if (areaId !== undefined && areaId !== null) {
      const area = await tx.travelArea.findUnique({
        where: { id: areaId },
      });
      if (!area) {
        throw new NotFoundException(ADMIN_ERRORS.AREA_NOT_FOUND);
      }

      if (
        area.bboxMinLat !== null &&
        area.bboxMaxLat !== null &&
        area.bboxMinLng !== null &&
        area.bboxMaxLng !== null
      ) {
        const isOutsideArea =
          latitude < area.bboxMinLat ||
          latitude > area.bboxMaxLat ||
          longitude < area.bboxMinLng ||
          longitude > area.bboxMaxLng;

        if (isOutsideArea) {
          throw new BadRequestException(ADMIN_ERRORS.COORDINATES_OUTSIDE_AREA);
        }
      }
    }
  }

  async getPlaces(query: QueryAdminPlacesDto) {
    const { page, limit, skip } = this.adminService.resolvePagination(query);

    const where: Prisma.PlaceWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
    };

    if (query.areaId !== undefined) {
      where.areaId = query.areaId;
    }

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      if (term.length > 0) {
        const normalizedTerm = this.normalizePlaceName(term);
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { nameNormalized: { contains: normalizedTerm, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.place.count({ where }),
      this.prisma.place.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, nameVi: true, slug: true },
          },
          area: {
            select: { id: true, name: true, nameVi: true, slug: true, type: true },
          },
          images: {
            where: { status: PlaceImageStatus.APPROVED },
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 5,
          },
          _count: {
            select: {
              destinations: true,
              collectionPlaces: true,
              reviews: true,
            },
          },
        },
      }),
    ]);

    return this.adminService.buildPaginatedResponse(items, total, page, limit);
  }

  async createPlace(
    admin: AuthenticatedUser,
    dto: AdminCreatePlaceDto,
    meta?: AdminRequestMeta,
  ) {
    const createdPlace = await this.prisma.$transaction(async (tx) => {
      await this.validatePlaceReferencesAndBounds(tx, {
        latitude: dto.latitude,
        longitude: dto.longitude,
        areaId: dto.areaId,
        categoryId: dto.categoryId,
      });

      const trimmedName = dto.name.trim();
      const nameNormalized = this.normalizePlaceName(trimmedName);
      const imageUrls = dto.imageUrls?.filter((u) => u.trim().length > 0) ?? [];

      const place = await tx.place.create({
        data: {
          name: trimmedName,
          nameNormalized,
          description: dto.description?.trim() ?? null,
          address: dto.address.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          areaId: dto.areaId ?? null,
          categoryId: dto.categoryId ?? null,
          priceLevel: dto.priceLevel ?? null,
          openingHours: (dto.openingHours as Prisma.InputJsonValue) ?? Prisma.DbNull,
          phone: dto.phone?.trim() ?? null,
          website: dto.website?.trim() ?? null,
          tags: dto.tags ?? [],
          imageCount: imageUrls.length,
          status: dto.status ?? PlaceStatus.ACTIVE,
          createdBy: admin.id,
        },
      });

      await tx.$executeRaw`
        UPDATE places
        SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)
        WHERE id = ${place.id}::uuid
      `;

      if (imageUrls.length > 0) {
        await tx.placeImage.createMany({
          data: imageUrls.map((url, idx) => ({
            placeId: place.id,
            imageUrl: url.trim(),
            displayOrder: idx,
            isPrimary: idx === 0,
            source: ADMIN_CONSTANTS.PLACE_IMAGE_SOURCES.ADMIN,
          })),
        });
      }

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.CREATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.PLACE,
          targetId: place.id,
          targetLabel: place.name,
          beforeData: null,
          afterData: place,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_CREATE_PLACE_NOTE,
        },
        tx,
      );

      return place;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.CREATE_PLACE_SUCCESS,
      data: createdPlace,
    };
  }

  async updatePlace(
    admin: AuthenticatedUser,
    placeId: string,
    dto: AdminUpdatePlaceDto,
    meta?: AdminRequestMeta,
  ) {
    const updatedPlace = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.place.findUnique({
        where: { id: placeId },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.PLACE_NOT_FOUND);
      }

      const nextLat = dto.latitude ?? existing.latitude;
      const nextLng = dto.longitude ?? existing.longitude;
      const nextAreaId = dto.areaId !== undefined ? dto.areaId : existing.areaId;
      const nextCategoryId =
        dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;

      await this.validatePlaceReferencesAndBounds(tx, {
        latitude: nextLat,
        longitude: nextLng,
        areaId: nextAreaId,
        categoryId: nextCategoryId,
      });

      const updateData: Prisma.PlaceUncheckedUpdateInput = {};

      if (dto.name !== undefined) {
        const trimmedName = dto.name.trim();
        updateData.name = trimmedName;
        updateData.nameNormalized = this.normalizePlaceName(trimmedName);
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description?.trim() ?? null;
      }
      if (dto.address !== undefined) {
        updateData.address = dto.address.trim();
      }
      if (dto.latitude !== undefined) {
        updateData.latitude = dto.latitude;
      }
      if (dto.longitude !== undefined) {
        updateData.longitude = dto.longitude;
      }
      if (dto.areaId !== undefined) {
        updateData.areaId = dto.areaId;
      }
      if (dto.categoryId !== undefined) {
        updateData.categoryId = dto.categoryId;
      }
      if (dto.priceLevel !== undefined) {
        updateData.priceLevel = dto.priceLevel;
      }
      if (dto.openingHours !== undefined) {
        updateData.openingHours = dto.openingHours
          ? (dto.openingHours as Prisma.InputJsonValue)
          : Prisma.DbNull;
      }
      if (dto.phone !== undefined) {
        updateData.phone = dto.phone?.trim() ?? null;
      }
      if (dto.website !== undefined) {
        updateData.website = dto.website?.trim() ?? null;
      }
      if (dto.tags !== undefined) {
        updateData.tags = dto.tags;
      }
      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      if (dto.imageUrls !== undefined) {
        const cleanUrls = dto.imageUrls.filter((u) => u.trim().length > 0);
        updateData.imageCount = cleanUrls.length;
        await tx.placeImage.deleteMany({ where: { placeId } });
        if (cleanUrls.length > 0) {
          await tx.placeImage.createMany({
            data: cleanUrls.map((url, idx) => ({
              placeId,
              imageUrl: url.trim(),
              displayOrder: idx,
              isPrimary: idx === 0,
              source: ADMIN_CONSTANTS.PLACE_IMAGE_SOURCES.ADMIN,
            })),
          });
        }
      }

      const updated = await tx.place.update({
        where: { id: placeId },
        data: updateData,
      });

      if (dto.latitude !== undefined || dto.longitude !== undefined) {
        await tx.$executeRaw`
          UPDATE places
          SET location = ST_SetSRID(ST_MakePoint(${nextLng}, ${nextLat}), 4326)
          WHERE id = ${placeId}::uuid
        `;
      }

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.UPDATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.PLACE,
          targetId: updated.id,
          targetLabel: updated.name,
          beforeData: existing,
          afterData: updated,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_UPDATE_PLACE_NOTE,
        },
        tx,
      );

      return updated;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.UPDATE_PLACE_SUCCESS,
      data: updatedPlace,
    };
  }

  async deletePlace(
    admin: AuthenticatedUser,
    placeId: string,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.place.findUnique({
        where: { id: placeId },
        include: {
          _count: {
            select: {
              destinations: true,
              collectionPlaces: true,
              reviews: true,
              proposals: true,
            },
          },
        },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.PLACE_NOT_FOUND);
      }

      const deletedAt = new Date();
      await tx.place.update({
        where: { id: placeId },
        data: {
          deletedAt,
          status: PlaceStatus.INACTIVE,
        },
      });

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.DELETE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.PLACE,
          targetId: existing.id,
          targetLabel: existing.name,
          beforeData: {
            status: existing.status,
            deletedAt: null,
            referenceCounts: existing._count,
          },
          afterData: {
            status: PlaceStatus.INACTIVE,
            deletedAt: deletedAt.toISOString(),
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_DELETE_PLACE_NOTE,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.DELETE_PLACE_SUCCESS,
      placeId,
    };
  }

  /**
   * Lists user-contributed place photos for Admin curation (PENDING / APPROVED / REJECTED).
   */
  async getPlacePhotoContributions(query: QueryAdminPlacePhotosDto) {
    const { page, limit, skip } = this.adminService.resolvePagination(query);

    const where: Prisma.PlaceImageWhereInput = {
      place: { deletedAt: null },
      OR: [
        { uploadedById: { not: null } },
        { source: ADMIN_CONSTANTS.PLACE_IMAGE_SOURCES.USER_CONTRIBUTION },
      ],
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      if (term.length > 0) {
        where.AND = [
          {
            OR: [
              { caption: { contains: term, mode: 'insensitive' } },
              { place: { name: { contains: term, mode: 'insensitive' } } },
              {
                uploadedBy: {
                  fullName: { contains: term, mode: 'insensitive' },
                },
              },
              {
                uploadedBy: {
                  email: { contains: term, mode: 'insensitive' },
                },
              },
            ],
          },
        ];
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.placeImage.count({ where }),
      this.prisma.placeImage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          place: {
            select: {
              id: true,
              name: true,
              address: true,
              area: { select: { id: true, name: true, nameVi: true } },
            },
          },
          uploadedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return this.adminService.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Approves a user-contributed place photo (also allows restoring a previously rejected photo).
   * Optionally promotes it as the place's primary cover image atomically.
   */
  async approvePlacePhoto(
    admin: AuthenticatedUser,
    imageId: string,
    dto?: AdminApprovePlacePhotoDto,
    meta?: AdminRequestMeta,
  ) {
    const existing = await this.prisma.placeImage.findUnique({
      where: { id: imageId },
      include: {
        place: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(ADMIN_ERRORS.PLACE_IMAGE_NOT_FOUND);
    }

    const setAsPrimary = Boolean(dto?.setAsPrimary);
    const note =
      dto?.note?.trim() || ADMIN_CONSTANTS.MESSAGES.DEFAULT_APPROVE_PLACE_PHOTO_NOTE;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (setAsPrimary) {
        await tx.placeImage.updateMany({
          where: { placeId: existing.placeId, id: { not: existing.id } },
          data: { isPrimary: false },
        });
      }

      const nextImage = await tx.placeImage.update({
        where: { id: existing.id },
        data: {
          status: PlaceImageStatus.APPROVED,
          isPrimary: setAsPrimary ? true : existing.isPrimary,
          reviewedById: admin.id,
          reviewedAt: new Date(),
          moderationNote: note,
        },
        include: {
          place: { select: { id: true, name: true, address: true } },
          uploadedBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.APPROVE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.PLACE_IMAGE,
          targetId: existing.id,
          targetLabel: existing.place?.name || existing.id,
          beforeData: {
            status: existing.status,
            isPrimary: existing.isPrimary,
          },
          afterData: {
            status: PlaceImageStatus.APPROVED,
            isPrimary: nextImage.isPrimary,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: setAsPrimary ? `${note} (Đặt làm ảnh chính)` : note,
        },
        tx,
      );

      return nextImage;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.APPROVE_PLACE_PHOTO_SUCCESS,
      image: updated,
    };
  }

  /**
   * Rejects a user-contributed place photo while retaining the Cloudinary asset
   * so Admins can still review or restore it from the Rejected tab.
   */
  async rejectPlacePhoto(
    admin: AuthenticatedUser,
    imageId: string,
    dto?: AdminRejectPlacePhotoDto,
    meta?: AdminRequestMeta,
  ) {
    const existing = await this.prisma.placeImage.findUnique({
      where: { id: imageId },
      include: {
        place: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(ADMIN_ERRORS.PLACE_IMAGE_NOT_FOUND);
    }

    const reason =
      dto?.reason?.trim() || ADMIN_CONSTANTS.MESSAGES.DEFAULT_REJECT_PLACE_PHOTO_NOTE;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextImage = await tx.placeImage.update({
        where: { id: existing.id },
        data: {
          status: PlaceImageStatus.REJECTED,
          isPrimary: false,
          reviewedById: admin.id,
          reviewedAt: new Date(),
          moderationNote: reason,
        },
        include: {
          place: { select: { id: true, name: true, address: true } },
          uploadedBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      await this.adminService.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.REJECT,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.PLACE_IMAGE,
          targetId: existing.id,
          targetLabel: existing.place?.name || existing.id,
          beforeData: {
            status: existing.status,
            isPrimary: existing.isPrimary,
          },
          afterData: {
            status: PlaceImageStatus.REJECTED,
            isPrimary: false,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: reason,
        },
        tx,
      );

      return nextImage;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.REJECT_PLACE_PHOTO_SUCCESS,
      image: updated,
    };
  }
}
