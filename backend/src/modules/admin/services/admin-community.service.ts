import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { normalizeVietnamese } from '@/common/utils/string.util';
import { AdminRequestMeta } from '../dto/admin-users.dto';
import {
  AdminCreateCommunityGroupDto,
  AdminUpdateCommunityGroupDto,
  QueryAdminCommunityGroupsDto,
} from '../dto/admin-community.dto';
import { ADMIN_CONSTANTS, ADMIN_ERRORS } from '../admin.constants';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  // ponytail: slug acts as an immutable canonical identifier; future multi-language i18n upgrade path is adding a translations JSONB column or polymorphic entity_translations table without breaking group URLs.
  private slugifyGroupName(input: string): string {
    return normalizeVietnamese(input)
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, ADMIN_CONSTANTS.VALIDATION.MAX_GROUP_SLUG_LENGTH);
  }

  async getCommunityGroups(query: QueryAdminCommunityGroupsDto) {
    const { page, limit, skip } = this.adminService.resolvePagination(query);

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

    return this.adminService.buildPaginatedResponse(items, total, page, limit);
  }

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

      await this.adminService.logAudit(
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

      await this.adminService.logAudit(
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

      const defaultGroup = await tx.communityGroup.findFirst({
        where: { isDefault: true, deletedAt: null },
      });

      if (defaultGroup) {
        await tx.communityPost.updateMany({
          where: { groupId },
          data: { groupId: defaultGroup.id },
        });
      } else {
        await tx.communityPost.updateMany({
          where: { groupId },
          data: { groupId: null },
        });
      }

      const deletedAt = new Date();
      await tx.communityGroup.update({
        where: { id: groupId },
        data: {
          deletedAt,
          isActive: false,
          postCount: 0,
        },
      });

      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`
          UPDATE community_groups cg
          SET post_count = CASE
            WHEN cg.is_default = true THEN (
              SELECT COUNT(*)::int FROM community_posts cp
              WHERE cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
            )
            ELSE (
              SELECT COUNT(*)::int FROM community_posts cp
              WHERE cp.group_id = cg.id AND cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
            )
          END;
        `;
      }

      await this.adminService.logAudit(
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
}
