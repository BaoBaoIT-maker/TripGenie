import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { TripProposalsService } from './trip-proposals.service';
import { PROPOSAL_LIMITS } from './trip-companions.constants';
import { PrismaService } from '../../database/prisma.service';
import { ItineraryAccessService } from './services/itinerary-access.service';
import { TripCompanionsRepository } from './trip-companions.repository';
import { CopilotToolsService } from './copilot/copilot-tools.service';
import { ItineraryPlannerService } from './services/itinerary-planner.service';

describe('TripProposalsService', () => {
  const ITINERARY_ID = 'itin-1';
  const OWNER_ID = 'owner-1';
  const VIEWER_ID = 'viewer-1';
  const PROPOSAL_ID = 'prop-1';
  const PLACE_ID = 'place-new';

  const makeProposalRow = (overrides: Record<string, unknown> = {}) => ({
    id: PROPOSAL_ID,
    tripGroupId: 'group-1',
    placeId: PLACE_ID,
    proposedBy: VIEWER_ID,
    status: ProposalStatus.PENDING,
    destinationId: 'dest-1',
    dayNumber: 1,
    proposedStartTime: null,
    notes: 'Đổi sang quán ngon hơn',
    createdAt: new Date('2026-11-11T10:00:00.000Z'),
    proposer: { id: VIEWER_ID, fullName: 'Minh Thư', avatarUrl: null },
    place: {
      id: PLACE_ID,
      name: 'Hải sản Bé Mặn',
      address: 'Lô 8 Võ Nguyên Giáp',
      ratingAvg: 4.7,
      priceRange: { min: 150000, max: 350000 },
      priceLevel: 'MEDIUM',
      category: { name: 'Restaurant', nameVi: 'Nhà hàng', slug: 'nha-hang' },
      images: [{ imageUrl: 'https://example.com/be-man.jpg' }],
    },
    votes: [
      {
        userId: VIEWER_ID,
        createdAt: new Date('2026-11-11T10:00:00.000Z'),
        user: { id: VIEWER_ID, fullName: 'Minh Thư', avatarUrl: null },
      },
    ],
    ...overrides,
  });

  let prismaMock: any;
  let accessMock: { assertIsGroupMember: jest.Mock; assertCanEdit: jest.Mock };
  let repoMock: { ensureTripGroup: jest.Mock };
  let copilotToolsMock: {
    persistActivitySwap: jest.Mock;
    addActivityInTx: jest.Mock;
  };
  let plannerMock: { getById: jest.Mock };
  let service: TripProposalsService;

  beforeEach(() => {
    prismaMock = {
      place: { findUnique: jest.fn() },
      itineraryDestination: { findFirst: jest.fn() },
      groupPlaceProposal: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      groupPlaceVote: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb(prismaMock),
      ),
    };

    accessMock = {
      assertIsGroupMember: jest.fn().mockResolvedValue({
        role: 'VIEWER',
        isOwner: false,
        canView: true,
        canEdit: false,
        canManageMembers: false,
        itinerary: { creatorId: OWNER_ID },
      }),
      assertCanEdit: jest.fn().mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        canView: true,
        canEdit: true,
        canManageMembers: true,
        itinerary: { creatorId: OWNER_ID },
      }),
    };

    repoMock = {
      ensureTripGroup: jest
        .fn()
        .mockResolvedValue({ id: 'group-1', maxMembers: 10 }),
    };

    copilotToolsMock = {
      persistActivitySwap: jest.fn().mockResolvedValue(undefined),
      addActivityInTx: jest.fn().mockResolvedValue(undefined),
    };

    plannerMock = {
      getById: jest
        .fn()
        .mockResolvedValue({ id: ITINERARY_ID, destinations: [] }),
    };

    service = new TripProposalsService(
      prismaMock as PrismaService,
      accessMock as unknown as ItineraryAccessService,
      repoMock as unknown as TripCompanionsRepository,
      copilotToolsMock as unknown as CopilotToolsService,
      plannerMock as unknown as ItineraryPlannerService,
    );
  });

  it('listProposals enforces group membership and maps votes with hasVoted', async () => {
    prismaMock.groupPlaceProposal.findMany.mockResolvedValue([
      makeProposalRow(),
    ]);

    const res = await service.listProposals(ITINERARY_ID, VIEWER_ID);

    expect(accessMock.assertIsGroupMember).toHaveBeenCalledWith(
      ITINERARY_ID,
      VIEWER_ID,
    );
    expect(prismaMock.groupPlaceProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripGroup: { itineraryId: ITINERARY_ID } },
        take: PROPOSAL_LIMITS.LIST_MAX_ROWS,
      }),
    );
    expect(res.proposals).toHaveLength(1);
    expect(res.proposals[0].voteCount).toBe(1);
    expect(res.proposals[0].hasVoted).toBe(true);
    expect(res.proposals[0].place.categoryName).toBe('Nhà hàng');
  });

  it('createProposal ensures TripGroup, creates proposal + initial voter row, and rejects duplicate pending proposals', async () => {
    prismaMock.place.findUnique.mockResolvedValue({
      id: PLACE_ID,
      name: 'Hải sản Bé Mặn',
    });
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce({
        id: 'dest-1',
        dayNumber: 2,
        placeId: 'place-old',
      })
      .mockResolvedValueOnce(null);
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(null);
    prismaMock.groupPlaceProposal.create.mockResolvedValueOnce(
      makeProposalRow({ dayNumber: 2 }),
    );

    const created = await service.createProposal(ITINERARY_ID, VIEWER_ID, {
      placeId: PLACE_ID,
      destinationId: 'dest-1',
      notes: '  Đổi sang quán ngon hơn ',
    });

    expect(repoMock.ensureTripGroup).toHaveBeenCalledWith(
      prismaMock,
      ITINERARY_ID,
      OWNER_ID,
    );
    expect(prismaMock.groupPlaceProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dayNumber: 2,
          votes: { create: { userId: VIEWER_ID } },
        }),
      }),
    );
    expect(created.dayNumber).toBe(2);

    // Duplicate PENDING proposal on same place -> ConflictException
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce({
        id: 'dest-1',
        dayNumber: 2,
        placeId: 'place-old',
      })
      .mockResolvedValueOnce(null);
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce({
      id: PROPOSAL_ID,
    });

    await expect(
      service.createProposal(ITINERARY_ID, VIEWER_ID, {
        placeId: PLACE_ID,
        destinationId: 'dest-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('toggleVote is delete-first idempotent: inserts with skipDuplicates, removes on repeat, rejects non-pending polls', async () => {
    const pending = { status: ProposalStatus.PENDING };

    // First click: nothing deleted -> insert (skipDuplicates guards concurrent double-clicks)
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(pending);
    prismaMock.groupPlaceVote.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.groupPlaceProposal.findUniqueOrThrow.mockResolvedValueOnce(
      makeProposalRow(),
    );

    const added = await service.toggleVote(
      ITINERARY_ID,
      PROPOSAL_ID,
      VIEWER_ID,
    );
    expect(prismaMock.groupPlaceVote.createMany).toHaveBeenCalledWith({
      data: [{ proposalId: PROPOSAL_ID, userId: VIEWER_ID }],
      skipDuplicates: true,
    });
    expect(added.voted).toBe(true);

    // Second click: a row was deleted -> no insert
    prismaMock.groupPlaceVote.createMany.mockClear();
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(pending);
    prismaMock.groupPlaceVote.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.groupPlaceProposal.findUniqueOrThrow.mockResolvedValueOnce(
      makeProposalRow({ votes: [] }),
    );

    const removed = await service.toggleVote(
      ITINERARY_ID,
      PROPOSAL_ID,
      VIEWER_ID,
    );
    expect(removed.voted).toBe(false);
    expect(removed.voteCount).toBe(0);
    expect(prismaMock.groupPlaceVote.createMany).not.toHaveBeenCalled();

    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce({
      status: ProposalStatus.APPROVED,
    });
    await expect(
      service.toggleVote(ITINERARY_ID, PROPOSAL_ID, VIEWER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolveProposal APPROVE atomically swaps target destination, rejects competing slot proposals, and returns fresh itinerary', async () => {
    const row = makeProposalRow();
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(row);
    prismaMock.groupPlaceProposal.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prismaMock.itineraryDestination.findFirst
      .mockResolvedValueOnce({ id: 'dest-1', dayNumber: 1 })
      .mockResolvedValueOnce(null);
    prismaMock.groupPlaceProposal.findUniqueOrThrow.mockResolvedValueOnce({
      ...row,
      status: ProposalStatus.APPROVED,
    });

    const res = await service.resolveProposal(
      ITINERARY_ID,
      PROPOSAL_ID,
      OWNER_ID,
      'APPROVE',
    );

    expect(accessMock.assertCanEdit).toHaveBeenCalledWith(
      ITINERARY_ID,
      OWNER_ID,
    );
    expect(prismaMock.groupPlaceProposal.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          tripGroupId: 'group-1',
          destinationId: 'dest-1',
          status: ProposalStatus.PENDING,
          id: { not: PROPOSAL_ID },
        },
        data: { status: ProposalStatus.REJECTED },
      },
    );
    expect(copilotToolsMock.persistActivitySwap).toHaveBeenCalledWith(
      'dest-1',
      row.place,
      'Đổi sang quán ngon hơn',
      prismaMock,
    );
    expect(plannerMock.getById).toHaveBeenCalledWith(ITINERARY_ID, OWNER_ID);
    expect(res.proposal.status).toBe(ProposalStatus.APPROVED);
    expect(res.itinerary).toBeDefined();
  });

  it('resolveProposal APPROVE executes addActivityInTx when destinationId is null, and REJECT skips itinerary fetch', async () => {
    const addRow = makeProposalRow({
      destinationId: null,
      dayNumber: 2,
      proposedStartTime: '15:30',
    });
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(addRow);
    prismaMock.groupPlaceProposal.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    prismaMock.groupPlaceProposal.findUniqueOrThrow.mockResolvedValueOnce({
      ...addRow,
      status: ProposalStatus.APPROVED,
    });

    await service.resolveProposal(
      ITINERARY_ID,
      PROPOSAL_ID,
      OWNER_ID,
      'APPROVE',
    );
    expect(copilotToolsMock.addActivityInTx).toHaveBeenCalledWith(
      prismaMock,
      ITINERARY_ID,
      {
        place: addRow.place,
        dayNumber: 2,
        startTime: '15:30',
        notes: 'Đổi sang quán ngon hơn',
      },
    );

    plannerMock.getById.mockClear();
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(addRow);
    prismaMock.groupPlaceProposal.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    prismaMock.groupPlaceProposal.findUniqueOrThrow.mockResolvedValueOnce({
      ...addRow,
      status: ProposalStatus.REJECTED,
    });

    const rejected = await service.resolveProposal(
      ITINERARY_ID,
      PROPOSAL_ID,
      OWNER_ID,
      'REJECT',
    );
    expect(rejected.proposal.status).toBe(ProposalStatus.REJECTED);
    expect(rejected.itinerary).toBeUndefined();
    expect(plannerMock.getById).not.toHaveBeenCalled();
  });

  it('withdrawProposal authorizes proposer or OWNER, forbids unrelated members, and handles missing rows', async () => {
    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce({
      id: PROPOSAL_ID,
      proposedBy: 'other-member',
      status: ProposalStatus.PENDING,
    });
    await expect(
      service.withdrawProposal(ITINERARY_ID, PROPOSAL_ID, VIEWER_ID),
    ).rejects.toThrow(ForbiddenException);

    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.withdrawProposal(ITINERARY_ID, PROPOSAL_ID, VIEWER_ID),
    ).rejects.toThrow(NotFoundException);

    prismaMock.groupPlaceProposal.findFirst.mockResolvedValueOnce({
      id: PROPOSAL_ID,
      proposedBy: VIEWER_ID,
      status: ProposalStatus.PENDING,
    });
    prismaMock.groupPlaceProposal.deleteMany.mockResolvedValueOnce({
      count: 1,
    });

    await expect(
      service.withdrawProposal(ITINERARY_ID, PROPOSAL_ID, VIEWER_ID),
    ).resolves.toEqual({ deletedId: PROPOSAL_ID });
  });
});
