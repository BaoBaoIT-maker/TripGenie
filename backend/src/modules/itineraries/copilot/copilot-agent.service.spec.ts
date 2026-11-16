import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CopilotAgentService } from './copilot-agent.service';
import { PrismaService } from '../../../database/prisma.service';
import { CopilotToolsService } from './copilot-tools.service';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { ItineraryAccessService } from '../services/itinerary-access.service';

describe('CopilotAgentService member scoping & session isolation', () => {
  const ITINERARY_ID = 'itin-1';
  const OWNER_ID = 'owner-1';
  const VIEWER_ID = 'viewer-1';

  let prismaMock: any;
  let toolsMock: any;
  let plannerMock: any;
  let accessMock: { assertIsGroupMember: jest.Mock; assertCanEdit: jest.Mock };
  let service: CopilotAgentService;

  beforeEach(() => {
    prismaMock = {
      itinerary: {
        findFirst: jest.fn().mockResolvedValue({
          id: ITINERARY_ID,
          creatorId: OWNER_ID,
          destination: 'Đà Nẵng',
          partySize: 2,
          startDate: new Date('2026-11-12T00:00:00.000Z'),
          endDate: new Date('2026-11-14T00:00:00.000Z'),
          areaId: null,
          area: null,
          destinations: [],
        }),
      },
      aiChatSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sess-viewer',
          summary: null,
          messageCount: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'sess-new',
          summary: null,
          messageCount: 0,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiChatMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      place: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    toolsMock = {
      swapActivity: jest.fn().mockResolvedValue({
        success: true,
        message: 'Gợi ý thay quán cà phê',
        data: {
          dayNumber: 1,
          oldPlaceId: 'p-old',
          oldPlaceName: 'Quán cũ',
          newPlaceId: 'p-new',
          newPlaceName: 'Cafe Cộng',
          args: { oldPlaceName: 'Quán cũ', newPlaceName: 'Cafe Cộng' },
        },
      }),
    };

    plannerMock = {
      getById: jest.fn(),
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
      assertCanEdit: jest.fn(),
    };

    const configMock = {
      get: jest.fn((_key: string, def?: string) => def ?? 'test-key'),
    } as unknown as ConfigService;

    service = new CopilotAgentService(
      prismaMock as PrismaService,
      configMock,
      toolsMock,
      plannerMock,
      accessMock as unknown as ItineraryAccessService,
    );
  });

  it('scopes resolveSession queries strictly by userId and forces VIEWER chats into dryRun proposal mode even when autoApply=true', async () => {
    const postSpy = jest
      .spyOn((service as any).httpClient, 'post')
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'swap_activity',
                      args: { oldPlaceName: 'Quán cũ', newCategory: 'cafe' },
                    },
                  },
                ],
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Mình gợi ý đổi sang Cafe Cộng để cả nhóm bình chọn nhé!',
                  },
                ],
              },
            },
          ],
        },
      });

    const response = await service.chat(
      ITINERARY_ID,
      'Đổi Quán cũ sang cafe giúp nhóm',
      VIEWER_ID,
      'sess-other',
      true,
    );

    expect(accessMock.assertIsGroupMember).toHaveBeenCalledWith(
      ITINERARY_ID,
      VIEWER_ID,
    );
    expect(prismaMock.aiChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sess-other',
        linkedItineraryId: ITINERARY_ID,
        userId: VIEWER_ID,
      },
    });
    expect(toolsMock.swapActivity).toHaveBeenCalledWith(
      ITINERARY_ID,
      expect.objectContaining({ dryRun: true }),
    );
    expect(response.modified).toBe(false);
    expect(response.proposal?.toPlaceName).toBe('Cafe Cộng');
    expect(plannerMock.getById).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('blocks non-member guests in getChatHistory via assertIsGroupMember', async () => {
    accessMock.assertIsGroupMember.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.getChatHistory(ITINERARY_ID, undefined, 'stranger-id'),
    ).rejects.toThrow(ForbiddenException);
  });
});
