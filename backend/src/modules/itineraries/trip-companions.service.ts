import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TripCompanionsRepository } from './trip-companions.repository';
import {
  CompanionsListResponseDto,
  InvitationSummaryDto,
  AcceptInvitationResponseDto,
} from './dto/trip-companions.dto';

@Injectable()
export class TripCompanionsService {
  constructor(private readonly repository: TripCompanionsRepository) {}

  async inviteCompanion(
    itineraryId: string,
    inviterId: string,
    email: string,
  ): Promise<{ invitationId: string; status: string; expiresAt: string }> {
    const user = await this.repository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản người dùng nào với địa chỉ email này trên hệ thống.',
      );
    }

    if (user.id === inviterId) {
      throw new BadRequestException('Bạn không thể tự gửi lời mời cho chính mình.');
    }

    return this.repository.createInvitation(itineraryId, inviterId, user.id);
  }

  async listCompanions(
    itineraryId: string,
    viewerId: string,
  ): Promise<CompanionsListResponseDto> {
    return this.repository.listCompanions(itineraryId, viewerId);
  }

  async getInvitationSummary(
    invitationId: string,
    viewerId?: string,
  ): Promise<InvitationSummaryDto> {
    return this.repository.findInvitationById(invitationId, viewerId);
  }

  async acceptInvitation(
    invitationId: string,
    inviteeId: string,
  ): Promise<AcceptInvitationResponseDto> {
    return this.repository.acceptInvitation(invitationId, inviteeId);
  }

  async declineInvitation(
    invitationId: string,
    inviteeId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.repository.declineInvitation(invitationId, inviteeId);
  }

  async revokeInvitation(
    invitationId: string,
    ownerId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.repository.revokeInvitation(invitationId, ownerId);
  }

  async updateMemberRole(
    itineraryId: string,
    ownerId: string,
    targetUserId: string,
    newRole: 'VIEWER' | 'EDITOR',
  ): Promise<{ userId: string; role: 'VIEWER' | 'EDITOR' }> {
    return this.repository.updateMemberRole(itineraryId, ownerId, targetUserId, newRole);
  }

  async removeMember(
    itineraryId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; removedUserId: string }> {
    return this.repository.removeMember(itineraryId, ownerId, targetUserId);
  }

  async leaveTrip(
    itineraryId: string,
    userId: string,
  ): Promise<{ success: boolean; leftUserId: string }> {
    return this.repository.leaveTrip(itineraryId, userId);
  }
}
