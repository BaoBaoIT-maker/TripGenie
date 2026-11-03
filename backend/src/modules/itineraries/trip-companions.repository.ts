import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { writeNotification } from '../notifications/notification-writer';
import { TRIP_COMPANIONS_CONSTANTS } from './trip-companions.constants';
import {
  CompanionMemberDto,
  PendingInvitationDto,
  CompanionsListResponseDto,
  InvitationSummaryDto,
  AcceptInvitationResponseDto,
} from './dto/trip-companions.dto';

@Injectable()
export class TripCompanionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });
  }

  async findItineraryHeader(itineraryId: string) {
    return this.prisma.itinerary.findFirst({
      where: { id: itineraryId, deletedAt: null },
      select: {
        id: true,
        creatorId: true,
        title: true,
        destination: true,
        startDate: true,
        endDate: true,
        aiPreferences: true,
        tripGroup: {
          select: {
            id: true,
            maxMembers: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    });
  }

  private async generateUniqueInviteCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let i = 0; i < TRIP_COMPANIONS_CONSTANTS.MAX_INVITE_CODE_RETRIES; i++) {
      const code = crypto
        .randomBytes(TRIP_COMPANIONS_CONSTANTS.INVITE_CODE_BYTES)
        .toString('hex')
        .toUpperCase();
      const existing = await tx.tripGroup.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return crypto.randomUUID().slice(0, 12).toUpperCase();
  }

  async createInvitation(
    itineraryId: string,
    inviterId: string,
    inviteeId: string,
  ): Promise<{ invitationId: string; status: string; expiresAt: string }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock / check itinerary
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        select: { id: true, creatorId: true, deletedAt: true },
      });

      if (!itinerary || itinerary.deletedAt) {
        throw new NotFoundException('Không tìm thấy lịch trình du lịch.');
      }

      if (itinerary.creatorId !== inviterId) {
        throw new ForbiddenException('Chỉ chủ sở hữu lịch trình mới có quyền mời bạn đồng hành.');
      }

      if (inviterId === inviteeId) {
        throw new BadRequestException('Bạn không thể tự gửi lời mời cho chính mình.');
      }

      // 2. Ensure TripGroup exists with inviter as OWNER
      let tripGroup = await tx.tripGroup.findUnique({
        where: { itineraryId },
        select: { id: true, maxMembers: true },
      });

      if (!tripGroup) {
        const inviteCode = await this.generateUniqueInviteCode(tx);
        tripGroup = await tx.tripGroup.create({
          data: {
            itineraryId,
            name: 'Nhóm đồng hành',
            inviteCode,
            members: {
              create: {
                userId: inviterId,
                role: 'OWNER',
              },
            },
          },
          select: { id: true, maxMembers: true },
        });
      } else {
        // Ensure owner is a group member
        const ownerMember = await tx.groupMember.findUnique({
          where: {
            tripGroupId_userId: {
              tripGroupId: tripGroup.id,
              userId: inviterId,
            },
          },
        });
        if (!ownerMember) {
          await tx.groupMember.create({
            data: {
              tripGroupId: tripGroup.id,
              userId: inviterId,
              role: 'OWNER',
            },
          });
        }
      }

      // 3. Check if invitee is already a member
      const existingMember = await tx.groupMember.findUnique({
        where: {
          tripGroupId_userId: {
            tripGroupId: tripGroup.id,
            userId: inviteeId,
          },
        },
      });

      if (existingMember) {
        throw new BadRequestException('Thành viên này đã tham gia chuyến đi rồi.');
      }

      // 4. Check / Expire old invitations
      const now = new Date();
      const existingPending = await tx.tripInvitation.findFirst({
        where: {
          tripGroupId: tripGroup.id,
          inviteeId,
          status: 'PENDING',
        },
      });

      if (existingPending) {
        if (existingPending.expiresAt <= now) {
          await tx.tripInvitation.update({
            where: { id: existingPending.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          throw new BadRequestException(
            'Lời mời trước đó vẫn đang chờ phản hồi. Vui lòng đợi hoặc thu hồi lời mời cũ trước.',
          );
        }
      }

      // 5. Create new Invitation with TTL
      const expiresAt = new Date(
        now.getTime() + TRIP_COMPANIONS_CONSTANTS.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      const invitation = await tx.tripInvitation.create({
        data: {
          tripGroupId: tripGroup.id,
          inviterId,
          inviteeId,
          status: 'PENDING',
          expiresAt,
        },
      });

      // 6. Write notification transactionally
      await writeNotification(tx, {
        recipientId: inviteeId,
        actorId: inviterId,
        type: 'TRIP_INVITED',
        eventKey: `${TRIP_COMPANIONS_CONSTANTS.EVENT_KEY_INVITE_PREFIX}:${invitation.id}`,
        itineraryId,
        invitationId: invitation.id,
      });

      return {
        invitationId: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      };
    });
  }

  async listCompanions(itineraryId: string, viewerId: string): Promise<CompanionsListResponseDto> {
    const itinerary = await this.findItineraryHeader(itineraryId);
    if (!itinerary) {
      throw new NotFoundException('Không tìm thấy lịch trình.');
    }

    const isOwner = itinerary.creatorId === viewerId;
    const isMember = Boolean(itinerary.tripGroup?.members.some((m) => m.userId === viewerId));

    if (!isOwner && !isMember) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách bạn đồng hành của lịch trình này.');
    }

    if (!itinerary.tripGroup) {
      // Lazy fallback: only creator is member
      const creator = await this.prisma.user.findUnique({
        where: { id: itinerary.creatorId },
        select: { id: true, fullName: true, avatarUrl: true },
      });
      return {
        members: creator
          ? [
              {
                userId: creator.id,
                fullName: creator.fullName,
                avatarUrl: creator.avatarUrl,
                role: 'OWNER',
              },
            ]
          : [],
        pendingInvitations: [],
      };
    }

    const groupMembers = await this.prisma.groupMember.findMany({
      where: { tripGroupId: itinerary.tripGroup.id },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    const members: CompanionMemberDto[] = groupMembers.map((gm) => ({
      userId: gm.user.id,
      fullName: gm.user.fullName,
      avatarUrl: gm.user.avatarUrl,
      role: gm.role as 'OWNER' | 'EDITOR' | 'VIEWER',
    }));

    // Ensure owner is first in the list
    members.sort((a, b) => {
      if (a.role === 'OWNER') return -1;
      if (b.role === 'OWNER') return 1;
      return 0;
    });

    let pendingInvitations: PendingInvitationDto[] = [];
    if (isOwner) {
      const now = new Date();
      const rawPending = await this.prisma.tripInvitation.findMany({
        where: {
          tripGroupId: itinerary.tripGroup.id,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        include: {
          invitee: {
            select: { email: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      pendingInvitations = rawPending.map((inv) => ({
        id: inv.id,
        inviteeEmail: inv.invitee.email,
        inviteeName: inv.invitee.fullName,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      }));
    }

    return { members, pendingInvitations };
  }

  async findInvitationById(
    invitationId: string,
    viewerId?: string,
  ): Promise<InvitationSummaryDto> {
    const inv = await this.prisma.tripInvitation.findUnique({
      where: { id: invitationId },
      include: {
        tripGroup: {
          include: {
            itinerary: {
              select: {
                id: true,
                title: true,
                destination: true,
                startDate: true,
                endDate: true,
                aiPreferences: true,
                deletedAt: true,
              },
            },
          },
        },
        inviter: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        invitee: {
          select: { id: true, email: true },
        },
      },
    });

    if (!inv || !inv.tripGroup.itinerary || inv.tripGroup.itinerary.deletedAt) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc chuyến đi đã bị xóa.');
    }

    // Only inviter or invitee can view invitation details
    if (viewerId && viewerId !== inv.inviteeId && viewerId !== inv.inviterId) {
      throw new NotFoundException('Không tìm thấy lời mời.');
    }

    // Check expiration dynamically
    let status = inv.status;
    if (status === 'PENDING' && inv.expiresAt <= new Date()) {
      status = 'EXPIRED';
    }

    const stored: any = inv.tripGroup.itinerary.aiPreferences || {};

    return {
      id: inv.id,
      status,
      expiresAt: inv.expiresAt.toISOString(),
      respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
      itinerary: {
        id: inv.tripGroup.itinerary.id,
        title: inv.tripGroup.itinerary.title,
        destination: inv.tripGroup.itinerary.destination,
        startDate: inv.tripGroup.itinerary.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: inv.tripGroup.itinerary.endDate?.toISOString().slice(0, 10) ?? null,
        coverPhoto: stored.coverPhoto || stored.coverImage || null,
      },
      inviter: {
        id: inv.inviter.id,
        fullName: inv.inviter.fullName,
        avatarUrl: inv.inviter.avatarUrl,
      },
    };
  }

  async acceptInvitation(
    invitationId: string,
    inviteeId: string,
  ): Promise<AcceptInvitationResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.tripInvitation.findUnique({
        where: { id: invitationId },
        include: {
          tripGroup: {
            include: {
              itinerary: { select: { id: true, creatorId: true, deletedAt: true } },
            },
          },
        },
      });

      if (!inv || !inv.tripGroup.itinerary || inv.tripGroup.itinerary.deletedAt) {
        throw new NotFoundException('Không tìm thấy lời mời hoặc chuyến đi đã bị xóa.');
      }

      if (inv.inviteeId !== inviteeId) {
        throw new ForbiddenException('Bạn không phải là người nhận của lời mời này.');
      }

      // Check idempotent accept
      if (inv.status === 'ACCEPTED') {
        const existingMember = await tx.groupMember.findUnique({
          where: {
            tripGroupId_userId: {
              tripGroupId: inv.tripGroupId,
              userId: inviteeId,
            },
          },
        });
        if (existingMember) {
          return {
            itineraryId: inv.tripGroup.itinerary.id,
            role: 'VIEWER',
          };
        }
        throw new BadRequestException('Bạn đã từng rời hoặc bị xóa khỏi nhóm chuyến đi này.');
      }

      const now = new Date();
      if (inv.status !== 'PENDING' || inv.expiresAt <= now) {
        if (inv.status === 'PENDING' && inv.expiresAt <= now) {
          await tx.tripInvitation.update({
            where: { id: inv.id },
            data: { status: 'EXPIRED' },
          });
        }
        throw new BadRequestException('Lời mời đã hết hạn hoặc không còn hiệu lực.');
      }

      // Check maxMembers capacity
      const currentMemberCount = await tx.groupMember.count({
        where: { tripGroupId: inv.tripGroupId },
      });

      if (currentMemberCount >= inv.tripGroup.maxMembers) {
        throw new BadRequestException('Chuyến đi đã đạt số lượng thành viên tối đa.');
      }

      // Update invitation
      await tx.tripInvitation.update({
        where: { id: inv.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: now,
        },
      });

      // Add to group members as VIEWER
      await tx.groupMember.upsert({
        where: {
          tripGroupId_userId: {
            tripGroupId: inv.tripGroupId,
            userId: inviteeId,
          },
        },
        create: {
          tripGroupId: inv.tripGroupId,
          userId: inviteeId,
          role: 'VIEWER',
          joinedAt: now,
        },
        update: {},
      });

      // Notify inviter
      await writeNotification(tx, {
        recipientId: inv.inviterId,
        actorId: inviteeId,
        type: 'TRIP_INVITATION_ACCEPTED',
        eventKey: `${TRIP_COMPANIONS_CONSTANTS.EVENT_KEY_RESULT_PREFIX}:${inv.id}:ACCEPTED`,
        itineraryId: inv.tripGroup.itinerary.id,
        invitationId: inv.id,
      });

      return {
        itineraryId: inv.tripGroup.itinerary.id,
        role: 'VIEWER',
      };
    });
  }

  async declineInvitation(
    invitationId: string,
    inviteeId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.tripInvitation.findUnique({
        where: { id: invitationId },
        include: {
          tripGroup: {
            include: {
              itinerary: { select: { id: true, creatorId: true, deletedAt: true } },
            },
          },
        },
      });

      if (!inv || !inv.tripGroup.itinerary || inv.tripGroup.itinerary.deletedAt) {
        throw new NotFoundException('Không tìm thấy lời mời.');
      }

      if (inv.inviteeId !== inviteeId) {
        throw new ForbiddenException('Bạn không phải là người nhận của lời mời này.');
      }

      if (inv.status === 'DECLINED') {
        return { success: true, status: 'DECLINED' };
      }

      if (inv.status !== 'PENDING') {
        throw new BadRequestException('Lời mời không ở trạng thái chờ phản hồi.');
      }

      const now = new Date();
      await tx.tripInvitation.update({
        where: { id: inv.id },
        data: {
          status: 'DECLINED',
          respondedAt: now,
        },
      });

      // Notify inviter
      await writeNotification(tx, {
        recipientId: inv.inviterId,
        actorId: inviteeId,
        type: 'TRIP_INVITATION_DECLINED',
        eventKey: `${TRIP_COMPANIONS_CONSTANTS.EVENT_KEY_RESULT_PREFIX}:${inv.id}:DECLINED`,
        itineraryId: inv.tripGroup.itinerary.id,
        invitationId: inv.id,
      });

      return { success: true, status: 'DECLINED' };
    });
  }

  async revokeInvitation(
    invitationId: string,
    ownerId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.tripInvitation.findUnique({
        where: { id: invitationId },
        include: {
          tripGroup: {
            include: {
              itinerary: { select: { id: true, creatorId: true } },
            },
          },
        },
      });

      if (!inv || !inv.tripGroup.itinerary) {
        throw new NotFoundException('Không tìm thấy lời mời.');
      }

      if (inv.tripGroup.itinerary.creatorId !== ownerId) {
        throw new ForbiddenException('Chỉ chủ sở hữu chuyến đi mới có quyền thu hồi lời mời.');
      }

      if (inv.status === 'REVOKED') {
        return { success: true, status: 'REVOKED' };
      }

      if (inv.status !== 'PENDING') {
        throw new BadRequestException('Chỉ có thể thu hồi lời mời đang chờ phản hồi.');
      }

      const now = new Date();
      await tx.tripInvitation.update({
        where: { id: inv.id },
        data: {
          status: 'REVOKED',
          respondedAt: now,
        },
      });

      // Remove recipient notification so it does not linger
      await tx.notification.deleteMany({
        where: { invitationId: inv.id },
      });

      return { success: true, status: 'REVOKED' };
    });
  }

  async updateMemberRole(
    itineraryId: string,
    ownerId: string,
    targetUserId: string,
    newRole: 'VIEWER' | 'EDITOR',
  ): Promise<{ userId: string; role: 'VIEWER' | 'EDITOR' }> {
    return this.prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        select: { id: true, creatorId: true, tripGroup: { select: { id: true } } },
      });

      if (!itinerary) throw new NotFoundException('Không tìm thấy lịch trình.');
      if (itinerary.creatorId !== ownerId) {
        throw new ForbiddenException('Chỉ chủ sở hữu mới có quyền phân quyền thành viên.');
      }
      if (itinerary.creatorId === targetUserId) {
        throw new BadRequestException('Không thể thay đổi quyền của chủ sở hữu chuyến đi.');
      }
      if (!itinerary.tripGroup) {
        throw new NotFoundException('Nhóm chuyến đi chưa được khởi tạo.');
      }

      const member = await tx.groupMember.findUnique({
        where: {
          tripGroupId_userId: {
            tripGroupId: itinerary.tripGroup.id,
            userId: targetUserId,
          },
        },
      });

      if (!member) {
        throw new NotFoundException('Thành viên không thuộc chuyến đi này.');
      }

      await tx.groupMember.update({
        where: {
          tripGroupId_userId: {
            tripGroupId: itinerary.tripGroup.id,
            userId: targetUserId,
          },
        },
        data: { role: newRole },
      });

      return { userId: targetUserId, role: newRole };
    });
  }

  async removeMember(
    itineraryId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; removedUserId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        select: { id: true, creatorId: true, tripGroup: { select: { id: true } } },
      });

      if (!itinerary) throw new NotFoundException('Không tìm thấy lịch trình.');
      if (itinerary.creatorId !== ownerId) {
        throw new ForbiddenException('Chỉ chủ sở hữu mới có quyền xóa thành viên.');
      }
      if (itinerary.creatorId === targetUserId) {
        throw new BadRequestException('Không thể xóa chủ sở hữu khỏi chuyến đi.');
      }
      if (!itinerary.tripGroup) {
        throw new NotFoundException('Nhóm chuyến đi chưa được khởi tạo.');
      }

      await tx.groupMember.deleteMany({
        where: {
          tripGroupId: itinerary.tripGroup.id,
          userId: targetUserId,
        },
      });

      return { success: true, removedUserId: targetUserId };
    });
  }

  async leaveTrip(
    itineraryId: string,
    userId: string,
  ): Promise<{ success: boolean; leftUserId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        select: { id: true, creatorId: true, tripGroup: { select: { id: true } } },
      });

      if (!itinerary) throw new NotFoundException('Không tìm thấy lịch trình.');
      if (itinerary.creatorId === userId) {
        throw new BadRequestException('Chủ sở hữu không thể rời khỏi chuyến đi.');
      }
      if (!itinerary.tripGroup) {
        throw new NotFoundException('Nhóm chuyến đi chưa được khởi tạo.');
      }

      await tx.groupMember.deleteMany({
        where: {
          tripGroupId: itinerary.tripGroup.id,
          userId,
        },
      });

      return { success: true, leftUserId: userId };
    });
  }
}
