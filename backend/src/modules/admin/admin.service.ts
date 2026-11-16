import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Prisma,
  AuditLog,
  UserRole,
  AuditAction,
  PlaceStatus,
  PostModerationStatus,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { normalizeVietnamese } from '@/common/utils/string.util';
import { CreateAuditLogInput, QueryAuditLogsDto } from './dto/admin-audit.dto';
import {
  AdminBanUserDto,
  AdminPromoteUserDto,
  AdminRequestMeta,
  QueryAdminUsersDto,
} from './dto/admin-users.dto';
import {
  AdminCreatePlaceDto,
  AdminUpdatePlaceDto,
  QueryAdminPlacesDto,
} from './dto/admin-places.dto';
import {
  AdminCreateCommunityGroupDto,
  AdminUpdateCommunityGroupDto,
  QueryAdminCommunityGroupsDto,
} from './dto/admin-community.dto';
import { ADMIN_CONSTANTS, ADMIN_ERRORS } from './admin.constants';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePagination(query: { page?: number; limit?: number }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(
      Math.max(query.limit ?? ADMIN_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
      ADMIN_CONSTANTS.PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private normalizePlaceName(name: string): string {
    return normalizeVietnamese(name)
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ');
  }

  // ponytail: slug acts as an immutable canonical identifier; future multi-language i18n upgrade path is adding a translations JSONB column or polymorphic entity_translations table without breaking group URLs.
  private slugifyGroupName(input: string): string {
    return this.normalizePlaceName(input)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SLUG_LENGTH);
  }

  private async findManageableUserOrThrow(
    tx: Prisma.TransactionClient,
    targetUserId: string,
    adminRoleError: { code: string; message: string } = ADMIN_ERRORS.CANNOT_MANAGE_ADMIN,
  ) {
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(ADMIN_ERRORS.USER_NOT_FOUND);
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(adminRoleError);
    }

    return user;
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

  /**
   * Centralized helper to write an entry to audit_logs table.
   * Can run standalone or within a Prisma transaction client.
   */
  async logAudit(
    input: CreateAuditLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AuditLog> {
    const client = tx ?? this.prisma;

    const serializeJson = (data: unknown): Prisma.InputJsonValue | undefined => {
      if (data === undefined || data === null) return undefined;
      try {
        return JSON.parse(JSON.stringify(data));
      } catch {
        return undefined;
      }
    };

    return client.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        beforeData: serializeJson(input.beforeData),
        afterData: serializeJson(input.afterData),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  /**
   * Retrieves paginated audit logs with filtering by action, targetType, actor, and date range.
   */
  async getAuditLogs(query: QueryAuditLogsDto) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.targetType) {
      where.targetType = query.targetType;
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return this.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Retrieves paginated regular users (role: USER).
   * Strict security requirement: Admin accounts are completely excluded from this query.
   */
  async getUsers(query: QueryAdminUsersDto) {
    const { page, limit, skip } = this.resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      role: UserRole.USER, // Hard isolation: only regular users
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const term = query.search.trim();
      if (term.length > 0) {
        where.OR = [
          { email: { contains: term, mode: 'insensitive' } },
          { fullName: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              posts: true,
              itineraries: true,
              reviews: true,
            },
          },
        },
      }),
    ]);

    return this.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Bans a user account, revokes sessions via authVersion, and records audit trail inside a single transaction.
   */
  async banUser(
    admin: AuthenticatedUser,
    targetUserId: string,
    dto: AdminBanUserDto,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.findManageableUserOrThrow(tx, targetUserId);

      if (!user.isActive) {
        throw new BadRequestException(ADMIN_ERRORS.USER_ALREADY_BANNED);
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          isActive: false,
          authVersion: { increment: 1 }, // Forces all active JWT sessions to become invalid
        },
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.BAN,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.USER,
          targetId: user.id,
          targetLabel: user.email ?? user.fullName,
          beforeData: { isActive: true },
          afterData: { isActive: false, reason: dto.reason },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: dto.reason,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.BAN_SUCCESS,
      userId: targetUserId,
    };
  }

  /**
   * Unbans a user account and records audit trail inside a single transaction.
   */
  async unbanUser(
    admin: AuthenticatedUser,
    targetUserId: string,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.findManageableUserOrThrow(tx, targetUserId);

      if (user.isActive) {
        throw new BadRequestException(ADMIN_ERRORS.USER_NOT_BANNED);
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          isActive: true,
        },
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.UNBAN,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.USER,
          targetId: user.id,
          targetLabel: user.email ?? user.fullName,
          beforeData: { isActive: false },
          afterData: { isActive: true },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_UNBAN_NOTE,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.UNBAN_SUCCESS,
      userId: targetUserId,
    };
  }

  /**
   * Promotes a regular user to ADMIN (unidirectional promotion) and records audit trail inside a single transaction.
   */
  async promoteUserToAdmin(
    admin: AuthenticatedUser,
    targetUserId: string,
    dto?: AdminPromoteUserDto,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.findManageableUserOrThrow(
        tx,
        targetUserId,
        ADMIN_ERRORS.USER_ALREADY_ADMIN,
      );

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          role: UserRole.ADMIN,
          authVersion: { increment: 1 }, // Forces token regeneration to acquire new ADMIN role
        },
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.UPDATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.USER,
          targetId: user.id,
          targetLabel: user.email ?? user.fullName,
          beforeData: { role: UserRole.USER },
          afterData: { role: UserRole.ADMIN, notes: dto?.notes },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: dto?.notes ?? ADMIN_CONSTANTS.MESSAGES.DEFAULT_PROMOTE_NOTE,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.PROMOTE_SUCCESS,
      userId: targetUserId,
    };
  }

  /**
   * Step 3: Retrieves paginated places for Admin management.
   */
  async getPlaces(query: QueryAdminPlacesDto) {
    const { page, limit, skip } = this.resolvePagination(query);

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
            orderBy: { displayOrder: 'asc' },
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

    return this.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Step 3: Creates a new place with WGS84 + Area bounding box validation and PostGIS spatial point sync.
   */
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
            source: 'admin',
          })),
        });
      }

      await this.logAudit(
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

  /**
   * Step 3: Updates an existing place with coordinate & area validation, PostGIS sync, and audit snapshot.
   */
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
              source: 'admin',
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

      await this.logAudit(
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

  /**
   * Step 3: Safe deletion via Soft-Delete (deletedAt + INACTIVE) to preserve user itineraries and collections.
   */
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

      await this.logAudit(
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
   * Step 4: Retrieves paginated Community Groups (Topics) for Admin management.
   */
  async getCommunityGroups(query: QueryAdminCommunityGroupsDto) {
    const { page, limit, skip } = this.resolvePagination(query);

    const where: Prisma.CommunityGroupWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const term = query.search.trim();
      if (term.length > 0) {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { subtitle: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.communityGroup.count({ where }),
      this.prisma.communityGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      }),
    ]);

    return this.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Step 4: Creates a new Community Group (Topic) with unique slug generation and audit trail.
   */
  async createCommunityGroup(
    admin: AuthenticatedUser,
    dto: AdminCreateCommunityGroupDto,
    meta?: AdminRequestMeta,
  ) {
    const createdGroup = await this.prisma.$transaction(async (tx) => {
      const trimmedName = dto.name.trim();
      const slug = this.slugifyGroupName(dto.slug?.trim() || trimmedName);

      if (!slug) {
        throw new BadRequestException(ADMIN_ERRORS.INVALID_GROUP_SLUG);
      }

      const existingBySlug = await tx.communityGroup.findUnique({
        where: { slug },
      });

      if (existingBySlug) {
        throw new ConflictException(ADMIN_ERRORS.GROUP_SLUG_EXISTS);
      }

      const group = await tx.communityGroup.create({
        data: {
          name: trimmedName,
          slug,
          subtitle: dto.subtitle?.trim() ?? null,
          description: dto.description?.trim() ?? null,
          iconUrl: dto.iconUrl?.trim() ?? null,
          coverUrl: dto.coverUrl?.trim() ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          isDefault: false,
          createdBy: admin.id,
        },
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.CREATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.COMMUNITY_GROUP,
          targetId: group.id,
          targetLabel: group.name,
          beforeData: null,
          afterData: group,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_CREATE_GROUP_NOTE,
        },
        tx,
      );

      return group;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.CREATE_GROUP_SUCCESS,
      data: createdGroup,
    };
  }

  /**
   * Step 4: Updates an existing Community Group (Topic), protecting default group from deactivation.
   */
  async updateCommunityGroup(
    admin: AuthenticatedUser,
    groupId: string,
    dto: AdminUpdateCommunityGroupDto,
    meta?: AdminRequestMeta,
  ) {
    const updatedGroup = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityGroup.findUnique({
        where: { id: groupId },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.GROUP_NOT_FOUND);
      }

      if (existing.isDefault && dto.isActive === false) {
        throw new BadRequestException(ADMIN_ERRORS.CANNOT_DELETE_DEFAULT_GROUP);
      }

      const updateData: Prisma.CommunityGroupUpdateInput = {};

      if (dto.name !== undefined) {
        updateData.name = dto.name.trim();
      }

      if (dto.slug !== undefined) {
        const nextSlug = this.slugifyGroupName(dto.slug.trim());
        if (!nextSlug) {
          throw new BadRequestException(ADMIN_ERRORS.INVALID_GROUP_SLUG);
        }

        if (nextSlug !== existing.slug) {
          const duplicate = await tx.communityGroup.findUnique({
            where: { slug: nextSlug },
          });
          if (duplicate && duplicate.id !== groupId) {
            throw new ConflictException(ADMIN_ERRORS.GROUP_SLUG_EXISTS);
          }
          updateData.slug = nextSlug;
        }
      }

      if (dto.subtitle !== undefined) {
        updateData.subtitle = dto.subtitle?.trim() ?? null;
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description?.trim() ?? null;
      }
      if (dto.iconUrl !== undefined) {
        updateData.iconUrl = dto.iconUrl?.trim() ?? null;
      }
      if (dto.coverUrl !== undefined) {
        updateData.coverUrl = dto.coverUrl?.trim() ?? null;
      }
      if (dto.sortOrder !== undefined) {
        updateData.sortOrder = dto.sortOrder;
      }
      if (dto.isActive !== undefined) {
        updateData.isActive = dto.isActive;
      }

      const updated = await tx.communityGroup.update({
        where: { id: groupId },
        data: updateData,
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.UPDATE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.COMMUNITY_GROUP,
          targetId: updated.id,
          targetLabel: updated.name,
          beforeData: existing,
          afterData: updated,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_UPDATE_GROUP_NOTE,
        },
        tx,
      );

      return updated;
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.UPDATE_GROUP_SUCCESS,
      data: updatedGroup,
    };
  }

  /**
   * Step 4: Safe soft-delete of a Community Group (Topic), protecting default group and preserving user posts.
   */
  async deleteCommunityGroup(
    admin: AuthenticatedUser,
    groupId: string,
    meta?: AdminRequestMeta,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityGroup.findUnique({
        where: { id: groupId },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(ADMIN_ERRORS.GROUP_NOT_FOUND);
      }

      if (existing.isDefault) {
        throw new BadRequestException(ADMIN_ERRORS.CANNOT_DELETE_DEFAULT_GROUP);
      }

      const deletedAt = new Date();
      await tx.communityGroup.update({
        where: { id: groupId },
        data: {
          deletedAt,
          isActive: false,
        },
      });

      await this.logAudit(
        {
          actorId: admin.id,
          actorRole: admin.role,
          action: AuditAction.DELETE,
          targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.COMMUNITY_GROUP,
          targetId: existing.id,
          targetLabel: existing.name,
          beforeData: existing,
          afterData: {
            isActive: false,
            deletedAt: deletedAt.toISOString(),
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          notes: ADMIN_CONSTANTS.MESSAGES.DEFAULT_DELETE_GROUP_NOTE,
        },
        tx,
      );
    });

    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.DELETE_GROUP_SUCCESS,
      groupId,
    };
  }

  /**
   * Step 6: Lean Admin Dashboard Analytics.
   * Executes a single batched transaction to aggregate User, Place, Community, and Moderation KPIs.
   */
  async getDashboardStats() {
    const windowMs =
      ADMIN_CONSTANTS.DASHBOARD.NEW_USERS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);
    const reportThreshold =
      ADMIN_CONSTANTS.MODERATION.HIGH_PRIORITY_REPORT_THRESHOLD;

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newUsersThisWeek,
      totalPlaces,
      activePlaces,
      inactivePlaces,
      categoriesWithCount,
      approvedPosts,
      pendingPosts,
      flaggedPosts,
      totalComments,
      activeGroups,
      pendingReports,
      pendingReportsByTarget,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: { role: UserRole.USER, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { role: UserRole.USER, deletedAt: null, isActive: true },
      }),
      this.prisma.user.count({
        where: { role: UserRole.USER, deletedAt: null, isActive: false },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.USER,
          deletedAt: null,
          createdAt: { gte: windowStart },
        },
      }),
      this.prisma.place.count({
        where: { deletedAt: null },
      }),
      this.prisma.place.count({
        where: { deletedAt: null, status: PlaceStatus.ACTIVE },
      }),
      this.prisma.place.count({
        where: { deletedAt: null, status: PlaceStatus.INACTIVE },
      }),
      this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          nameVi: true,
          slug: true,
          _count: {
            select: {
              places: {
                where: { deletedAt: null, status: PlaceStatus.ACTIVE },
              },
            },
          },
        },
      }),
      this.prisma.communityPost.count({
        where: {
          deletedAt: null,
          moderationStatus: PostModerationStatus.APPROVED,
        },
      }),
      this.prisma.communityPost.count({
        where: {
          deletedAt: null,
          moderationStatus: PostModerationStatus.PENDING,
        },
      }),
      this.prisma.communityPost.count({
        where: {
          deletedAt: null,
          moderationStatus: PostModerationStatus.FLAGGED,
        },
      }),
      this.prisma.postComment.count({
        where: { deletedAt: null },
      }),
      this.prisma.communityGroup.count({
        where: { deletedAt: null, isActive: true },
      }),
      this.prisma.contentReport.count({
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.contentReport.groupBy({
        by: ['targetType', 'targetId'],
        orderBy: { targetId: 'asc' },
        where: { status: ReportStatus.PENDING },
        _count: { _all: true },
      }),
    ]);

    const highPriorityReportAlerts = pendingReportsByTarget.filter((g) => {
      const count =
        typeof g._count === 'object' && g._count !== null && '_all' in g._count
          ? (g._count._all ?? 0)
          : 0;
      return count >= reportThreshold;
    }).length;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        newThisWeek: newUsersThisWeek,
      },
      places: {
        total: totalPlaces,
        active: activePlaces,
        inactive: inactivePlaces,
        byCategory: categoriesWithCount.map((c) => ({
          id: c.id,
          name: c.name,
          nameVi: c.nameVi,
          slug: c.slug,
          placeCount: c._count.places,
        })),
      },
      community: {
        approvedPosts,
        totalComments,
        activeGroups,
      },
      moderation: {
        pendingPosts,
        flaggedPosts,
        pendingReports,
        highPriorityReportAlerts,
        highPriorityReportThreshold: reportThreshold,
      },
    };
  }
}
