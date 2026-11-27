import {
  BadRequestException,
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
import { AppLocale, DEFAULT_LOCALE } from '../../../common/i18n/locale.util';
import { t } from '../../../common/i18n/t.util';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { ItineraryAccessService } from '../services/itinerary-access.service';
import { TransitService } from '../services/transit.service';
import {
  WeatherService,
  resolveItineraryCoordinates,
} from '../../weather/weather.service';
import { WEATHER_THRESHOLDS } from '../../weather/weather.constants';
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
  MutatingCopilotToolName,
  isMutatingCopilotTool,
} from './copilot.types';

type CopilotToolHandler = (
  itineraryId: string,
  args: Record<string, unknown>,
  dryRun: boolean,
  locale?: AppLocale,
) => Promise<CopilotToolExecutionResult>;

const PROPOSAL_TITLE_BUILDERS: Record<
  MutatingCopilotToolName,
  (locale: AppLocale, data?: Record<string, unknown>) => string
> = {
  [COPILOT_TOOL_NAMES.SWAP_ACTIVITY]: (locale, data) =>
    data?.dayNumber
      ? t(locale, 'copilot.proposals.swapActivityDay', {
          day: String(data.dayNumber),
        })
      : t(locale, 'copilot.proposals.swapActivity'),
  [COPILOT_TOOL_NAMES.SWAP_DAYS]: (locale, data) =>
    data?.dayA && data?.dayB
      ? t(locale, 'copilot.proposals.swapDaysRange', {
          dayA: String(data.dayA),
          dayB: String(data.dayB),
        })
      : t(locale, 'copilot.proposals.swapDays'),
  [COPILOT_TOOL_NAMES.ADD_ACTIVITY]: (locale, data) =>
    data?.dayNumber
      ? t(locale, 'copilot.proposals.addActivityDay', {
          day: String(data.dayNumber),
        })
      : t(locale, 'copilot.proposals.addActivity'),
  [COPILOT_TOOL_NAMES.REMOVE_ACTIVITY]: (locale, data) =>
    data?.dayNumber
      ? t(locale, 'copilot.proposals.removeActivityDay', {
          day: String(data.dayNumber),
        })
      : t(locale, 'copilot.proposals.removeActivity'),
  [COPILOT_TOOL_NAMES.MOVE_ACTIVITY]: (locale) =>
    t(locale, 'copilot.proposals.moveActivity'),
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
    @Optional() private readonly weatherService?: WeatherService,
    @Optional() private readonly transitService?: TransitService,
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
    this.httpClient = axios.create({
      timeout: COPILOT_CONSTANTS.API_TIMEOUT_MS,
    });

    // Strategy/Dispatcher map: Open/Closed Principle (OCP) without switch/if-else chains
    this.toolHandlers = {
      [COPILOT_TOOL_NAMES.SEARCH_PLACES]: (
        itineraryId,
        args,
        _dryRun,
        locale,
      ) =>
        this.toolsService.searchPlacesForItinerary(
          itineraryId,
          {
            query: args.query ? String(args.query) : undefined,
            categorySlug: args.categorySlug
              ? String(args.categorySlug)
              : undefined,
            budgetLevel: args.budgetLevel
              ? String(args.budgetLevel)
              : undefined,
            nearPlaceName: args.nearPlaceName
              ? String(args.nearPlaceName)
              : undefined,
            radiusKm:
              args.radiusKm !== undefined ? Number(args.radiusKm) : undefined,
            minRating:
              args.minRating !== undefined ? Number(args.minRating) : undefined,
            limit: args.limit !== undefined ? Number(args.limit) : undefined,
          },
          locale,
        ),
      [COPILOT_TOOL_NAMES.CHANGE_DESTINATION]: async (
        _itineraryId,
        args,
        _dryRun,
        locale = DEFAULT_LOCALE,
      ) => {
        const dest = String(
          args.newDestination ||
            t(locale, 'copilot.changeDestinationFallback'),
        );
        return {
          toolName: COPILOT_TOOL_NAMES.CHANGE_DESTINATION,
          success: false,
          message: t(locale, 'copilot.changeDestinationMessage', { dest }),
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
          currentPlaceName: args.currentPlaceName
            ? String(args.currentPlaceName)
            : undefined,
          mealOrActivityType: args.mealOrActivityType
            ? String(args.mealOrActivityType)
            : undefined,
          query: String(args.query || 'địa điểm tương đương'),
          categorySlug: args.categorySlug
            ? String(args.categorySlug)
            : undefined,
          destinationId: args.destinationId
            ? String(args.destinationId)
            : undefined,
          newPlaceId: args.newPlaceId ? String(args.newPlaceId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.ADD_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.addActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          timeSlot: args.timeSlot ? String(args.timeSlot) : undefined,
          query: String(args.query || 'điểm tham quan'),
          categorySlug: args.categorySlug
            ? String(args.categorySlug)
            : undefined,
          placeId: args.placeId ? String(args.placeId) : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.REMOVE_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.removeActivity(itineraryId, {
          dayNumber: Number(args.dayNumber || 1),
          placeName: String(args.placeName || ''),
          destinationId: args.destinationId
            ? String(args.destinationId)
            : undefined,
          dryRun,
        }),
      [COPILOT_TOOL_NAMES.MOVE_ACTIVITY]: (itineraryId, args, dryRun) =>
        this.toolsService.moveActivity(itineraryId, {
          placeName: String(args.placeName || ''),
          fromDay: Number(args.fromDay || 1),
          toDay: Number(args.toDay || 2),
          targetTimeSlot: args.targetTimeSlot
            ? String(args.targetTimeSlot)
            : undefined,
          destinationId: args.destinationId
            ? String(args.destinationId)
            : undefined,
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
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<CopilotChatResponse> {
    const cleanMessage = userMessage.trim();
    const itinerary = await this.prisma.itinerary.findFirst({
      where: { id: itineraryId, deletedAt: null },
      include: {
        area: {
          select: {
            bboxMinLat: true,
            bboxMaxLat: true,
            bboxMinLng: true,
            bboxMaxLng: true,
          },
        },
        destinations: {
          include: { place: { include: { category: true } } },
          orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
        },
      },
    });

    if (!itinerary) {
      throw new NotFoundException('Không tìm thấy lịch trình du lịch.');
    }

    const access = await this.accessService.assertIsGroupMember(
      itineraryId,
      userId,
    );

    // 1. Resolve / Create Chat Session
    const session = await this.resolveSession(
      itineraryId,
      itinerary.creatorId,
      userId,
      sessionId,
      itinerary.destination,
    );

    // 2. Fetch recent conversation history using Sliding Window before persisting the turn
    const recentRows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: COPILOT_CONSTANTS.SLIDING_WINDOW_SIZE,
    });
    const historyRows = recentRows.reverse();

    // 3. Build prompt context (schedule + weather + session memory) without static place stuffing
    const coords =
      resolveItineraryCoordinates(itinerary) ??
      (this.transitService && itinerary.destination
        ? await this.transitService.resolveCityLocation(itinerary.destination)
        : null);
    const spanDays =
      itinerary.startDate && itinerary.endDate
        ? Math.round(
            (itinerary.endDate.getTime() - itinerary.startDate.getTime()) /
              WEATHER_THRESHOLDS.MS_PER_DAY,
          ) + 1
        : 0;
    const maxDay = itinerary.destinations.reduce(
      (m, d) => Math.max(m, d.dayNumber),
      1,
    );
    const weatherSummary = this.weatherService
      ? await this.weatherService.getTripWeather({
          lat: coords?.lat,
          lng: coords?.lng,
          destination: itinerary.destination,
          startDate: itinerary.startDate,
          totalDays: Math.max(spanDays, maxDay, 1),
          locale,
        })
      : null;

    const systemInstruction = this.buildSystemInstruction({
      destination:
        itinerary.destination || COPILOT_CONSTANTS.DEFAULT_DESTINATION,
      partySize: itinerary.partySize ?? 1,
      destinations: itinerary.destinations,
      sessionSummary: session.summary,
      weatherGuidance: weatherSummary?.guidance,
      locale,
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
    let executedToolCall: CopilotChatResponse['appliedTool'] = undefined;
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
        // ponytail: Single-step tool execution caps latency at 2 LLM calls;
        // upgrade to bounded multi-turn loop (like AdvisorService) if compound multi-tool commands are requested.
        const toolName = functionCall.name;
        const toolArgs = functionCall.args || {};
        this.logger.log(
          `Gemini invoked tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`,
        );

        const isModifyingTool = isMutatingCopilotTool(toolName);
        const isSearchTool = toolName === COPILOT_TOOL_NAMES.SEARCH_PLACES;
        // VIEWER group members can ask Copilot for suggestions strictly in dry-run proposal mode,
        // while OWNER / EDITOR may also opt into autoApply=true direct mutations.
        const canDirectMutate = isModifyingTool && autoApply && access.canEdit;
        const shouldDryRun = isModifyingTool && !canDirectMutate;

        const toolResult = await this.executeTool(
          itineraryId,
          toolName,
          toolArgs,
          shouldDryRun,
          locale,
        );
        executedToolCall = {
          name: toolName,
          args: toolArgs,
          resultMessage: toolResult.message,
        };
        appliedTool = isSearchTool ? undefined : executedToolCall;

        if (toolResult.data?.action) {
          action = toolResult.data.action as CopilotChatResponse['action'];
        }

        if (isSearchTool) {
          modified = false;
        } else if (shouldDryRun && toolResult.success) {
          modified = false;
          proposal = {
            id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            toolName,
            title: this.getProposalTitle(toolName, toolResult.data, locale),
            description: toolResult.message,
            dayNumber: toolResult.data?.dayNumber as number | undefined,
            fromPlaceId: toolResult.data?.oldPlaceId as string | undefined,
            fromPlaceName: toolResult.data?.oldPlaceName as string | undefined,
            fromPlaceCoordinates: toolResult.data?.oldPlaceCoordinates as
              | { latitude: number; longitude: number }
              | undefined,
            toPlaceId: (toolResult.data?.newPlaceId ||
              toolResult.data?.placeId) as string | undefined,
            toPlaceName: (toolResult.data?.newPlaceName ||
              toolResult.data?.placeName) as string | undefined,
            toPlaceRating: toolResult.data?.newPlaceRating as
              | number
              | undefined,
            toPlaceCategory: toolResult.data?.newPlaceCategory as
              | string
              | undefined,
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
            args: (toolResult.data?.args || toolArgs) as Record<
              string,
              unknown
            >,
          };
        } else {
          modified = isModifyingTool && toolResult.success;
        }

        const functionResponsePayload = isSearchTool
          ? {
              status: toolResult.data?.status ?? 'NO_MATCH',
              mode: 'READ_ONLY_SEARCH',
              ...(toolResult.data?.anchorName
                ? {
                    anchorName: toolResult.data.anchorName,
                    radiusKm: toolResult.data.radiusKm,
                  }
                : {}),
              places: toolResult.data?.places ?? [],
              instruction: `Read-only search completed. Recommend ONLY exact place names from \`places\` above (never invent or guess external places). When \`distanceKm\` is present, briefly mention the distance from \`anchorName\`. Format 2+ recommendations cleanly as numbered lines "1. **Exact Place Name** - brief reason" so the UI renders interactive cards. If \`status\` is "ANCHOR_NOT_FOUND", honestly tell the user the reference location was not found in this trip area. If \`places\` is empty, honestly tell the user no matching place was found in TripGenie's database for this area. Follow the OUTPUT LANGUAGE & TONE rule (${locale === 'en' ? 'English' : 'Vietnamese'}).`,
            }
          : {
              status: toolResult.success ? 'SUCCESS' : 'FAILED',
              mode: shouldDryRun ? 'PROPOSAL_DRY_RUN' : 'APPLIED',
              resultMessage: toolResult.message,
              oldPlaceName: proposal?.fromPlaceName,
              proposedPlaceName: proposal?.toPlaceName,
              instruction: shouldDryRun
                ? `This is a PROPOSAL only (not yet applied to the itinerary). You MUST mention the exact proposed place name from resultMessage ("${proposal?.toPlaceName || ''}"), never invent another place name, and invite the user to click the Apply button below. Follow the OUTPUT LANGUAGE & TONE rule (${locale === 'en' ? 'English' : 'Vietnamese'}).`
                : `The itinerary update succeeded. Respond concisely, warmly, and naturally following the OUTPUT LANGUAGE & TONE rule (${locale === 'en' ? 'English' : 'Vietnamese'}).`,
            };

        const searchFallbackReply = isSearchTool
          ? this.formatSearchPlacesFallback(toolResult.data, locale)
          : null;

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
                      response: functionResponsePayload,
                    },
                  },
                ],
              },
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
              temperature: COPILOT_CONSTANTS.SYNTHESIS_TEMPERATURE,
            },
          });
          const secondParts: GeminiPart[] =
            secondResponse.data?.candidates?.[0]?.content?.parts || [];
          agentReply =
            secondParts
              .filter((p) => p.text)
              .map((p) => p.text)
              .join('\n')
              .trim() ||
            searchFallbackReply ||
            toolResult.message;
        } catch (synthErr) {
          this.logger.warn(
            `Copilot second-turn synthesis fallback: ${(synthErr as Error).message}`,
          );
          agentReply = searchFallbackReply || toolResult.message;
        }
      } else {
        // --- DIRECT TEXT PATH (Q&A / Guardrails) ---
        agentReply =
          candidateParts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join('\n')
            .trim() || t(locale, 'copilot.fallbackDirectReply');
      }
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Gemini Copilot Error: ${e.message}`, e.stack);
      agentReply = t(locale, 'copilot.fallbackError');
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
          toolCalls: executedToolCall
            ? JSON.parse(JSON.stringify(executedToolCall))
            : undefined,
          toolResults: proposal
            ? JSON.parse(JSON.stringify(proposal))
            : undefined,
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
        this.logger.warn(
          `Enqueue summarization error: ${(err as Error).message}`,
        ),
      );
    }

    // 6. If modified, fetch the fresh updated itinerary detail
    let updatedItinerary: unknown = undefined;
    if (modified) {
      try {
        updatedItinerary = await this.plannerService.getById(
          itineraryId,
          userId,
        );
      } catch (err) {
        this.logger.warn(
          `Could not refresh itinerary detail: ${(err as Error).message}`,
        );
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
    await this.accessService.assertIsGroupMember(itineraryId, userId);

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

    if (!isMutatingCopilotTool(toolName)) {
      throw new BadRequestException(
        t(DEFAULT_LOCALE, 'copilot.invalidProposalTool', { toolName }),
      );
    }

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
        this.logger.debug(
          `Enqueued summarization job for session ${sessionId} to BullMQ`,
        );
        return;
      }
    } catch (err) {
      this.logger.warn(
        `Could not enqueue to BullMQ (${(err as Error).message}), falling back to direct async`,
      );
    }

    this.summarizeSession(sessionId).catch((err) =>
      this.logger.warn(
        `Direct background summarization error: ${(err as Error).message}`,
      ),
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
      ? eligibleMessages.findIndex(
          (m) => m.id === session.lastSummarizedMessageId,
        )
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

    const prompt = `You are a travel memory assistant. Below is the conversation between the traveler and the trip assistant:${
      session.summary ? `\n[Previous summary]:\n${session.summary}\n` : ''
    }\n[New exchanges]:\n${deltaTranscript}\n\nUpdate and summarize concisely in 2-3 neutral English sentences or bullets capturing:
