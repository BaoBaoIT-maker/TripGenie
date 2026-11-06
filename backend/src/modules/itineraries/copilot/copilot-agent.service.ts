import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildAlternatingGeminiContents,
  GeminiContent,
  GeminiPart,
} from '../../../common/utils/gemini-contents.util';
import { formatTimeOfDay } from '../../../common/utils/time-of-day.util';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { ItineraryAccessService } from '../services/itinerary-access.service';
import { CopilotToolsService } from './copilot-tools.service';
import {
  COPILOT_CONSTANTS,
  COPILOT_FUNCTION_DECLARATIONS,
  COPILOT_SUMMARY_JOB,
  COPILOT_SUMMARY_QUEUE,
  COPILOT_TOOL_NAMES,
  CopilotChatResponse,
  CopilotMessageHistoryItem,
  CopilotProposal,
  CopilotToolExecutionResult,
  CopilotToolName,
} from './copilot.types';

type CopilotToolHandler = (
  itineraryId: string,
  args: Record<string, unknown>,
  dryRun: boolean,
) => Promise<CopilotToolExecutionResult>;

const PROPOSAL_TITLE_BUILDERS: Record<
  CopilotToolName,
  (data?: Record<string, unknown>) => string
> = {
  [COPILOT_TOOL_NAMES.SWAP_ACTIVITY]: (data) =>
    data?.dayNumber ? `Đề xuất đổi địa điểm Ngày ${data.dayNumber}` : 'Đề xuất đổi địa điểm',
  [COPILOT_TOOL_NAMES.SWAP_DAYS]: (data) =>
    data?.dayA && data?.dayB
      ? `Đề xuất hoán đổi Ngày ${data.dayA} và Ngày ${data.dayB}`
      : 'Đề xuất hoán đổi ngày',
  [COPILOT_TOOL_NAMES.ADD_ACTIVITY]: (data) =>
    data?.dayNumber ? `Đề xuất thêm điểm Ngày ${data.dayNumber}` : 'Đề xuất thêm địa điểm',
  [COPILOT_TOOL_NAMES.REMOVE_ACTIVITY]: (data) =>
    data?.dayNumber ? `Đề xuất xóa điểm Ngày ${data.dayNumber}` : 'Đề xuất xóa địa điểm',
  [COPILOT_TOOL_NAMES.MOVE_ACTIVITY]: () => 'Đề xuất chuyển ngày hoạt động',
  [COPILOT_TOOL_NAMES.CHANGE_DESTINATION]: () => 'Đề xuất đổi điểm đến',
};

@Injectable()
export class CopilotAgentService {
  private readonly logger = new Logger(CopilotAgentService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly baseUrl: string;
  private readonly httpClient: AxiosInstance;
  private readonly toolHandlers: Record<CopilotToolName, CopilotToolHandler>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly toolsService: CopilotToolsService,
    private readonly plannerService: ItineraryPlannerService,
    private readonly accessService: ItineraryAccessService,
    @Optional()
    @InjectQueue(COPILOT_SUMMARY_QUEUE)
    private readonly summaryQueue?: Queue,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      COPILOT_CONSTANTS.DEFAULT_MODEL,
    );
    this.baseUrl = this.configService.get<string>(
      'GEMINI_BASE_URL',
      COPILOT_CONSTANTS.GEMINI_BASE_URL,
    );
    this.httpClient = axios.create({ timeout: COPILOT_CONSTANTS.API_TIMEOUT_MS });

