import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ItineraryAccessService } from './services/itinerary-access.service';
import { ItineraryPlannerService } from './services/itinerary-planner.service';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { TripCompanionsRepository } from './trip-companions.repository';
import {
  PROPOSAL_LIMITS,
  type ProposalResolveAction,
} from './trip-companions.constants';
import {
  CreateGroupProposalDto,
  type GroupProposalItemDto,
  type GroupProposalParticipantDto,
  type GroupProposalsListResponseDto,
  type ResolveGroupProposalResponseDto,
  type ToggleProposalVoteResponseDto,
} from './dto/trip-proposals.dto';

const PROPOSAL_INCLUDE = {
  place: {
    select: {
      id: true,
      name: true,
      address: true,
      ratingAvg: true,
      priceRange: true,
      priceLevel: true,
      category: {
        select: { name: true, nameVi: true, slug: true },
      },
      images: {
        select: { imageUrl: true },
        take: 1,
        orderBy: [
          { isPrimary: 'desc' as const },
          { displayOrder: 'asc' as const },
        ],
      },
    },
  },
  proposer: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  votes: {
    select: {
      userId: true,
      createdAt: true,
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.GroupPlaceProposalInclude;

type ProposalWithRelations = Prisma.GroupPlaceProposalGetPayload<{
  include: typeof PROPOSAL_INCLUDE;
}>;

@Injectable()
export class TripProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: ItineraryAccessService,
    private readonly companionsRepository: TripCompanionsRepository,
    private readonly copilotTools: CopilotToolsService,
    private readonly plannerService: ItineraryPlannerService,
  ) {}

  async listProposals(
    itineraryId: string,
    userId: string,
  ): Promise<GroupProposalsListResponseDto> {
    await this.accessService.assertIsGroupMember(itineraryId, userId);

    // ponytail: capped at LIST_MAX_ROWS newest rows (no pagination) and sorted in memory;
    // upgrade to cursor pagination + DB-side ordering if groups accumulate long history.
    const rows = await this.prisma.groupPlaceProposal.findMany({
      where: { tripGroup: { itineraryId } },
      include: PROPOSAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: PROPOSAL_LIMITS.LIST_MAX_ROWS,
    });

    const mapped = rows.map((row) => this.toProposalDto(row, userId));
    // PENDING polls first (most votes, then newest), followed by resolved history newest-first.
    mapped.sort((a, b) => {
      const pendingOrder =
        Number(a.status !== ProposalStatus.PENDING) -
        Number(b.status !== ProposalStatus.PENDING);
      if (pendingOrder !== 0) return pendingOrder;
      if (a.status === ProposalStatus.PENDING && b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

    return { proposals: mapped };
  }

  async createProposal(
    itineraryId: string,
    userId: string,
    dto: CreateGroupProposalDto,
  ): Promise<GroupProposalItemDto> {
    const access = await this.accessService.assertIsGroupMember(
      itineraryId,
      userId,
    );

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const { place, dayNumber } = await this.validateProposalTarget(
          tx,
          itineraryId,
          dto,
        );
        const tripGroup = await this.companionsRepository.ensureTripGroup(
          tx,
          itineraryId,
          access.itinerary.creatorId,
        );

        const existingPending = await tx.groupPlaceProposal.findFirst({
          where: {
            tripGroupId: tripGroup.id,
            placeId: dto.placeId,
            status: ProposalStatus.PENDING,
          },
          select: { id: true },
        });
        if (existingPending) {
          throw new ConflictException(
            `Địa điểm "${place.name}" đang có một đề xuất chờ bình chọn trong nhóm.`,
          );
        }

        return tx.groupPlaceProposal.create({
          data: {
            tripGroupId: tripGroup.id,
            placeId: dto.placeId,
            proposedBy: userId,
            destinationId: dto.destinationId ?? null,
            dayNumber,
            proposedStartTime: dto.destinationId
              ? null
              : (dto.proposedStartTime ?? null),
            notes: dto.notes?.trim() || null,
            votes: { create: { userId } },
          },
          include: PROPOSAL_INCLUDE,
        });
      });

      return this.toProposalDto(created, userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Địa điểm này đang có một đề xuất chờ bình chọn trong nhóm.',
        );
      }
      throw error;
    }
  }

  /**
   * Idempotent toggle: delete-first, insert with skipDuplicates only when nothing was deleted,
   * so concurrent double-clicks never surface a unique-constraint 500.
   */
  async toggleVote(
    itineraryId: string,
    proposalId: string,
    userId: string,
  ): Promise<ToggleProposalVoteResponseDto> {
    await this.accessService.assertIsGroupMember(itineraryId, userId);

    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.groupPlaceProposal.findFirst({
        where: { id: proposalId, tripGroup: { itineraryId } },
        select: { status: true },
      });
      if (!proposal) {
        throw new NotFoundException('Không tìm thấy đề xuất bình chọn.');
      }
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new BadRequestException(
          'Đề xuất này đã được xử lý, không thể thay đổi phiếu bầu.',
        );
      }

      const removed = await tx.groupPlaceVote.deleteMany({
        where: { proposalId, userId },
      });
      const voted = removed.count === 0;
      if (voted) {
        await tx.groupPlaceVote.createMany({
          data: [{ proposalId, userId }],
          skipDuplicates: true,
        });
      }

      const updated = await tx.groupPlaceProposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: PROPOSAL_INCLUDE,
      });
      const dto = this.toProposalDto(updated, userId);
      return { proposalId, voted, voteCount: dto.voteCount, proposal: dto };
    });
  }

  async resolveProposal(
    itineraryId: string,
    proposalId: string,
    userId: string,
    action: ProposalResolveAction,
  ): Promise<ResolveGroupProposalResponseDto> {
    await this.accessService.assertCanEdit(itineraryId, userId);
    const approve = action === 'APPROVE';

    const proposal = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.groupPlaceProposal.findFirst({
        where: { id: proposalId, tripGroup: { itineraryId } },
        include: PROPOSAL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy đề xuất bình chọn.');
      }

      // Optimistic claim: only one concurrent resolver wins the PENDING -> final transition.
      const claimed = await tx.groupPlaceProposal.updateMany({
        where: { id: proposalId, status: ProposalStatus.PENDING },
        data: {
          status: approve ? ProposalStatus.APPROVED : ProposalStatus.REJECTED,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Đề xuất này đã được xử lý trước đó.');
      }

      if (approve) {
        await (existing.destinationId
          ? this.applySwap(tx, itineraryId, existing, existing.destinationId)
          : this.applyAdd(tx, itineraryId, existing));
      }

      const resolved = await tx.groupPlaceProposal.findUniqueOrThrow({
        where: { id: existing.id },
        include: PROPOSAL_INCLUDE,
      });
      return this.toProposalDto(resolved, userId);
    });

    if (!approve) {
      return { proposal };
    }
    return {
      proposal,
      itinerary: await this.plannerService.getById(itineraryId, userId),
    };
  }

  async withdrawProposal(
    itineraryId: string,
    proposalId: string,
    userId: string,
  ): Promise<{ deletedId: string }> {
    const access = await this.accessService.assertIsGroupMember(
      itineraryId,
      userId,
    );

    await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.groupPlaceProposal.findFirst({
        where: { id: proposalId, tripGroup: { itineraryId } },
        select: { proposedBy: true, status: true },
      });
      if (!proposal) {
        throw new NotFoundException('Không tìm thấy đề xuất bình chọn.');
      }
      if (proposal.proposedBy !== userId && !access.isOwner) {
        throw new ForbiddenException(
          'Chỉ người đề xuất hoặc chủ lịch trình mới có quyền xóa đề xuất này.',
        );
      }
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new BadRequestException(
          'Chỉ có thể rút lại đề xuất đang ở trạng thái chờ duyệt.',
        );
      }

      const deleted = await tx.groupPlaceProposal.deleteMany({
        where: { id: proposalId, status: ProposalStatus.PENDING },
      });
      if (deleted.count === 0) {
        throw new ConflictException('Đề xuất này đã được xử lý trước đó.');
      }
    });

    return { deletedId: proposalId };
  }

  /**
   * Validates place / swap target / same-day duplicates and resolves the effective day number.
   */
  private async validateProposalTarget(
    tx: Prisma.TransactionClient,
    itineraryId: string,
    dto: CreateGroupProposalDto,
  ): Promise<{ place: { id: string; name: string }; dayNumber: number }> {
    const place = await tx.place.findUnique({
      where: { id: dto.placeId },
      select: { id: true, name: true },
    });
    if (!place) {
      throw new NotFoundException('Không tìm thấy địa điểm được đề xuất.');
    }

    let dayNumber = dto.dayNumber ?? PROPOSAL_LIMITS.DEFAULT_DAY_NUMBER;
    if (dto.destinationId) {
      const target = await tx.itineraryDestination.findFirst({
        where: { id: dto.destinationId, itineraryId },
        select: { dayNumber: true, placeId: true },
      });
      if (!target) {
        throw new NotFoundException(
          'Điểm đến cần thay thế không tồn tại trong lịch trình này.',
        );
      }
      if (target.placeId === dto.placeId) {
        throw new BadRequestException(
          'Địa điểm đề xuất trùng với địa điểm hiện tại.',
        );
      }
      dayNumber = target.dayNumber;
    }

    await this.assertNotDuplicateInDay(
      tx,
      itineraryId,
      dayNumber,
      place,
      dto.destinationId,
    );
    return { place, dayNumber };
  }

  private async assertNotDuplicateInDay(
    tx: Prisma.TransactionClient,
    itineraryId: string,
    dayNumber: number,
    place: { id: string; name: string },
    excludeDestinationId?: string,
  ): Promise<void> {
    const duplicate = await tx.itineraryDestination.findFirst({
      where: {
        itineraryId,
        dayNumber,
        placeId: place.id,
        ...(excludeDestinationId ? { id: { not: excludeDestinationId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `Địa điểm "${place.name}" đã có trong Ngày ${dayNumber} của lịch trình.`,
      );
    }
  }

  /** Approved swap: replace the slot's place and reject rival PENDING proposals on that slot. */
  private async applySwap(
    tx: Prisma.TransactionClient,
    itineraryId: string,
    proposal: ProposalWithRelations,
    destinationId: string,
  ): Promise<void> {
    const target = await tx.itineraryDestination.findFirst({
      where: { id: destinationId, itineraryId },
      select: { id: true, dayNumber: true },
    });
    if (!target) {
      throw new NotFoundException(
        'Điểm đến gốc không còn tồn tại trong lịch trình.',
      );
    }

    await this.assertNotDuplicateInDay(
      tx,
      itineraryId,
      target.dayNumber,
      proposal.place,
      target.id,
    );

    await tx.groupPlaceProposal.updateMany({
      where: {
        tripGroupId: proposal.tripGroupId,
        destinationId,
        status: ProposalStatus.PENDING,
        id: { not: proposal.id },
      },
      data: { status: ProposalStatus.REJECTED },
    });

    await this.copilotTools.persistActivitySwap(
      target.id,
      proposal.place,
      proposal.notes ?? '',
      tx,
    );
  }

  /** Approved add: append the place to the proposed day (time-slot resolution lives in tools). */
  private applyAdd(
    tx: Prisma.TransactionClient,
    itineraryId: string,
    proposal: ProposalWithRelations,
  ): Promise<void> {
    return this.copilotTools.addActivityInTx(tx, itineraryId, {
      place: proposal.place,
      dayNumber: proposal.dayNumber,
      startTime: proposal.proposedStartTime ?? undefined,
      notes: proposal.notes ?? undefined,
    });
  }

  private toProposalDto(
    row: ProposalWithRelations,
    viewerUserId: string,
  ): GroupProposalItemDto {
    const voters: GroupProposalParticipantDto[] = row.votes.map((vote) => ({
      userId: vote.user.id,
      fullName: vote.user.fullName,
      avatarUrl: vote.user.avatarUrl,
    }));

    return {
      id: row.id,
      tripGroupId: row.tripGroupId,
      placeId: row.placeId,
      destinationId: row.destinationId ?? null,
      dayNumber: row.dayNumber,
      proposedStartTime: row.proposedStartTime ?? null,
      notes: row.notes ?? null,
      status: row.status,
      proposedBy: row.proposedBy,
      proposer: {
        userId: row.proposer.id,
        fullName: row.proposer.fullName,
        avatarUrl: row.proposer.avatarUrl,
      },
      place: {
        id: row.place.id,
        name: row.place.name,
        address: row.place.address,
        categoryName:
          row.place.category?.nameVi ?? row.place.category?.name ?? null,
        imageUrl: row.place.images[0]?.imageUrl ?? null,
        ratingAvg:
          row.place.ratingAvg != null ? Number(row.place.ratingAvg) : null,
      },
      voteCount: voters.length,
      hasVoted: voters.some((voter) => voter.userId === viewerUserId),
      voters,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