1. Traveler preferences, dietary restrictions, companions, and budget constraints (keep exact Vietnamese place names as-is).
2. Confirmed itinerary decisions or edits already agreed upon.
Return ONLY the concise summary with no greeting or preamble.`;

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
      this.logger.warn(
        `Could not summarize session ${sessionId}: ${(err as Error).message}`,
      );
    }

    return session.summary;
  }

  // ===========================================================================
  // PRIVATE AGENT LOGIC (OCP Dispatcher)
  // ===========================================================================

  private getProposalTitle(
    toolName: string,
    data?: Record<string, unknown>,
    locale: AppLocale = DEFAULT_LOCALE,
  ): string {
    if (!isMutatingCopilotTool(toolName)) {
      return t(locale, 'copilot.proposals.default');
    }
    return PROPOSAL_TITLE_BUILDERS[toolName](locale, data);
  }

  private async executeTool(
    itineraryId: string,
    toolName: string,
    args: Record<string, unknown>,
    dryRun: boolean = false,
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<CopilotToolExecutionResult> {
    const handler = this.toolHandlers[toolName as CopilotToolName];
    if (!handler) {
      return {
        toolName,
        success: false,
        message: t(locale, 'copilot.unsupportedTool', { toolName }),
      };
    }
    return handler(itineraryId, args, dryRun, locale);
  }

  private formatSearchPlacesFallback(
    data: Record<string, unknown> | undefined,
    locale: AppLocale = DEFAULT_LOCALE,
  ): string | null {
    const rawPlaces = Array.isArray(data?.places) ? data.places : [];
    if (rawPlaces.length === 0) return null;

    const anchorName =
      typeof data?.anchorName === 'string' ? data.anchorName : undefined;
    const header = t(locale, 'copilot.searchFallbackHeader');
    const lines = rawPlaces
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object',
      )
      .map((p, idx) => {
        const name = String(p.name || '').trim();
        if (!name) return '';
        const parts: string[] = [];
        if (typeof p.category === 'string' && p.category.trim()) {
          parts.push(p.category.trim());
        }
        if (typeof p.rating === 'number' && p.rating > 0) {
          parts.push(`★ ${p.rating}`);
        }
        if (typeof p.distanceKm === 'number' && anchorName) {
          parts.push(
            t(locale, 'copilot.searchDistanceLabel', {
              anchor: anchorName,
              km: String(p.distanceKm),
            }),
          );
        }
        if (typeof p.address === 'string' && p.address.trim()) {
          parts.push(p.address.trim());
        }
        const suffix = parts.length > 0 ? ` - ${parts.join(', ')}` : '';
        return `${idx + 1}. **${name}**${suffix}`;
      })
      .filter(Boolean);

    return lines.length > 0 ? `${header}\n${lines.join('\n')}` : null;
  }

  private async resolveSession(
    itineraryId: string,
    creatorId: string,
    userId?: string,
    sessionId?: string,
    destination?: string | null,
  ) {
    const effectiveUserId = userId || creatorId;

    if (sessionId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: {
          id: sessionId,
          linkedItineraryId: itineraryId,
          userId: effectiveUserId,
        },
      });
      if (existing) return existing;
    }

    const latest = await this.prisma.aiChatSession.findFirst({
      where: { linkedItineraryId: itineraryId, userId: effectiveUserId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) return latest;

    return this.prisma.aiChatSession.create({
      data: {
        userId: effectiveUserId,
        linkedItineraryId: itineraryId,
        title: COPILOT_CONSTANTS.DEFAULT_SESSION_TITLE,
        contextCity: destination || COPILOT_CONSTANTS.DEFAULT_DESTINATION,
      },
    });
  }

  private buildSystemInstruction(itinerary: {
    destination: string;
    partySize?: number;
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
    sessionSummary?: string | null;
    weatherGuidance?: string;
    locale?: AppLocale;
  }): string {
    const locale = itinerary.locale ?? DEFAULT_LOCALE;
    const isEn = locale === 'en';
    const dayGroups: Record<number, string[]> = {};
    for (const d of itinerary.destinations) {
      if (!dayGroups[d.dayNumber]) dayGroups[d.dayNumber] = [];
      const timeStr = formatTimeOfDay(d.startTime);
      const cat = isEn
        ? d.place.category?.name || d.place.category?.nameVi || ''
        : d.place.category?.nameVi || d.place.category?.name || '';
      dayGroups[d.dayNumber].push(
        `${timeStr ? `[${timeStr}] ` : ''}${d.place.name}${cat ? ` (${cat})` : ''} - ${d.place.address}`,
      );
    }

    const scheduleSummary = Object.entries(dayGroups)
      .map(([day, items]) => `Day ${day}:\n  - ${items.join('\n  - ')}`)
      .join('\n\n');

    const outputLanguageAndTone = isEn
      ? `OUTPUT LANGUAGE & TONE (UI Locale = English):
   - Respond in warm, natural, concise English (local Vietnam travel companion tone; keep authentic Vietnamese place/dish names).
   - If the user explicitly writes in Vietnamese, respond naturally in Vietnamese.`
      : `OUTPUT LANGUAGE & TONE (UI Locale = Vietnamese):
   - Respond in warm, natural, concise Vietnamese (address the user as "bạn", refer to yourself as "mình" or "Genie"; avoid robotic/translated phrasing).
   - If the user explicitly writes in English, respond naturally in English.`;

    return `You are Genie Copilot — the smart, friendly AI trip assistant inside TripGenie.
