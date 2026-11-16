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
import { TripProposalsService } from './trip-proposals.service';
import {
  CreateGroupProposalDto,
  ResolveGroupProposalDto,
  type GroupProposalItemDto,
  type GroupProposalsListResponseDto,
  type ResolveGroupProposalResponseDto,
  type ToggleProposalVoteResponseDto,
} from './dto/trip-proposals.dto';

@Controller()
export class TripProposalsController {
  constructor(private readonly proposalsService: TripProposalsService) {}
  /**
   * GET /api/v1/itineraries/:id/proposals
   * List group place proposals & vote tallies (group members & owner only).
   */
  @UseGuards(JwtAuthGuard)
  @Get('itineraries/:id/proposals')
  @HttpCode(HttpStatus.OK)
  async listProposals(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @CurrentUser('id') userId: string,
  ): Promise<GroupProposalsListResponseDto> {
    return this.proposalsService.listProposals(itineraryId, userId);
  }

  /**
   * POST /api/v1/itineraries/:id/proposals
   * Create a new place swap/add proposal (group members & owner; auto-votes for proposer).
   */
  @UseGuards(JwtAuthGuard)
  @Post('itineraries/:id/proposals')
  @HttpCode(HttpStatus.CREATED)
  async createProposal(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGroupProposalDto,
  ): Promise<GroupProposalItemDto> {
    return this.proposalsService.createProposal(itineraryId, userId, dto);
  }

  /**
   * POST /api/v1/itineraries/:id/proposals/:proposalId/vote
   * Toggle current member's vote on a PENDING proposal.
   */
  @UseGuards(JwtAuthGuard)
  @Post('itineraries/:id/proposals/:proposalId/vote')
  @HttpCode(HttpStatus.OK)
  async toggleProposalVote(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser('id') userId: string,
  ): Promise<ToggleProposalVoteResponseDto> {
    return this.proposalsService.toggleVote(itineraryId, proposalId, userId);
  }

  /**
   * PATCH /api/v1/itineraries/:id/proposals/:proposalId/resolve
   * Approve or reject a PENDING proposal atomically (OWNER or EDITOR only).
   */
  @UseGuards(JwtAuthGuard)
  @Patch('itineraries/:id/proposals/:proposalId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveProposal(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ResolveGroupProposalDto,
  ): Promise<ResolveGroupProposalResponseDto> {
    return this.proposalsService.resolveProposal(
      itineraryId,
      proposalId,
      userId,
      dto.action,
    );
  }

  /**
   * DELETE /api/v1/itineraries/:id/proposals/:proposalId
   * Withdraw a PENDING proposal (proposer or itinerary OWNER only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('itineraries/:id/proposals/:proposalId')
  @HttpCode(HttpStatus.OK)
  async withdrawProposal(
    @Param('id', ParseUUIDPipe) itineraryId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ deletedId: string }> {
    return this.proposalsService.withdrawProposal(
      itineraryId,
      proposalId,
      userId,
    );
  }
}
