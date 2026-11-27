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
      searchPlacesForItinerary: jest.fn().mockResolvedValue({
        toolName: 'search_places',
        success: true,
        message: 'Đã tìm thấy 2 địa điểm phù hợp trong khu vực chuyến đi.',
        data: {
          status: 'SUCCESS',
          totalMatched: 2,
          places: [
            { id: 'p-veg-1', name: 'Quán Chay Liên Hoa', rating: 4.8 },
            { id: 'p-veg-2', name: 'Nhà Hàng Chay Bồ Đề', rating: 4.6 },
          ],
        },
      }),
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
    expect(prismaMock.place.findMany).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('routes recommendation queries through read-only search_places without emitting a proposal or mutation badge', async () => {
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
                      name: 'search_places',
                      args: { query: 'quán chay', categorySlug: 'nha-hang' },
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
                    text: '1. **Quán Chay Liên Hoa** - Quán chay nổi tiếng.\n2. **Nhà Hàng Chay Bồ Đề** - Thực đơn đa dạng.',
                  },
                ],
              },
            },
          ],
        },
      });

    const response = await service.chat(
      ITINERARY_ID,
      'Gợi ý cho mình vài quán chay ngon nhé',
      VIEWER_ID,
    );

    expect(prismaMock.place.findMany).not.toHaveBeenCalled();
    expect(toolsMock.searchPlacesForItinerary).toHaveBeenCalledWith(
      ITINERARY_ID,
      expect.objectContaining({ query: 'quán chay', categorySlug: 'nha-hang' }),
      'vi',
    );
    expect(response.modified).toBe(false);
    expect(response.proposal).toBeUndefined();
    expect(response.appliedTool).toBeUndefined();
    expect(response.reply).toContain('Quán Chay Liên Hoa');
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards nearPlaceName, radiusKm, minRating to searchPlacesForItinerary and formats fallback list if synthesis fails', async () => {
    toolsMock.searchPlacesForItinerary.mockResolvedValueOnce({
      toolName: 'search_places',
      success: true,
      message: 'Đã tìm thấy 2 địa điểm phù hợp trong khu vực chuyến đi.',
      data: {
        status: 'SUCCESS',
        anchorName: 'Cầu Rồng',
        radiusKm: 2,
        totalMatched: 2,
        places: [
          {
            id: 'c-1',
            name: 'Cafe Gần Cầu Rồng',
            category: 'Cà phê',
            address: '01 Trần Hưng Đạo',
            rating: 4.8,
            distanceKm: 0.4,
          },
          {
            id: 'c-2',
            name: 'Cafe Sông Hàn',
            category: 'Cà phê',
            address: '12 Bạch Đằng',
            rating: 4.7,
            distanceKm: 1.2,
          },
        ],
      },
    });

    jest
      .spyOn((service as any).httpClient, 'post')
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'search_places',
                      args: {
                        query: 'cafe',
                        nearPlaceName: 'Cầu Rồng',
                        radiusKm: 2,
                        minRating: 4.5,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error('Gemini second-turn timeout'));

    const response = await service.chat(
      ITINERARY_ID,
      'Tìm cafe trên 4.5 sao gần Cầu Rồng trong 2km',
      VIEWER_ID,
    );

    expect(toolsMock.searchPlacesForItinerary).toHaveBeenCalledWith(
      ITINERARY_ID,
      expect.objectContaining({
        query: 'cafe',
        nearPlaceName: 'Cầu Rồng',
        radiusKm: 2,
        minRating: 4.5,
      }),
      'vi',
    );
    expect(response.modified).toBe(false);
    expect(response.reply).toContain('1. **Cafe Gần Cầu Rồng**');
    expect(response.reply).toContain('2. **Cafe Sông Hàn**');
    expect(response.reply).toContain('cách Cầu Rồng 0.4 km');
  });

  it('rejects non-mutating tools at the applyProposal trust boundary', async () => {
    await expect(
      service.applyProposal(
        ITINERARY_ID,
        'search_places',
        { query: 'chay' },
        OWNER_ID,
      ),
    ).rejects.toThrow();

    await expect(
      service.applyProposal(
        ITINERARY_ID,
        'change_destination',
        { newDestination: 'Phú Quốc' },
        OWNER_ID,
      ),
    ).rejects.toThrow();
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
