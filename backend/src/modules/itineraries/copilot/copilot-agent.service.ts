import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../../database/prisma.service';
import { CopilotToolsService } from './copilot-tools.service';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import {
  COPILOT_CONSTANTS,
  COPILOT_FUNCTION_DECLARATIONS,
  COPILOT_TOOL_NAMES,
  COPILOT_SUMMARY_QUEUE,
  COPILOT_SUMMARY_JOB,
  CopilotChatResponse,
  CopilotMessageHistoryItem,
  CopilotProposal,
  CopilotToolExecutionResult,
} from './copilot.types';
import { formatTimeOfDay } from '../../../common/utils/time-of-day.util';

@Injectable()
export class CopilotAgentService {
  private readonly logger = new Logger(CopilotAgentService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly httpClient: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly toolsService: CopilotToolsService,
    private readonly plannerService: ItineraryPlannerService,
    @Optional()
    @InjectQueue(COPILOT_SUMMARY_QUEUE)
    private readonly summaryQueue?: Queue,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-flash-lite-latest',
    );
    this.httpClient = axios.create({ timeout: 25000 });
  }

  /**
   * Main conversational agent loop:
   * 1. Resolve Session & History
   * 2. Ground prompt with Itinerary context
   * 3. Send to Gemini with Tool Declarations
   * 4. Handle Function Call (if any)
   * 5. Persist messages & return updated itinerary delta
   */
  async chat(
    itineraryId: string,
    userMessage: string,
    userId?: string,
    sessionId?: string,
    autoApply: boolean = false,
  ): Promise<CopilotChatResponse> {
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

    // 1. Resolve / Create Chat Session
    const session = await this.resolveSession(itineraryId, itinerary.creatorId, userId, sessionId);

    // 2. Fetch recent conversation history using Sliding Window
    const recentRows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: COPILOT_CONSTANTS.SLIDING_WINDOW_SIZE,
    });
    const historyRows = recentRows.reverse();

    // 3. Save incoming user message
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'USER',
        content: userMessage,
      },
    });

    // 4. Build prompt context and contents with destination places grounding
    const destinationPlaces = await this.prisma.place.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { address: { contains: itinerary.destination || '', mode: 'insensitive' } },
          { name: { contains: itinerary.destination || '', mode: 'insensitive' } },
        ],
      },
      select: {
        name: true,
        category: { select: { nameVi: true, name: true } },
      },
      take: 25,
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
    });

    const systemInstruction = this.buildSystemInstruction({
      destination: itinerary.destination || 'Việt Nam',
      destinations: itinerary.destinations,
      availablePlaces: destinationPlaces,
      sessionSummary: session.summary,
    });
    const contents = this.buildGeminiContents(historyRows, userMessage);

    // 5. Call Gemini Function Calling API
    const modelPath = this.modelName.startsWith('models/')
      ? this.modelName
      : `models/${this.modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${this.apiKey}`;

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
          temperature: 0.3,
        },
      });

      const candidate = response.data?.candidates?.[0]?.content?.parts?.[0];
      const functionCall = candidate?.functionCall;

      if (functionCall) {
        // --- TOOL EXECUTION PATH ---
        const toolName = functionCall.name;
        const toolArgs = functionCall.args || {};
        this.logger.log(`Gemini invoked tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`);

        const isModifyingTool = toolName !== COPILOT_TOOL_NAMES.CHANGE_DESTINATION;
        const shouldDryRun = isModifyingTool && !autoApply;

        const toolResult = await this.executeTool(itineraryId, toolName, toolArgs, shouldDryRun);
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
            fromPlaceCoordinates: toolResult.data?.oldPlaceCoordinates as { latitude: number; longitude: number } | undefined,
            toPlaceId: (toolResult.data?.newPlaceId || toolResult.data?.placeId) as string | undefined,
            toPlaceName: (toolResult.data?.newPlaceName || toolResult.data?.placeName) as string | undefined,
            toPlaceRating: toolResult.data?.newPlaceRating as number | undefined,
            toPlaceCategory: toolResult.data?.newPlaceCategory as string | undefined,
            toPlaceAddress: (toolResult.data?.newPlaceAddress || toolResult.data?.address) as string | undefined,
            toPlaceCoordinates: toolResult.data?.newPlaceCoordinates as { latitude: number; longitude: number } | undefined,
            swapDays: toolResult.data?.dayA && toolResult.data?.dayB
              ? { dayA: toolResult.data.dayA as number, dayB: toolResult.data.dayB as number }
              : undefined,
            args: (toolResult.data?.args || toolArgs) as Record<string, unknown>,
          };
        } else {
          modified = toolResult.success;
        }

        // Try getting a natural response from LLM summarizing tool result
        try {
          const secondResponse = await this.httpClient.post(url, {
            contents: [
              ...contents,
              {
                role: 'model',
                parts: [{ functionCall }],
              },
              {
                role: 'user',
                parts: [
                  {
                    text: shouldDryRun
                      ? `[HỆ THỐNG]: Đã lập phương án đề xuất: "${toolResult.message}". Hãy giải thích ngắn gọn, thân thiện lý do tại sao bạn đề xuất thay đổi này và mời người dùng bấm nút [Áp dụng vào lịch trình] ngay bên dưới.`
                      : `[HỆ THỐNG]: Đã thực thi công cụ ${toolName}. Kết quả: "${toolResult.message}". Hãy phản hồi ngắn gọn, thân thiện và nhiệt tình cho người dùng về sự thay đổi này.`,
                  },
                ],
              },
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.4 },
          });
          agentReply =
            secondResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            toolResult.message;
        } catch {
          agentReply = toolResult.message;
        }
      } else {
        // --- DIRECT TEXT PATH (Q&A / Guardrails) ---
        agentReply =
          candidate?.text?.trim() ||
          'Genie đã ghi nhận yêu cầu của bạn. Bạn có muốn điều chỉnh thêm hoạt động nào nữa không?';
      }
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Gemini Copilot Error: ${e.message}`, e.stack);
      agentReply =
        'Genie hiện đang bận tối ưu hóa dữ liệu. Bạn hãy thử lại câu hỏi hoặc dùng nút ✨ Đổi điểm trực tiếp trên thẻ nhé!';
    }

    // 6. Persist Agent response message
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'AGENT',
        content: agentReply,
        toolCalls: appliedTool ? JSON.parse(JSON.stringify(appliedTool)) : undefined,
        toolResults: proposal ? JSON.parse(JSON.stringify(proposal)) : undefined,
      },
    });

    await this.prisma.aiChatSession.update({
      where: { id: session.id },
      data: { messageCount: { increment: 2 } },
    });

    // 6b. Dispatch background session summarization via BullMQ queue (or async fallback)
    if (session.messageCount + 2 >= COPILOT_CONSTANTS.SUMMARIZATION_THRESHOLD) {
      this.enqueueSessionSummarization(session.id).catch((err) =>
        this.logger.warn(`Enqueue summarization error: ${(err as Error).message}`),
      );
    }

    // 7. If modified, fetch the fresh updated itinerary detail
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
  async getChatHistory(itineraryId: string, sessionId?: string): Promise<CopilotMessageHistoryItem[]> {
    const session = sessionId
      ? await this.prisma.aiChatSession.findFirst({ where: { id: sessionId, linkedItineraryId: itineraryId } })
      : await this.prisma.aiChatSession.findFirst({
          where: { linkedItineraryId: itineraryId },
          orderBy: { createdAt: 'desc' },
        });

    if (!session) return [];

    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 30,
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
    const toolResult = await this.executeTool(itineraryId, toolName, args, false /* dryRun = false */);
    let itinerary: unknown = undefined;
    if (toolResult.success) {
      try {
        itinerary = await this.plannerService.getById(itineraryId, userId);
      } catch (err) {
        this.logger.warn(`Could not refresh itinerary after proposal apply: ${(err as Error).message}`);
      }

      // Mark proposal status as APPLIED if proposalId is given
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

    // Graceful fallback: direct in-process async summarization
    this.summarizeSession(sessionId).catch((err) =>
      this.logger.warn(`Direct background summarization error: ${(err as Error).message}`),
    );
  }

  /**
   * Summarize older messages in a chat session using Batching (cycle of 8) and Delta extraction.
   * Only messages outside the 8-message sliding window and accumulated since lastSummarizedMessageId
   * are sent to Gemini, maintaining concise memory and minimizing API token usage.
   */
  async summarizeSession(sessionId: string): Promise<string | null> {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;

    const totalMessages = await this.prisma.aiChatMessage.count({
      where: { sessionId },
    });

    // 1. Must reach the minimum threshold to begin summarizing
    if (totalMessages < COPILOT_CONSTANTS.SUMMARIZATION_THRESHOLD) {
      return session.summary;
    }

    // 2. Messages outside the 8-message sliding window are eligible for summarization
    const countEligible = totalMessages - COPILOT_CONSTANTS.SLIDING_WINDOW_SIZE;
    if (countEligible <= 0) return session.summary;

    const eligibleMessages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: countEligible,
      select: { id: true, sender: true, content: true, createdAt: true },
    });

    if (eligibleMessages.length === 0) return session.summary;

    // 3. Find the index of the last summarized message to extract ONLY the unsummarized Delta
    const lastSummarizedIndex = session.lastSummarizedMessageId
      ? eligibleMessages.findIndex((m) => m.id === session.lastSummarizedMessageId)
      : -1;

    const deltaMessages = eligibleMessages.slice(lastSummarizedIndex + 1);
    const deltaCount = deltaMessages.length;

    // 4. Batching check:
    // - Initial summary: requires deltaCount > 0 (reached threshold)
    // - Subsequent summaries: require at least SUMMARY_BATCH_SIZE (8) new unsummarized messages
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
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${this.apiKey}`;

      const res = await this.httpClient.post(url, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: COPILOT_CONSTANTS.SUMMARY_MAX_TOKENS,
        },
      });

      const newSummary = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
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
  // PRIVATE AGENT LOGIC
  // ===========================================================================

  private getProposalTitle(toolName: string, data?: Record<string, unknown>): string {
    switch (toolName) {
      case COPILOT_TOOL_NAMES.SWAP_ACTIVITY:
        return data?.dayNumber ? `Đề xuất đổi địa điểm Ngày ${data.dayNumber}` : 'Đề xuất đổi địa điểm';
      case COPILOT_TOOL_NAMES.SWAP_DAYS:
        return data?.dayA && data?.dayB
          ? `Đề xuất hoán đổi Ngày ${data.dayA} và Ngày ${data.dayB}`
          : 'Đề xuất hoán đổi ngày';
      case COPILOT_TOOL_NAMES.ADD_ACTIVITY:
        return data?.dayNumber ? `Đề xuất thêm điểm Ngày ${data.dayNumber}` : 'Đề xuất thêm địa điểm';
      case COPILOT_TOOL_NAMES.REMOVE_ACTIVITY:
        return data?.dayNumber ? `Đề xuất xóa điểm Ngày ${data.dayNumber}` : 'Đề xuất xóa địa điểm';
      case COPILOT_TOOL_NAMES.MOVE_ACTIVITY:
        return `Đề xuất chuyển ngày hoạt động`;
      default:
        return 'Đề xuất thay đổi lịch trình';
    }
  }

  private async executeTool(
    itineraryId: string,
    toolName: string,
    args: Record<string, unknown>,
    dryRun: boolean = false,
  ): Promise<CopilotToolExecutionResult> {
    switch (toolName) {
      case COPILOT_TOOL_NAMES.CHANGE_DESTINATION: {
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
      }

      case COPILOT_TOOL_NAMES.SWAP_ACTIVITY:
        return this.toolsService.swapActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          currentPlaceName: args.currentPlaceName ? String(args.currentPlaceName) : undefined,
          mealOrActivityType: args.mealOrActivityType ? String(args.mealOrActivityType) : undefined,
          query: String(args.query || 'địa điểm tương đương'),
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          newPlaceId: args.newPlaceId ? String(args.newPlaceId) : undefined,
          dryRun,
        });

      case COPILOT_TOOL_NAMES.ADD_ACTIVITY:
        return this.toolsService.addActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          timeSlot: args.timeSlot ? String(args.timeSlot) : undefined,
          query: String(args.query || 'điểm tham quan'),
          placeId: args.placeId ? String(args.placeId) : undefined,
          dryRun,
        });

      case COPILOT_TOOL_NAMES.REMOVE_ACTIVITY:
        return this.toolsService.removeActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          placeName: String(args.placeName || ''),
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          dryRun,
        });

      case COPILOT_TOOL_NAMES.MOVE_ACTIVITY:
        return this.toolsService.moveActivity(itineraryId, {
          placeName: String(args.placeName || ''),
          fromDay: Number(args.fromDay || 1),
          toDay: Number(args.toDay || 2),
          targetTimeSlot: args.targetTimeSlot ? String(args.targetTimeSlot) : undefined,
          destinationId: args.destinationId ? String(args.destinationId) : undefined,
          dryRun,
        });

      case COPILOT_TOOL_NAMES.SWAP_DAYS:
        return this.toolsService.swapDays(itineraryId, {
          dayA: Number(args.dayA || 1),
          dayB: Number(args.dayB || 2),
          dryRun,
        });

      default:
        return {
          toolName,
          success: false,
          message: `Công cụ ${toolName} không được hỗ trợ.`,
        };
    }
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

    let effectiveUserId = userId || creatorId;
    if (!effectiveUserId) {
      const fallbackUser = await this.prisma.user.findFirst({ select: { id: true } });
      effectiveUserId = fallbackUser?.id || '00000000-0000-0000-0000-000000000001';
    }

    return this.prisma.aiChatSession.create({
      data: {
        userId: effectiveUserId,
        linkedItineraryId: itineraryId,
        title: 'Trò chuyện cùng Genie Copilot',
        contextCity: 'Việt Nam',
      },
    });
  }

  private buildSystemInstruction(itinerary: {
    destination: string;
    destinations: Array<{
      dayNumber: number;
      startTime: Date | null;
      endTime: Date | null;
      place: { name: string; address: string; category?: { nameVi?: string | null; name: string } | null };
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

DANH SÁCH ĐỊA ĐIỂM CÓ SẴN TRONG CƠ SỞ DỮ LIỆU TẠI "${itinerary.destination}":
${availableSummary || 'Đang cập nhật'}

QUY TẮC BẮT BUỘC (GUARDRAILS & NGUYÊN TẮC HÀNH XỬ):
1. QUY TẮC GỢI Ý & ĐỔI ĐỊA ĐIỂM (GROUNDING RULES - CỰC KỲ QUAN TRỌNG):
   - KHI NGƯỜI DÙNG HỎI GỢI Ý ĐỊA ĐIỂM THAY THẾ HOẶC HỎI CÒN CHỖ NÀO NỮA KHÔNG:
     BẮT BUỘC CHỈ ĐƯỢC GỢI Ý các địa điểm CÓ TRONG "DANH SÁCH ĐỊA ĐIỂM CÓ SẴN" ở trên.
     TUYỆT ĐỐI KHÔNG tự bịa hoặc tự ý gợi ý những địa điểm không có trong danh sách trên, vì nếu người dùng chọn điểm đó thì hệ thống sẽ không có dữ liệu để thêm vào lịch trình.
   - KHI NGƯỜI DÙNG CHỌN HOẶC YÊU CẦU ĐỔI ĐỊA ĐIỂM (Ví dụ: "đổi thành hải sản năm đảnh", "chọn quán 1", "đổi quán trưa"):
     BẮT BUỘC GỌI TOOL \`swap_activity\` với các tham số:
     + \`currentPlaceName\`: Tên chính xác của địa điểm cũ đang cần thay thế đã đề cập trong cuộc trò chuyện (Ví dụ: nếu trước đó người dùng hỏi thay thế cho "Mì Quảng Bà Mua (Trần Bình Trọng)", BẮT BUỘC truyền "Mì Quảng Bà Mua (Trần Bình Trọng)").
     + \`dayNumber\`: Tra cứu trong "LỊCH TRÌNH HIỆN TẠI CỦA CHUYẾN ĐI" ở trên xem địa điểm cũ đó nằm ở Ngày mấy (1, 2, 3...) và truyền đúng số ngày đó.
     + \`query\`: Tên chính xác của địa điểm mới mà người dùng chọn (Ví dụ: "Hải Sản Năm Đảnh (Trần Quang Khải)").
2. RANH GIỚI VAI TRÒ (OFF-TOPIC GUARDRAIL):
   - Bạn CHỈ hỗ trợ các câu hỏi liên quan đến chuyến đi, lịch trình, ẩm thực, văn hóa, thời tiết, di chuyển tại "${itinerary.destination}".
   - NẾU người dùng hỏi các chủ đề ngoài lề (lập trình, giải bài tập, giải toán, chính trị, triết học...):
     Hãy TỪ CHỐI LỊCH THIỆP trong 1 câu ngắn gọn và KHÉO LÉO KÉO VỀ CHUYẾN ĐI.
     Ví dụ: "Genie là trợ lý du lịch chuyên trách cho chuyến đi ${itinerary.destination} nên không thể hỗ trợ viết code/giải toán được rồi! Quay lại lịch trình nhé: Bạn có muốn Genie gợi ý quán ăn tối hay tối ưu lại cung đường không?"
3. ĐIỀU CHỈNH LỊCH TRÌNH (TOOL CALLING):
   - Khi người dùng muốn đổi quán/đổi điểm $\\rightarrow$ GỌI TOOL \`swap_activity\`.
   - Khi người dùng muốn thêm điểm mới $\\rightarrow$ GỌI TOOL \`add_activity\`.
   - Khi người dùng muốn xóa điểm $\\rightarrow$ GỌI TOOL \`remove_activity\`.
   - Khi người dùng muốn dời điểm sang ngày khác $\\rightarrow$ GỌI TOOL \`move_activity\`.
   - Khi người dùng muốn đổi thứ tự giữa 2 ngày $\\rightarrow$ GỌI TOOL \`swap_days\`.
   - TUYỆT ĐỐI KHÔNG tự nói rằng bạn đã sửa lịch trình nếu bạn chưa gọi Function Tool tương ứng.
4. YÊU CẦU MƠ HỒ (CLARIFICATION):
   - Nếu người dùng nói "Đổi quán ăn đi" mà không rõ bữa trưa hay tối ngày nào, hãy hỏi lại 1 câu ngắn để xác nhận.
5. ĐỔI TỈNH THÀNH:
   - Nếu người dùng muốn đổi sang tỉnh thành khác (ví dụ từ ${itinerary.destination} sang Phú Quốc), hãy giải thích rằng cần tạo chuyến đi mới để tính toán lại toàn bộ phương tiện và địa danh.
6. PHONG CÁCH:
   - Nói tiếng Việt tự nhiên, ngắn gọn, nhiệt tình và thực tế.`;
  }

  private buildGeminiContents(
    history: Array<{ sender: string; content: string | null }>,
    currentMessage: string,
  ) {
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const h of history) {
      if (!h.content) continue;
      contents.push({
        role: h.sender === 'USER' ? 'user' : 'model',
        parts: [{ text: h.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: currentMessage }],
    });

    return contents;
  }
}