    // Strategy/Dispatcher map: Open/Closed Principle (OCP) without switch/if-else chains
    this.toolHandlers = {
      [COPILOT_TOOL_NAMES.CHANGE_DESTINATION]: async (_itineraryId, args) => {
        const dest = String(args.newDestination || 'điểm đến mới');
        return {
          toolName: COPILOT_TOOL_NAMES.CHANGE_DESTINATION,
          success: false,
          message: `Đổi sang ${dest} cần khởi tạo một lịch trình mới để tính toán lại điểm đến, thời gian và phương tiện di chuyển phù hợp. Bạn hãy bấm vào nút bên dưới để tạo lịch trình ${dest} mới nhé!`,
          data: {
            action: {
              type: 'CREATE_NEW_TRIP',
              destination: dest,
            },
          },
        };
      },
      [COPILOT_TOOL_NAMES.SWAP_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.swapActivity(itineraryId, {
          dayNumber: args.dayNumber ? Number(args.dayNumber) : undefined,
          currentPlaceName: args.currentPlaceName ? String(args.currentPlaceName) : undefined,
          mealOrActivityType: args.mealOrActivityType
            ? String(args.mealOrActivityType)
            : undefined,
          query: String(args.query || 'địa điểm tương đương'),
          categorySlug: args.categorySlug ? String(args.categorySlug) : undefined,
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          newPlaceId: args.newPlaceId ? String(args.newPlaceId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.ADD_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.addActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          timeSlot: args.timeSlot ? String(args.timeSlot) : undefined,
          query: String(args.query || 'điểm tham quan'),
          categorySlug: args.categorySlug ? String(args.categorySlug) : undefined,
          placeId: args.placeId ? String(args.placeId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.REMOVE_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.removeActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          placeName: String(args.placeName || ''),
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.MOVE_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.moveActivity(itineraryId, {
          placeName: String(args.placeName || ''),
          fromDay: Number(args.fromDay || 1),
          toDay: Number(args.toDay || 2),
          targetTimeSlot: args.targetTimeSlot ? String(args.targetTimeSlot) : undefined,
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.SWAP_DAYS]: (itineraryId, args, dryRun) =>
        this.toolsService.swapDays(itineraryId, {
          dayA: Number(args.dayA || 1),
          dayB: Number(args.dayB || 2),
          dryRun,
        }),
    };
  }

  /**
   * Main conversational agent loop:
   * 1. Resolve Session & History
   * 2. Ground prompt with Itinerary context
   * 3. Send to Gemini with Tool Declarations
   * 4. Handle Function Call (if any) with proper thoughtSignature & functionResponse
   * 5. Atomically persist messages & return updated itinerary delta
   */
  async chat(
    itineraryId: string,
    userMessage: string,
    userId?: string,
    sessionId?: string,
    autoApply: boolean = false,
  ): Promise<CopilotChatResponse> {
    const cleanMessage = userMessage.trim();
    const itinerary = await this.prisma.itinerary.findFirst({
      where: { id: itineraryId, deletedAt: null },
      include: {
        destinations: {
          include: { place: { include: { category: true } } },
          orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
        },
      },
    });

    if (!itinerary) {
      throw new NotFoundException('Không tìm thấy lịch trình du lịch.');
    }

    await this.accessService.assertCanEdit(itineraryId, userId);

    // 1. Resolve / Create Chat Session
    const session = await this.resolveSession(
      itineraryId,
      itinerary.creatorId,
      userId,
      sessionId,
    );

    // 2. Fetch recent conversation history using Sliding Window before persisting the turn
    const recentRows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: COPILOT_CONSTANTS.SLIDING_WINDOW_SIZE,
    });
    const historyRows = recentRows.reverse();

    // 3. Build prompt context and contents with destination places grounding
    const destinationPlaces = await this.prisma.place.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: itinerary.areaId
          ? [
              { areaId: itinerary.areaId },
              { area: { parentId: itinerary.areaId } },
              { area: { parent: { parentId: itinerary.areaId } } },
            ]
          : [
              { address: { contains: itinerary.destination || '', mode: 'insensitive' } },
              { name: { contains: itinerary.destination || '', mode: 'insensitive' } },
            ],
      },
      select: {
        name: true,
        category: { select: { nameVi: true, name: true } },
      },
      take: COPILOT_CONSTANTS.GROUNDING_PLACES_LIMIT,
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
    });

    const systemInstruction = this.buildSystemInstruction({
      destination: itinerary.destination || COPILOT_CONSTANTS.DEFAULT_DESTINATION,
      destinations: itinerary.destinations,
      availablePlaces: destinationPlaces,
      sessionSummary: session.summary,
    });
    const contents: GeminiContent[] = buildAlternatingGeminiContents(
      historyRows,
      cleanMessage,
    );

    // 4. Call Gemini Function Calling API
    const modelPath = this.modelName.startsWith('models/')
      ? this.modelName
      : `models/${this.modelName}`;
    const url = `${this.baseUrl}/${modelPath}:generateContent?key=${this.apiKey}`;

    let agentReply = '';
    let appliedTool: CopilotChatResponse['appliedTool'] = undefined;
    let action: CopilotChatResponse['action'] = undefined;
    let proposal: CopilotChatResponse['proposal'] = undefined;
    let modified = false;

    try {
      const response = await this.httpClient.post(url, {
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        tools: [{ functionDeclarations: COPILOT_FUNCTION_DECLARATIONS }],
        generationConfig: {
          temperature: COPILOT_CONSTANTS.TEMPERATURE,
        },
      });

      const candidateParts: GeminiPart[] =
        response.data?.candidates?.[0]?.content?.parts || [];
      const functionCallPart = candidateParts.find(
        (part) => part.functionCall && part.functionCall.name,
      );
      const functionCall = functionCallPart?.functionCall;

      if (functionCall) {
        // --- TOOL EXECUTION PATH ---
        const toolName = functionCall.name;
        const toolArgs = functionCall.args || {};
        this.logger.log(
          `Gemini invoked tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`,
        );

        const isModifyingTool = toolName !== COPILOT_TOOL_NAMES.CHANGE_DESTINATION;
        const shouldDryRun = isModifyingTool && !autoApply;

        if (!shouldDryRun && isModifyingTool) {
          await this.accessService.assertCanEdit(itineraryId, userId);
        }

        const toolResult = await this.executeTool(
          itineraryId,
          toolName,
          toolArgs,
          shouldDryRun,
        );
        appliedTool = {
          name: toolName,
          args: toolArgs,
          resultMessage: toolResult.message,
        };

        if (toolResult.data?.action) {
          action = toolResult.data.action as CopilotChatResponse['action'];
        }

        if (shouldDryRun && toolResult.success) {
          modified = false;
          proposal = {
            id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            toolName,
            title: this.getProposalTitle(toolName, toolResult.data),
            description: toolResult.message,
            dayNumber: toolResult.data?.dayNumber as number | undefined,
            fromPlaceId: toolResult.data?.oldPlaceId as string | undefined,
            fromPlaceName: toolResult.data?.oldPlaceName as string | undefined,
            fromPlaceCoordinates: toolResult.data?.oldPlaceCoordinates as
              | { latitude: number; longitude: number }
              | undefined,
            toPlaceId: (toolResult.data?.newPlaceId || toolResult.data?.placeId) as
              | string
              | undefined,
            toPlaceName: (toolResult.data?.newPlaceName || toolResult.data?.placeName) as
              | string
              | undefined,
            toPlaceRating: toolResult.data?.newPlaceRating as number | undefined,
            toPlaceCategory: toolResult.data?.newPlaceCategory as string | undefined,
            toPlaceAddress: (toolResult.data?.newPlaceAddress ||
              toolResult.data?.address) as string | undefined,
            toPlaceCoordinates: toolResult.data?.newPlaceCoordinates as
              | { latitude: number; longitude: number }
              | undefined,
            swapDays:
              toolResult.data?.dayA && toolResult.data?.dayB
                ? {
                    dayA: toolResult.data.dayA as number,
                    dayB: toolResult.data.dayB as number,
                  }
                : undefined,
            args: (toolResult.data?.args || toolArgs) as Record<string, unknown>,
          };
        } else {
          modified = toolResult.success;
        }

        // Synthesize natural response from LLM by preserving candidateParts (thoughtSignature)
        // and sending a spec-compliant functionResponse turn
        try {
          const secondResponse = await this.httpClient.post(url, {
            contents: [
              ...contents,
              {
                role: 'model',
                parts: candidateParts,
              },
              {
                role: 'user',
                parts: [
                  {
                    functionResponse: {
                      name: toolName,
                      response: {
                        status: toolResult.success ? 'SUCCESS' : 'FAILED',
                        mode: shouldDryRun ? 'PROPOSAL_DRY_RUN' : 'APPLIED',
                        resultMessage: toolResult.message,
                        oldPlaceName: proposal?.fromPlaceName,
                        proposedPlaceName: proposal?.toPlaceName,
                        instruction: shouldDryRun
                          ? `Đây mới là ĐỀ XUẤT (chưa áp dụng vào lịch trình). BẮT BUỘC nêu chính xác tên địa điểm đề xuất trong resultMessage ("${proposal?.toPlaceName || ''}"), tuyệt đối không tự gọi tên quán khác, và mời người dùng bấm nút [Áp dụng vào lịch trình] bên dưới.`
                          : 'Đã thực thi thay đổi thành công. Hãy phản hồi ngắn gọn, thân thiện và nhiệt tình cho người dùng.',
                      },
                    },
                  },
                ],
              },
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: COPILOT_CONSTANTS.SYNTHESIS_TEMPERATURE },
          });
          const secondParts: GeminiPart[] =
            secondResponse.data?.candidates?.[0]?.content?.parts || [];
          agentReply =
            secondParts
              .filter((p) => p.text)
              .map((p) => p.text)
              .join('\n')
              .trim() || toolResult.message;
        } catch (synthErr) {
          this.logger.warn(
            `Copilot second-turn synthesis fallback: ${(synthErr as Error).message}`,
          );
          agentReply = toolResult.message;
        }
      } else {
        // --- DIRECT TEXT PATH (Q&A / Guardrails) ---
        agentReply =
          candidateParts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join('\n')
            .trim() ||
          'Genie đã ghi nhận yêu cầu của bạn. Bạn có muốn điều chỉnh thêm hoạt động nào nữa không?';
      }
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Gemini Copilot Error: ${e.message}`, e.stack);
      agentReply =
        'Genie hiện đang bận tối ưu hóa dữ liệu. Bạn hãy thử lại câu hỏi hoặc dùng nút ✨ Đổi điểm trực tiếp trên thẻ nhé!';
    }

    // 5. Atomically persist USER message, AGENT response, and session messageCount
    await this.prisma.$transaction([
      this.prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          sender: 'USER',
          content: cleanMessage,
        },
      }),
      this.prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          sender: 'AGENT',
          content: agentReply,
          toolCalls: appliedTool ? JSON.parse(JSON.stringify(appliedTool)) : undefined,
          toolResults: proposal ? JSON.parse(JSON.stringify(proposal)) : undefined,
        },
      }),
      this.prisma.aiChatSession.update({
        where: { id: session.id },
        data: { messageCount: { increment: 2 } },
      }),
    ]);

    // 5b. Dispatch background session summarization via BullMQ queue (or async fallback)
    if (session.messageCount + 2 >= COPILOT_CONSTANTS.SUMMARIZATION_THRESHOLD) {
      this.enqueueSessionSummarization(session.id).catch((err) =>
        this.logger.warn(`Enqueue summarization error: ${(err as Error).message}`),
      );
    }

    // 6. If modified, fetch the fresh updated itinerary detail
    let updatedItinerary: unknown = undefined;
    if (modified) {
      try {
        updatedItinerary = await this.plannerService.getById(itineraryId, userId);
      } catch (err) {
        this.logger.warn(`Could not refresh itinerary detail: ${(err as Error).message}`);
      }
    }

    return {
      sessionId: session.id,
      reply: agentReply,
      modified,
      action,
      appliedTool,
      proposal,
      itinerary: updatedItinerary,
    };
  }

  /**
   * Fetch chat history for an itinerary session.
   */
  async getChatHistory(
    itineraryId: string,
    sessionId?: string,
    userId?: string,
  ): Promise<CopilotMessageHistoryItem[]> {
    await this.accessService.assertCanView(itineraryId, userId);

    const session = sessionId
      ? await this.prisma.aiChatSession.findFirst({
          where: { id: sessionId, linkedItineraryId: itineraryId, userId },
        })
      : await this.prisma.aiChatSession.findFirst({
          where: { linkedItineraryId: itineraryId, userId },
          orderBy: { createdAt: 'desc' },
        });

    if (!session) return [];

    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: COPILOT_CONSTANTS.HISTORY_MESSAGES_LIMIT,
    });

    return messages.map((m) => {
      const prop = m.toolResults as unknown as CopilotProposal | undefined;
      return {
        id: m.id,
        sender: m.sender === 'USER' ? 'user' : 'agent',
        content: m.content || '',
        createdAt: m.createdAt.toISOString(),
        toolCalls: m.toolCalls,
        proposal: prop || undefined,
      };
    });
  }

  /**
   * Apply a user-confirmed Copilot proposal directly to the database.
   */
  async applyProposal(
    itineraryId: string,
    toolName: string,
    args: Record<string, unknown>,
    userId?: string,
    proposalId?: string,
  ): Promise<{ success: boolean; message: string; itinerary: unknown }> {
    await this.accessService.assertCanEdit(itineraryId, userId);

    const toolResult = await this.executeTool(
      itineraryId,
      toolName,
      args,
      false /* dryRun = false */,
    );
    let itinerary: unknown = undefined;
    if (toolResult.success) {
      try {
        itinerary = await this.plannerService.getById(itineraryId, userId);
      } catch (err) {
        this.logger.warn(
          `Could not refresh itinerary after proposal apply: ${(err as Error).message}`,
        );
      }

      if (proposalId) {
        try {
          const matchingMessages = await this.prisma.aiChatMessage.findMany({
            where: {
              session: { linkedItineraryId: itineraryId },
              sender: 'AGENT',
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          for (const msg of matchingMessages) {
            if (msg.toolResults && typeof msg.toolResults === 'object') {
              const resObj = msg.toolResults as Record<string, unknown>;
              if (resObj.id === proposalId) {
                await this.prisma.aiChatMessage.update({
                  where: { id: msg.id },
                  data: {
                    toolResults: { ...resObj, status: 'APPLIED' },
                  },
                });
                break;
              }
            }
          }
        } catch {
          // Ignore non-critical history tag error
        }
      }
    }
    return {
      success: toolResult.success,
      message: toolResult.message,
      itinerary,
    };
  }

  /**
   * Enqueue session summarization into BullMQ job queue.
   * If BullMQ / Redis is unavailable, gracefully degrades to direct in-process async.
   */
  async enqueueSessionSummarization(sessionId: string): Promise<void> {
    try {
      if (this.summaryQueue) {
        await this.summaryQueue.add(
          COPILOT_SUMMARY_JOB,
          { sessionId },
          {
            jobId: `summary-${sessionId}`,
            removeOnComplete: true,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
          },
        );
        this.logger.debug(`Enqueued summarization job for session ${sessionId} to BullMQ`);
        return;
      }
    } catch (err) {
      this.logger.warn(
        `Could not enqueue to BullMQ (${(err as Error).message}), falling back to direct async`,
      );
    }

    this.summarizeSession(sessionId).catch((err) =>
      this.logger.warn(`Direct background summarization error: ${(err as Error).message}`),
    );
  }

  /**
   * Summarize older messages in a chat session using Batching (cycle of 8) and Delta extraction.
   */
  async summarizeSession(sessionId: string): Promise<string | null> {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;

    const totalMessages = await this.prisma.aiChatMessage.count({
      where: { sessionId },
    });

    if (totalMessages < COPILOT_CONSTANTS.SUMMARIZATION_THRESHOLD) {
      return session.summary;
    }

    const countEligible = totalMessages - COPILOT_CONSTANTS.SLIDING_WINDOW_SIZE;
    if (countEligible <= 0) return session.summary;

    const eligibleMessages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: countEligible,
      select: { id: true, sender: true, content: true, createdAt: true },
    });

    if (eligibleMessages.length === 0) return session.summary;

    const lastSummarizedIndex = session.lastSummarizedMessageId
      ? eligibleMessages.findIndex((m) => m.id === session.lastSummarizedMessageId)
      : -1;

    const deltaMessages = eligibleMessages.slice(lastSummarizedIndex + 1);
    const deltaCount = deltaMessages.length;

    const meetsBatch =
      !session.lastSummarizedMessageId ||
      deltaCount >= COPILOT_CONSTANTS.SUMMARY_BATCH_SIZE;

    if (!meetsBatch || deltaCount === 0) {
      return session.summary;
    }

    const deltaTranscript = deltaMessages
      .map((m) => `${m.sender}: ${m.content || ''}`)
      .join('\n');

    const prompt = `Bạn là trợ lý ghi nhớ thông tin du lịch. Dưới đây là cuộc trò chuyện giữa khách và trợ lý du lịch:${
      session.summary ? `\n[Tóm tắt trước đó]:\n${session.summary}\n` : ''
    }\n[Các trao đổi mới]:\n${deltaTranscript}\n\nHãy cập nhật và tóm tắt ngắn gọn trong 2-3 câu hoặc gạch đầu dòng:
1. Nhu cầu, sở thích đặc biệt của khách (nếu có: đi với ai, ăn gì, kiêng gì, ngân sách...).
2. Các quyết định hoặc thay đổi lịch trình đã được thống nhất.
Chỉ trả về nội dung tóm tắt súc tích, không thêm lời chào hỏi hay mở bài.`;

    try {
      const modelPath = this.modelName.startsWith('models/')
        ? this.modelName
        : `models/${this.modelName}`;
      const url = `${this.baseUrl}/${modelPath}:generateContent?key=${this.apiKey}`;

      const res = await this.httpClient.post(url, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: COPILOT_CONSTANTS.SUMMARY_TEMPERATURE,
          maxOutputTokens: COPILOT_CONSTANTS.SUMMARY_MAX_TOKENS,
        },
      });

      const summaryParts: GeminiPart[] =
        res.data?.candidates?.[0]?.content?.parts || [];
      const newSummary = summaryParts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('\n')
        .trim();
      if (newSummary) {
        const lastMsg = deltaMessages[deltaMessages.length - 1];
        await this.prisma.aiChatSession.update({
          where: { id: sessionId },
          data: {
            summary: newSummary,
            lastSummarizedMessageId: lastMsg.id,
            lastSummarizedAt: lastMsg.createdAt,
          },
        });
        return newSummary;
      }
    } catch (err) {
      this.logger.warn(`Could not summarize session ${sessionId}: ${(err as Error).message}`);
    }

    return session.summary;
  }

  // ===========================================================================
  // PRIVATE AGENT LOGIC (OCP Dispatcher)
  // ===========================================================================

  private getProposalTitle(toolName: string, data?: Record<string, unknown>): string {
    const builder = PROPOSAL_TITLE_BUILDERS[toolName as CopilotToolName];
    return builder ? builder(data) : 'Đề xuất thay đổi lịch trình';
  }

  private async executeTool(
    itineraryId: string,
    toolName: string,
    args: Record<string, unknown>,
    dryRun: boolean = false,
  ): Promise<CopilotToolExecutionResult> {
    const handler = this.toolHandlers[toolName as CopilotToolName];
    if (!handler) {
      return {
        toolName,
        success: false,
        message: `Công cụ ${toolName} không được hỗ trợ.`,
      };
    }
    return handler(itineraryId, args, dryRun);
  }

  private async resolveSession(
    itineraryId: string,
    creatorId: string,
    userId?: string,
    sessionId?: string,
  ) {
    if (sessionId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: { id: sessionId, linkedItineraryId: itineraryId },
      });
      if (existing) return existing;
    }

    const latest = await this.prisma.aiChatSession.findFirst({
      where: { linkedItineraryId: itineraryId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) return latest;

    const effectiveUserId = userId || creatorId;

    return this.prisma.aiChatSession.create({
      data: {
        userId: effectiveUserId,
        linkedItineraryId: itineraryId,
        title: COPILOT_CONSTANTS.DEFAULT_SESSION_TITLE,
        contextCity: COPILOT_CONSTANTS.DEFAULT_DESTINATION,
      },
    });
  }

  private buildSystemInstruction(itinerary: {
    destination: string;
    destinations: Array<{
      dayNumber: number;
      startTime: Date | null;
      endTime: Date | null;
      place: {
        name: string;
        address: string;
        category?: { nameVi?: string | null; name: string } | null;
      };
    }>;
    availablePlaces?: Array<{
      name: string;
      category?: { nameVi?: string | null; name: string } | null;
    }>;
    sessionSummary?: string | null;
  }): string {
    const dayGroups: Record<number, string[]> = {};
    for (const d of itinerary.destinations) {
      if (!dayGroups[d.dayNumber]) dayGroups[d.dayNumber] = [];
      const timeStr = formatTimeOfDay(d.startTime);
      const cat = d.place.category?.nameVi || d.place.category?.name || '';
      dayGroups[d.dayNumber].push(
        `${timeStr ? `[${timeStr}] ` : ''}${d.place.name}${cat ? ` (${cat})` : ''} - ${d.place.address}`,
      );
    }

    const scheduleSummary = Object.entries(dayGroups)
      .map(([day, items]) => `Ngày ${day}:\n  - ${items.join('\n  - ')}`)
      .join('\n\n');

    const availableSummary = (itinerary.availablePlaces || [])
      .map((p) => {
        const cat = p.category?.nameVi || p.category?.name || '';
        return `- ${p.name}${cat ? ` (${cat})` : ''}`;
      })
      .join('\n');

    return `Bạn là Genie Copilot - Trợ lý AI du lịch thông minh, thân thiện của ứng dụng TripGenie.
Bạn đang đồng hành cùng người dùng trong chuyến đi tại "${itinerary.destination}".
${itinerary.sessionSummary ? `\nTHÔNG TIN ĐÃ GHI NHẬN TỪ TRƯỚC (BỘ NHỚ DÀI HẠN):\n${itinerary.sessionSummary}\n` : ''}
LỊCH TRÌNH HIỆN TẠI CỦA CHUYẾN ĐI:
${scheduleSummary || 'Chưa có hoạt động cụ thể.'}

MỘT SỐ ĐỊA ĐIỂM TIÊU BIỂU TẠI "${itinerary.destination}" (Hệ thống còn hơn 2.000 địa điểm khác trong DB, các công cụ sẽ tự tra cứu toàn bộ DB):
${availableSummary || 'Đang cập nhật'}

QUY TẮC BẮT BUỘC (GUARDRAILS & NGUYÊN TẮC HÀNH XỬ):
1. QUY TẮC GỢI Ý & ĐỔI ĐỊA ĐIỂM (GROUNDING RULES - CỰC KỲ QUAN TRỌNG):
   - KHI NGƯỜI DÙNG HỎI GỢI Ý ĐỊA ĐIỂM THAY THẾ HOẶC HỎI CÒN CHỖ NÀO NỮA KHÔNG (chưa quyết định đổi):
     Hãy ưu tiên gợi ý các địa điểm CÓ TRONG danh sách tiêu biểu ở trên.
   - KHI NGƯỜI DÙNG YÊU CẦU ĐỔI HOẶC CHỌN ĐỊA ĐIỂM (Ví dụ: "đổi quán ăn trưa ngày 1 sang quán hải sản Bé Mặn", "chọn quán 1", "đổi quán trưa sang quán hải sản"):
     BẮT BUỘC GỌI NGAY TOOL \`swap_activity\` (kể cả khi tên quán người dùng nêu không nằm trong danh sách rút gọn ở trên, vì công cụ \`swap_activity\` sẽ tự tìm trên toàn bộ cơ sở dữ liệu). TUYỆT ĐỐI KHÔNG tự ý từ chối đổi khi chưa gọi tool:
     + \`currentPlaceName\`: Tên chính xác của địa điểm cũ đang cần thay thế trong lịch trình.
     + \`dayNumber\`: Số thứ tự ngày của địa điểm cần đổi trong "LỊCH TRÌNH HIỆN TẠI CỦA CHUYẾN ĐI" (1, 2, 3...).
     + \`query\`: Truyền đúng tên địa điểm hoặc thể loại mà người dùng vừa yêu cầu.
2. RANH GIỚI VAI TRÒ (OFF-TOPIC GUARDRAIL):
   - Bạn CHỈ hỗ trợ các câu hỏi liên quan đến chuyến đi, lịch trình, ẩm thực, văn hóa, thời tiết, di chuyển tại "${itinerary.destination}".
   - NẾU người dùng hỏi các chủ đề ngoài lề (lập trình, giải bài tập, giải toán, chính trị, triết học...):
     Hãy TỪ CHỐI LỊCH THIỆP trong 1 câu ngắn gọn và KHÉO LÉO KÉO VỀ CHUYẾN ĐI.
     Ví dụ: "Genie là trợ lý du lịch chuyên trách cho chuyến đi ${itinerary.destination} nên không thể hỗ trợ viết code/giải toán được rồi! Quay lại lịch trình nhé: Bạn có muốn Genie gợi ý quán ăn tối hay tối ưu lại cung đường không?"
3. ĐIỀU CHỈNH LỊCH TRÌNH (TOOL CALLING):
   - Khi người dùng muốn đổi quán/đổi điểm -> GỌI TOOL \`swap_activity\`.
   - Khi người dùng muốn thêm điểm mới -> GỌI TOOL \`add_activity\`.
     + LƯU Ý KHI THÊM ĐIỂM ĐÃ CÓ: Nếu địa điểm người dùng muốn thêm ĐÃ CÓ MẶT trong "LỊCH TRÌNH HIỆN TẠI CỦA CHUYẾN ĐI" ở trên, trước tiên hãy hỏi lại 1 câu ngắn gọn xác nhận: Nêu rõ quán đó đã có ở Ngày mấy, và hỏi người dùng muốn DỜI LỊCH (sang ngày mới) hay thực sự muốn GHÉ LẠI LẦN NỮA. Chỉ gọi \`add_activity\` khi người dùng khẳng định muốn ghé lại lần nữa.
   - Khi người dùng muốn xóa điểm -> GỌI TOOL \`remove_activity\`.
   - Khi người dùng muốn dời điểm sang ngày khác -> GỌI TOOL \`move_activity\`.
   - Khi người dùng muốn đổi thứ tự giữa 2 ngày -> GỌI TOOL \`swap_days\`.
   - TUYỆT ĐỐI KHÔNG tự nói rằng bạn đã sửa lịch trình nếu bạn chưa gọi Function Tool tương ứng.
4. YÊU CẦU MƠ HỒ (CLARIFICATION):
   - Nếu người dùng nói "Đổi quán ăn đi" mà không rõ bữa trưa hay tối ngày nào, hãy hỏi lại 1 câu ngắn để xác nhận.
5. ĐỔI TỈNH THÀNH:
   - Nếu người dùng muốn đổi sang tỉnh thành khác (ví dụ từ ${itinerary.destination} sang Phú Quốc), hãy giải thích rằng cần tạo chuyến đi mới để tính toán lại toàn bộ phương tiện và địa danh.
6. PHONG CÁCH:
   - Nói tiếng Việt tự nhiên, ngắn gọn, nhiệt tình và thực tế.`;
  }
}
