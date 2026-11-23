import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole, AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import {
  AdminBanUserDto,
  AdminPromoteUserDto,
  AdminRequestMeta,
  QueryAdminUsersDto,
} from '../dto/admin-users.dto';
import { ADMIN_CONSTANTS, ADMIN_ERRORS } from '../admin.constants';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

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

  /**
   * Retrieves paginated regular users (role: USER).
   * Strict security requirement: Admin accounts are completely excluded from this query.
   */
  async getUsers(query: QueryAdminUsersDto) {
    const { page, limit, skip } = this.adminService.resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      role: UserRole.USER,
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

    return this.adminService.buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Bans a user account, revokes sessions via authVersion, and records audit trail atomically.
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
          authVersion: { increment: 1 },
        },
      });

      await this.adminService.logAudit(
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
   * Unbans a user account and records audit trail atomically.
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

      await this.adminService.logAudit(
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
   * Promotes a regular user to ADMIN (unidirectional promotion) and records audit trail atomically.
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
          authVersion: { increment: 1 },
        },
      });

      await this.adminService.logAudit(
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
}
