import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import {
  aiConfig,
  appConfig,
  crawlerConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
} from '../../config';
import { PrismaModule } from '../../database/prisma.module';
import { PrismaService } from '../../database/prisma.service';
import { CopilotAgentService } from '../itineraries/copilot/copilot-agent.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PlacesModule } from '../places/places.module';
import { AdvisorToolsService } from './advisor-tools.service';
import {
  ADVISOR_CONSTANTS,
  ADVISOR_FALLBACK_MESSAGES,
  ADVISOR_TOOL_NAMES,
} from './advisor.constants';
import { AdvisorService } from './advisor.service';

describe('AdvisorService & AdvisorToolsService (Unit + Integration)', () => {
  // =========================================================================
  // PART 1: UNIT TESTS — ReAct Loop, Tool Dispatch, Circuit Breaker,
  // Score-Gap Filtering, LRU Cache & Summarization Reuse
  // =========================================================================
  describe('Unit Tests: ReAct Multi-Turn Orchestration & Token Optimization', () => {
    let advisorService: AdvisorService;
    let advisorTools: AdvisorToolsService;
    let mockPrisma: {
      aiChatSession: {
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        findMany: jest.Mock;
        delete: jest.Mock;
      };
      aiChatMessage: {
        findMany: jest.Mock;
        create: jest.Mock;
      };
      user: {
        findFirst: jest.Mock;
      };
    };
    let mockKnowledgeService: { searchKnowledge: jest.Mock };
    let mockKnowledgeRepo: { findAreaIdBySlug: jest.Mock };
    let mockPlaceRepo: { searchPlaces: jest.Mock; findById: jest.Mock };
    let mockCopilotAgent: { enqueueSessionSummarization: jest.Mock };
    let httpPostSpy: jest.SpyInstance;

    const MOCK_SESSION_ID = '11111111-2222-4333-8444-555555555555';
    const MOCK_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    beforeEach(async () => {
      mockPrisma = {
        aiChatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: MOCK_SESSION_ID,
            userId: MOCK_USER_ID,
            linkedItineraryId: null,
            title: 'Test Session',
            summary: null,
            messageCount: 0,
            createdAt: new Date(),
          }),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
          delete: jest.fn().mockResolvedValue({}),
        },
        aiChatMessage: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: MOCK_USER_ID }),
        },
      };

      mockKnowledgeService = {
        searchKnowledge: jest.fn(),
      };

      mockKnowledgeRepo = {
        findAreaIdBySlug: jest.fn(),
      };

      mockPlaceRepo = {
        searchPlaces: jest.fn(),
        findById: jest.fn(),
      };

      mockCopilotAgent = {
        enqueueSessionSummarization: jest.fn().mockResolvedValue(undefined),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          AdvisorService,
          AdvisorToolsService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultVal?: string) => {
                if (key === 'GEMINI_API_KEY') return 'test-gemini-api-key';
                if (key === 'GEMINI_MODEL') return 'gemini-2.5-flash';
                return defaultVal;
              }),
            },
          },
          { provide: KnowledgeService, useValue: mockKnowledgeService },
          {
            provide: INJECT_TOKENS.KNOWLEDGE_REPOSITORY,
            useValue: mockKnowledgeRepo,
          },
          {
            provide: INJECT_TOKENS.PLACE_REPOSITORY,
            useValue: mockPlaceRepo,
          },
          {
            provide: CopilotAgentService,
            useValue: mockCopilotAgent,
          },
        ],
      }).compile();

      advisorService = moduleRef.get<AdvisorService>(AdvisorService);
      advisorTools = moduleRef.get<AdvisorToolsService>(AdvisorToolsService);

      // Spy on internal axios httpClient
      httpPostSpy = jest.spyOn(
        (advisorService as unknown as { httpClient: { post: jest.Mock } })
          .httpClient,
        'post',
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('1. Direct Answer + Initial Turn LRU Cache: answers directly on 1st call and serves 2nd identical initial query from RAM with 0 Gemini HTTP calls', async () => {
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Bạn có thể tạo lịch trình chi tiết kèm bản đồ GPS tại trang Lập Lịch Trình (/planner).',
                  },
                ],
              },
            },
          ],
        },
      });

      const executeToolSpy = jest.spyOn(advisorTools, 'executeTool');

      // 1st call: hits Gemini API
      const firstResult = await advisorService.chat(
        {
          message: 'Làm sao để tạo lịch trình tự động trên web?',
          sessionId: MOCK_SESSION_ID,
        },
        MOCK_USER_ID,
      );

      expect(httpPostSpy).toHaveBeenCalledTimes(1);
      expect(executeToolSpy).not.toHaveBeenCalled();
      expect(firstResult.reply).toContain('/planner');

      // 2nd call (new user / initial session turn with same question, different punctuation): hits RAM LRU cache -> 0 new Gemini HTTP calls!
      const secondResult = await advisorService.chat(
        {
          message: '  làm sao để tạo lịch trình tự động trên web?! ',
          sessionId: MOCK_SESSION_ID,
        },
        MOCK_USER_ID,
      );

      expect(httpPostSpy).toHaveBeenCalledTimes(1);
      expect(secondResult.reply).toBe(firstResult.reply);
    });

    it('2. RAG Tool Call + Score-Gap Filtering + areaSlug Cache: prunes noisy tail chunks when top chunk is HIGH confidence', async () => {
      mockKnowledgeRepo.findAreaIdBySlug.mockResolvedValueOnce(5);
      mockKnowledgeService.searchKnowledge.mockResolvedValueOnce([
        {
          chunk_id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 2,
          content: 'Giá vé cáp treo Bà Nà Hills khứ hồi người lớn: 900.000đ.',
          metadata: {
            sectionTitle: 'Giá vé tham quan',
            breadcrumbs: 'Cẩm nang Đà Nẵng > Giá vé tham quan > Bà Nà Hills',
            categoryTags: ['ticket'],
          },
          document_title: 'Cẩm nang Du lịch Đà Nẵng - Hội An',
          source_type: 'curated_guide',
          source_url: 'data/knowledge/01-da-nang-hoi-an.md',
          area_id: 5,
          similarity_score: 0.7842,
        },
        {
          chunk_id: 'chunk-noise',
          document_id: 'doc-1',
          chunk_index: 9,
          content: 'Thông tin không liên quan về lịch sử cầu cổ.',
          metadata: {
            sectionTitle: 'Lịch sử',
            breadcrumbs: 'Cẩm nang Đà Nẵng > Lịch sử',
            categoryTags: ['history'],
          },
          document_title: 'Cẩm nang Du lịch Đà Nẵng - Hội An',
          source_type: 'curated_guide',
          source_url: 'data/knowledge/01-da-nang-hoi-an.md',
          area_id: 5,
          similarity_score: 0.291, // Low similarity noise chunk -> should be pruned by Score-Gap Filter
        },
      ]);

      // Turn 1: Gemini requests query_travel_knowledge
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE,
                      args: {
                        query: 'giá vé cáp treo Bà Nà Hills',
                        areaSlug: 'da-nang',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      // Turn 2: Gemini synthesizes final grounded answer from functionResponse
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Giá vé cáp treo Bà Nà Hills khứ hồi dành cho người lớn ngoại tỉnh là **900.000 VNĐ/người**.\n> Nguồn tham khảo: Cẩm nang Du lịch Đà Nẵng - Hội An > Giá vé tham quan > Bà Nà Hills',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await advisorService.chat(
        {
          message: 'Giá vé Bà Nà Hills hiện tại bao nhiêu?',
          sessionId: MOCK_SESSION_ID,
        },
        MOCK_USER_ID,
      );

      expect(httpPostSpy).toHaveBeenCalledTimes(2);
      expect(mockKnowledgeRepo.findAreaIdBySlug).toHaveBeenCalledTimes(1);
      // Score-Gap Filter must retain only the high-confidence chunk (0.7842) and drop the noisy 0.291 chunk
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]).toEqual({
        documentTitle: 'Cẩm nang Du lịch Đà Nẵng - Hội An',
        breadcrumbs: 'Cẩm nang Đà Nẵng > Giá vé tham quan > Bà Nà Hills',
        confidence: 'HIGH',
        similarityScore: 0.7842,
      });

      // Verify in-memory areaSlugCache hits on subsequent tool call for the same slug without hitting DB again
      mockKnowledgeService.searchKnowledge.mockResolvedValueOnce([]);
      await advisorTools.executeTool(
        ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE,
        { query: 'cầu Rồng phun lửa', areaSlug: 'da-nang' },
      );
      expect(mockKnowledgeRepo.findAreaIdBySlug).toHaveBeenCalledTimes(1);
    });

    it('3. Multi-Hop Tool Execution & History PlaceId Bridging + Summarization Delegation', async () => {
      const PLACE_ID = '99999999-8888-4777-8666-555555555555';

      // Simulate session reaching SUMMARIZATION_THRESHOLD (8 existing messages + 2 new = 10)
      mockPrisma.aiChatSession.findFirst.mockResolvedValueOnce({
        id: MOCK_SESSION_ID,
        userId: MOCK_USER_ID,
        linkedItineraryId: null,
        title: 'Test Session',
        summary: 'Khách thích ăn hải sản bình dân tại Đà Nẵng.',
        messageCount: 8,
        createdAt: new Date(),
      });

      // Simulate historical AGENT message containing discovered places in toolResults
      mockPrisma.aiChatMessage.findMany.mockResolvedValueOnce([
        {
          id: 'hist-1',
          sender: 'AGENT',
          content: 'Mình gợi ý quán Hải Sản Năm Đảnh.',
          toolResults: {
            places: [
              {
                id: PLACE_ID,
                name: 'Hải Sản Năm Đảnh',
              },
            ],
          },
          createdAt: new Date(),
        },
      ]);

      mockPlaceRepo.findById.mockResolvedValueOnce({
        id: PLACE_ID,
        name: 'Hải Sản Năm Đảnh',
        address: '139/59/38 Trần Quang Khải, Sơn Trà',
        ratingAvg: 4.5,
        reviewCount: 1200,
        priceLevel: 'LOW',
        phone: '0905123456',
        website: null,
        openingHours: { mon_sun: '10:00 - 20:30' },
        description: 'Hải sản tươi sống đồng giá bình dân.',
        latitude: 16.091,
        longitude: 108.241,
        category: { nameVi: 'Nhà hàng', name: 'Restaurant' },
        area: { nameVi: 'Đà Nẵng', name: 'Da Nang' },
        images: [
          { isPrimary: true, imageUrl: 'https://example.com/nam-danh.jpg' },
        ],
        sources: [],
      });

      // Turn 1: Gemini sees placeId in history and calls get_place_detail directly
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: ADVISOR_TOOL_NAMES.GET_PLACE_DETAIL,
                      args: { placeId: PLACE_ID },
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      // Turn 2: Gemini returns final text
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Hải Sản Năm Đảnh mở cửa từ 10:00 - 20:30 hàng ngày, hotline 0905123456.',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await advisorService.chat(
        {
          message: 'Quán đó mở cửa mấy giờ và số điện thoại bao nhiêu?',
          sessionId: MOCK_SESSION_ID,
        },
        MOCK_USER_ID,
      );

      // Verify history bridging injected placeId into Gemini contents
      const firstRequestPayload = httpPostSpy.mock.calls[0][1];
      expect(firstRequestPayload.contents[0].parts[0].text).toContain(
        `Hải Sản Năm Đảnh (placeId: ${PLACE_ID})`,
      );
      // Verify session.summary was injected into systemInstruction
      expect(firstRequestPayload.systemInstruction.parts[0].text).toContain(
        'Khách thích ăn hải sản bình dân tại Đà Nẵng.',
      );
      // Verify CopilotAgentService.enqueueSessionSummarization was triggered when messageCount + 2 >= 10
      expect(
        mockCopilotAgent.enqueueSessionSummarization,
      ).toHaveBeenCalledWith(MOCK_SESSION_ID);
      expect(result.places).toHaveLength(1);
      expect(result.places[0].id).toBe(PLACE_ID);
    });

    it('4. Circuit Breaker (MAX_TOOL_TURNS = 3): breaks infinite tool loop after 3 turns and forces synthesis without tools', async () => {
      mockKnowledgeService.searchKnowledge.mockResolvedValue([]);

      for (let i = 0; i < ADVISOR_CONSTANTS.MAX_TOOL_TURNS; i++) {
        httpPostSpy.mockResolvedValueOnce({
          data: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE,
                        args: { query: `loop query ${i}` },
                      },
                    },
                  ],
                },
              },
            ],
          },
        });
      }

      // 4th call is the forced synthesis call (without tools)
      httpPostSpy.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Tổng hợp sau khi ngắt mạch an toàn Circuit Breaker.',
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await advisorService.chat(
        { message: 'Câu hỏi phức tạp', sessionId: MOCK_SESSION_ID },
        MOCK_USER_ID,
      );

      expect(httpPostSpy).toHaveBeenCalledTimes(
        ADVISOR_CONSTANTS.MAX_TOOL_TURNS + 1,
      );
      const fourthCallBody = httpPostSpy.mock.calls[3][1];
      expect(fourthCallBody.tools).toBeUndefined();
      expect(result.reply).toBe(
        'Tổng hợp sau khi ngắt mạch an toàn Circuit Breaker.',
      );
    });

    it('5. Network Failure Resilience: catches HTTP errors and returns user-friendly fallback message without caching failed responses', async () => {
      httpPostSpy.mockRejectedValueOnce(
        new Error('Request timeout of 30000ms exceeded'),
      );

      const result = await advisorService.chat(
        { message: 'Tư vấn Đà Lạt', sessionId: MOCK_SESSION_ID },
        MOCK_USER_ID,
      );

      expect(result.reply).toBe(ADVISOR_FALLBACK_MESSAGES.NETWORK_ERROR);
      expect(result.places).toEqual([]);
      expect(result.citations).toEqual([]);
      expect(mockPrisma.aiChatMessage.create).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // PART 2: INTEGRATION TESTS — Real NestJS DI + Live PostgreSQL / pgvector
  // =========================================================================
  describe('Integration Tests: Live PostgreSQL (pgvector Knowledge + PostGIS Places)', () => {
    let moduleRef: TestingModule;
    let advisorTools: AdvisorToolsService;

    beforeAll(async () => {
      moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              appConfig,
              databaseConfig,
              jwtConfig,
              redisConfig,
              aiConfig,
              crawlerConfig,
            ],
          }),
          PrismaModule,
          KnowledgeModule,
          PlacesModule,
        ],
        providers: [AdvisorToolsService, AdvisorService],
      }).compile();

      await moduleRef.init();
      advisorTools = moduleRef.get<AdvisorToolsService>(AdvisorToolsService);
    });

    afterAll(async () => {
      if (moduleRef) {
        await moduleRef.close();
      }
    });

    it('6. [Integration] query_travel_knowledge retrieves Platform Handbook chunk from live pgvector DB', async () => {
      const outcome = await advisorTools.executeTool(
        ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE,
        {
          query:
            'phân quyền thành viên nhóm Owner Editor Viewer và biểu quyết đề xuất',
          areaSlug: 'viet-nam',
        },
      );

      expect(outcome.toolResponsePayload.status).toBe('SUCCESS');
      expect(outcome.discoveredCitations.length).toBeGreaterThan(0);
      const topCitation = outcome.discoveredCitations[0];
      expect(topCitation.documentTitle).toContain('TripGenie');
      expect(topCitation.similarityScore).toBeGreaterThan(0.5);
    }, 25000);

    it('7. [Integration] query_travel_knowledge resolves areaSlug="da-nang" and retrieves Da Nang handbook chunk', async () => {
      const outcome = await advisorTools.executeTool(
        ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE,
        {
          query:
            'giá vé cáp treo Bà Nà Hills và lệnh cấm xe tay ga bán đảo Sơn Trà',
          areaSlug: 'da-nang',
        },
      );

      expect(outcome.toolResponsePayload.status).toBe('SUCCESS');
      expect(outcome.discoveredCitations.length).toBeGreaterThan(0);
      expect(outcome.discoveredCitations[0].documentTitle).toContain('Đà Nẵng');
    }, 25000);

    it('8. [Integration] search_places & get_place_detail execute against live PostGIS places table', async () => {
      const searchOutcome = await advisorTools.executeTool(
        ADVISOR_TOOL_NAMES.SEARCH_PLACES,
        {
          areaSlug: 'da-nang',
          limit: 3,
        },
      );

      expect(searchOutcome.toolResponsePayload.status).toBe('SUCCESS');
      expect(searchOutcome.discoveredPlaces.length).toBeGreaterThan(0);
      expect(searchOutcome.discoveredPlaces.length).toBeLessThanOrEqual(3);

      const samplePlace = searchOutcome.discoveredPlaces[0];
      expect(samplePlace.id).toBeDefined();
      expect(samplePlace.name).toBeTruthy();

      const detailOutcome = await advisorTools.executeTool(
        ADVISOR_TOOL_NAMES.GET_PLACE_DETAIL,
        {
          placeId: samplePlace.id,
        },
      );

      expect(detailOutcome.toolResponsePayload.status).toBe('SUCCESS');
      expect(detailOutcome.discoveredPlaces).toHaveLength(1);
      expect(detailOutcome.discoveredPlaces[0].id).toBe(samplePlace.id);
    }, 20000);
  });
});
