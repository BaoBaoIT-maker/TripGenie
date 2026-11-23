import { Injectable } from '@nestjs/common';
import {
  Prisma,
  AuditLog,
  UserRole,
  PlaceImageStatus,
  PlaceStatus,
  PostModerationStatus,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { CreateAuditLogInput, QueryAuditLogsDto } from './dto/admin-audit.dto';
import { ADMIN_CONSTANTS } from './admin.constants';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  resolvePagination(query: { page?: number; limit?: number }) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(
      Math.max(query.limit ?? ADMIN_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
      ADMIN_CONSTANTS.PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  buildPaginatedResponse<T>(
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
   * Lean Admin Dashboard Analytics.
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
      rejectedPosts,
      pendingPlacePhotos,
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
      this.prisma.communityPost.count({
        where: {
          deletedAt: null,
          moderationStatus: PostModerationStatus.REJECTED,
        },
      }),
      this.prisma.placeImage.count({
        where: {
          status: PlaceImageStatus.PENDING,
          place: { deletedAt: null },
        },
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
        pendingPhotos: pendingPlacePhotos,
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
        rejectedPosts,
        pendingReports,
        highPriorityReportAlerts,
        highPriorityReportThreshold: reportThreshold,
      },
    };
  }
}
