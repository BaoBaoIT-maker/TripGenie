import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type ItineraryViewerRole = 'OWNER' | 'EDITOR' | 'VIEWER' | null;

export interface ItineraryAccess {
  role: ItineraryViewerRole;
  isOwner: boolean;
  canView: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  itinerary: {
    id: string;
    creatorId: string;
    isPublic: boolean;
    deletedAt: Date | null;
    updatedAt: Date;
  };
}

@Injectable()
export class ItineraryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine granular access rights and capabilities for a user on an itinerary.
   * Can be executed within an ongoing Prisma transaction for concurrency safety.
   */
  async getAccess(
    itineraryId: string,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItineraryAccess> {
    const db = tx || this.prisma;

    const row = await db.itinerary.findFirst({
      where: { id: itineraryId, deletedAt: null },
      select: {
        id: true,
        creatorId: true,
        isPublic: true,
        deletedAt: true,
        updatedAt: true,
        tripGroup: {
          select: {
            id: true,
            members: userId
              ? {
                  where: { userId },
                  select: { role: true },
                }
              : false,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Không tìm thấy lịch trình du lịch hoặc lịch trình đã bị xóa.');
    }

    const baseItinerary = {
      id: row.id,
      creatorId: row.creatorId,
      isPublic: row.isPublic,
      deletedAt: row.deletedAt,
      updatedAt: row.updatedAt,
    };

    // 1. Creator is always OWNER with full capabilities
    if (userId && row.creatorId === userId) {
      return {
        role: 'OWNER',
        isOwner: true,
        canView: true,
        canEdit: true,
        canManageMembers: true,
        itinerary: baseItinerary,
      };
    }

    // 2. Active member in TripGroup
    const member = row.tripGroup?.members?.[0];
    if (userId && member) {
      const isEditor = member.role === 'EDITOR';
      return {
        role: isEditor ? 'EDITOR' : 'VIEWER',
        isOwner: false,
        canView: true,
        canEdit: isEditor,
        canManageMembers: false,
        itinerary: baseItinerary,
      };
    }

    // 3. Non-member / Guest: only public view allowed
    return {
      role: null,
      isOwner: false,
      canView: row.isPublic,
      canEdit: false,
      canManageMembers: false,
      itinerary: baseItinerary,
    };
  }

  /**
   * Assert actor can view the itinerary.
   */
  async assertCanView(
    itineraryId: string,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItineraryAccess> {
    const access = await this.getAccess(itineraryId, userId, tx);
    if (!access.canView) {
      if (!userId) {
        throw new UnauthorizedException('Vui lòng đăng nhập để xem lịch trình riêng tư này.');
      }
      throw new ForbiddenException('Bạn không có quyền xem lịch trình riêng tư này.');
    }
    return access;
  }

  /**
   * Assert actor can edit content of the itinerary (Owner or Editor).
   */
  async assertCanEdit(
    itineraryId: string,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItineraryAccess> {
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để chỉnh sửa lịch trình này.');
    }
    const access = await this.getAccess(itineraryId, userId, tx);
    if (!access.canEdit) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền xem hoặc không có quyền chỉnh sửa nội dung lịch trình này.',
      );
    }
    return access;
  }

  /**
   * Assert actor is the Owner of the itinerary.
   */
  async assertOwner(
    itineraryId: string,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItineraryAccess> {
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để thực hiện thao tác quản lý này.');
    }
    const access = await this.getAccess(itineraryId, userId, tx);
    if (!access.isOwner) {
      throw new ForbiddenException('Chỉ chủ sở hữu lịch trình mới có quyền thực hiện thao tác này.');
    }
    return access;
  }
}
