import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TripCompanionsService } from './trip-companions.service';
import {
  InviteCompanionDto,
  UpdateMemberRoleDto,
  CompanionsListResponseDto,
  InvitationSummaryDto,
  AcceptInvitationResponseDto,
} from './dto/trip-companions.dto';

@Controller()
export class TripCompanionsController {
  constructor(private readonly service: TripCompanionsService) {}

  /**
   * POST /api/v1/itineraries/:id/invitations
   * Invite a companion by exact email (owner only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('itineraries/:id/invitations')
  @HttpCode(HttpStatus.CREATED)
  async inviteCompanion(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteCompanionDto,
  ): Promise<{ invitationId: string; status: string; expiresAt: string }> {
    return this.service.inviteCompanion(itineraryId, userId, dto.email);
  }

  /**
   * GET /api/v1/itineraries/:id/companions
   * List companions and pending invitations (owner/members only).
   */
  @UseGuards(JwtAuthGuard)
  @Get('itineraries/:id/companions')
  @HttpCode(HttpStatus.OK)
  async listCompanions(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @CurrentUser('id') userId: string,
  ): Promise<CompanionsListResponseDto> {
    return this.service.listCompanions(itineraryId, userId);
  }

  /**
   * PATCH /api/v1/itineraries/:id/members/:userId
   * Change member role between VIEWER and EDITOR (owner only).
   */
  @UseGuards(JwtAuthGuard)
  @Patch('itineraries/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  async updateMemberRole(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<{ userId: string; role: 'VIEWER' | 'EDITOR' }> {
    return this.service.updateMemberRole(itineraryId, ownerId, targetUserId, dto.role);
  }

  /**
   * DELETE /api/v1/itineraries/:id/members/:userId
   * Remove a member from the trip (owner only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('itineraries/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('id') ownerId: string,
  ): Promise<{ success: boolean; removedUserId: string }> {
    return this.service.removeMember(itineraryId, ownerId, targetUserId);
  }

  /**
   * POST /api/v1/itineraries/:id/leave
   * Member leaves the trip (non-owner members only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('itineraries/:id/leave')
  @HttpCode(HttpStatus.OK)
  async leaveTrip(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ success: boolean; leftUserId: string }> {
    return this.service.leaveTrip(itineraryId, userId);
  }

  /**
   * GET /api/v1/trip-invitations/:invitationId
   * View invitation summary (invitee or inviter only).
   */
  @UseGuards(JwtAuthGuard)
  @Get('trip-invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  async getInvitation(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<InvitationSummaryDto> {
    return this.service.getInvitationSummary(invitationId, userId);
  }

  /**
   * POST /api/v1/trip-invitations/:invitationId/accept
   * Accept trip invitation (invitee only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('trip-invitations/:invitationId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<AcceptInvitationResponseDto> {
    return this.service.acceptInvitation(invitationId, userId);
  }

  /**
   * POST /api/v1/trip-invitations/:invitationId/decline
   * Decline trip invitation (invitee only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('trip-invitations/:invitationId/decline')
  @HttpCode(HttpStatus.OK)
  async declineInvitation(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.service.declineInvitation(invitationId, userId);
  }

  /**
   * POST /api/v1/trip-invitations/:invitationId/revoke
   * Revoke a pending invitation (owner only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('trip-invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeInvitation(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ success: boolean; status: string }> {
    return this.service.revokeInvitation(invitationId, userId);
  }
}