You are assisting the traveler on their trip to "${itinerary.destination}" (group size: ${itinerary.partySize ?? 1} traveler(s)).
${itinerary.sessionSummary ? `\nLONG-TERM SESSION MEMORY:\n${itinerary.sessionSummary}\n` : ''}${itinerary.weatherGuidance ? `\n${itinerary.weatherGuidance}\n` : ''}
CURRENT ITINERARY SCHEDULE:
${scheduleSummary || 'No stops scheduled yet.'}

MANDATORY GUARDRAILS & BEHAVIOR RULES:
1. GROUNDING, SEARCH & SWAP RULES (CRITICAL):
   - When the user asks for place recommendations, suggestions, or discovery without committing to an edit yet (e.g., "gợi ý quán chay", "quán cafe yên tĩnh nào đẹp?", "find homestays near the beach"):
     IMMEDIATELY call \`search_places\` to look up verified places in TripGenie's database for "${itinerary.destination}". NEVER invent place names from memory.
   - When the user explicitly asks to swap or add a place/meal (e.g., "swap Day 1 lunch to Bé Mặn seafood", "pick option 1", "change lunch to seafood"):
     IMMEDIATELY call \`swap_activity\` or \`add_activity\` directly (these tools search the full database, so do NOT call \`search_places\` first):
     + \`currentPlaceName\`: exact name of the existing stop in CURRENT ITINERARY SCHEDULE.
     + \`dayNumber\`: day number of that stop (1, 2, 3...).
     + \`query\`: exact place name or category requested by the user.
2. OFF-TOPIC GUARDRAIL:
   - ONLY assist with topics related to this trip, itinerary, dining, culture, weather, and transit in "${itinerary.destination}".
   - For off-topic requests (coding, homework, math, politics, philosophy, etc.): politely refuse in 1 concise sentence and steer back to optimizing the trip in "${itinerary.destination}".
3. ITINERARY MODIFICATION (TOOL CALLING):
   - Swap a stop -> call \`swap_activity\`.
   - Add a new stop -> call \`add_activity\`.
     + DUPLICATE CHECK: If the requested place is ALREADY in CURRENT ITINERARY SCHEDULE, first ask 1 brief confirmation question stating which Day it is already on and whether they want to MOVE it or visit it a second time. Only call \`add_activity\` once confirmed.
   - Remove a stop -> call \`remove_activity\`.
   - Move a stop to another day -> call \`move_activity\`.
   - Swap two full days -> call \`swap_days\`.
   - NEVER claim you modified the itinerary unless you actually called the corresponding tool.
4. CLARIFICATION:
   - If a request is ambiguous (e.g., "Swap the restaurant" without specifying which day/meal), ask 1 brief clarifying question.
5. DESTINATION CHANGE:
   - If the user wants to switch to a different city/province (e.g., from ${itinerary.destination} to Phu Quoc), call \`change_destination\` and explain that a new trip is needed to recalculate routes and intercity transit.
6. ${outputLanguageAndTone}`;
  }
}
