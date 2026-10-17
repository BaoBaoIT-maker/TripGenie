import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../database/prisma.service';
import { CopilotAgentService } from '../itineraries/copilot/copilot-agent.service';
import { AdvisorToolsService } from './advisor-tools.service';
import {
  ADVISOR_CONSTANTS,
  ADVISOR_FALLBACK_MESSAGES,
  ADVISOR_FUNCTION_DECLARATIONS,
  getAdvisorSystemPrompt,
  getFormattedCurrentTemporalContext,
} from './advisor.constants';
import {
  AdvisorChatDto,
  AdvisorChatResponse,
  AdvisorCitation,
  AdvisorMessageHistoryItem,
  AdvisorPlaceSummary,
  AdvisorSessionSummary,
} from './advisor.types';

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface PersistedAdvisorMetadata {
  places?: AdvisorPlaceSummary[];
  citations?: AdvisorCitation[];
}

interface CachedAdvisorAnswer {
  reply: string;
  places: AdvisorPlaceSummary[];
  citations: AdvisorCitation[];
  expiresAt: number;
}

@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly baseUrl: string;
  private readonly httpClient: AxiosInstance;

  // ponytail: Bounded in-memory LRU Map for context-free initial queries (ceiling: single Render container RAM ~200KB for 100 entries; upgrade path: Redis cache when upgraded to paid Redis tier).
  private readonly initialQueryCache = new Map<string, CachedAdvisorAnswer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly advisorTools: AdvisorToolsService,
    @Optional()
    private readonly copilotAgent?: CopilotAgentService,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      ADVISOR_CONSTANTS.DEFAULT_MODEL,
    );
    this.baseUrl = this.configService.get<string>(
      'GEMINI_BASE_URL',
      ADVISOR_CONSTANTS.GEMINI_BASE_URL,
    );
    this.httpClient = axios.create({
      timeout: ADVISOR_CONSTANTS.API_TIMEOUT_MS,
    });
  }

  /**
   * Executes the Agentic RAG multi-turn ReAct conversation loop with Circuit Breaker protection,
   * Observation Masking, Bounded LRU Cache for initial queries, and BullMQ Delta Summarization.
   */
  async chat(
    dto: AdvisorChatDto,
    userId?: string,
  ): Promise<AdvisorChatResponse> {
    const cleanMessage = dto.message.trim();
    const session = await this.resolveSession(
      cleanMessage,
      userId,
      dto.sessionId,
    );

    // 1. Load sliding-window history before persisting the new user message
    const recentRows = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: ADVISOR_CONSTANTS.SLIDING_WINDOW_SIZE,
    });
    const historyRows = recentRows.reverse();

    // 2. Persist incoming user message
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'USER',
        content: cleanMessage,
      },
    });

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is missing in AdvisorService.');
      return {
        sessionId: session.id,
        reply: ADVISOR_FALLBACK_MESSAGES.MISSING_API_KEY,
        places: [],
        citations: [],
      };
    }

    const isInitialTurn = historyRows.length === 0 && !session.summary;
    const cachedHit = isInitialTurn
      ? this.getCachedInitialAnswer(cleanMessage)
      : undefined;

    let finalReply = '';
    let places: AdvisorPlaceSummary[] = [];
    let citations: AdvisorCitation[] = [];
    const executedToolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
    }> = [];

    if (cachedHit) {
      this.logger.debug(
        `[Advisor LRU Cache Hit] Serving initial query from RAM for session ${session.id}`,
      );
      finalReply = cachedHit.reply;
      places = cachedHit.places;
      citations = cachedHit.citations;
    } else {
      // 3. Build temporal-anchored System Prompt (with long-term session.summary) & conversation contents
      const { currentDate, dayOfWeek } = getFormattedCurrentTemporalContext();
      const systemInstruction = getAdvisorSystemPrompt(
        currentDate,
        dayOfWeek,
        session.summary,
      );
      const contents: GeminiContent[] = this.buildGeminiContents(
        historyRows,
        cleanMessage,
      );

      const modelPath = this.modelName.startsWith('models/')
        ? this.modelName
        : `models/${this.modelName}`;
      const url = `${this.baseUrl}/${modelPath}:generateContent?key=${this.apiKey}`;

      const collectedPlacesMap = new Map<string, AdvisorPlaceSummary>();
      const collectedCitationsMap = new Map<string, AdvisorCitation>();
      let turnCount = 0;
      let hadNetworkError = false;

      try {
        while (turnCount < ADVISOR_CONSTANTS.MAX_TOOL_TURNS) {
          const response = await this.httpClient.post(url, {
            contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            tools: [{ functionDeclarations: ADVISOR_FUNCTION_DECLARATIONS }],
            generationConfig: {
              temperature: ADVISOR_CONSTANTS.TEMPERATURE,
            },
          });

          const candidateParts: GeminiPart[] =
            response.data?.candidates?.[0]?.content?.parts || [];
          const functionCallParts = candidateParts.filter(
            (part) => part.functionCall && part.functionCall.name,
          );

          // Early break when Gemini produces a final text answer without tool calls
          if (functionCallParts.length === 0) {
            finalReply = candidateParts
              .map((part) => part.text || '')
              .join('\n')
              .trim();
            break;
          }

          // Append the model's functionCall request turn to contents
          contents.push({
            role: 'model',
            parts: candidateParts,
          });

          // Execute all requested tool calls concurrently via Promise.all
          const currentTurnNumber = turnCount + 1;
          const toolExecutions = await Promise.all(
            functionCallParts.map(async (part) => {
              const call = part.functionCall!;
              const args = call.args || {};
              this.logger.log(
                `[Advisor Turn ${currentTurnNumber}] Executing tool "${call.name}" with args: ${JSON.stringify(args)}`,
              );
              const outcome = await this.advisorTools.executeTool(
                call.name,
                args,
              );
              return { callName: call.name, args, outcome };
            }),
          );

          const functionResponseParts: GeminiPart[] = [];
          for (const { callName, args, outcome } of toolExecutions) {
            executedToolCalls.push({ name: callName, args });

            for (const place of outcome.discoveredPlaces) {
              collectedPlacesMap.set(place.id, place);
            }
            for (const citation of outcome.discoveredCitations) {
              const key = `${citation.documentTitle}::${citation.breadcrumbs}`;
              if (!collectedCitationsMap.has(key)) {
                collectedCitationsMap.set(key, citation);
              }
            }

            functionResponseParts.push({
              functionResponse: {
                name: callName,
                response: outcome.toolResponsePayload,
              },
            });
          }

          // Feed functionResponse back to Gemini for the next reasoning step
          contents.push({
            role: 'user',
            parts: functionResponseParts,
          });

          turnCount++;
        }

        // Circuit Breaker: If MAX_TOOL_TURNS was reached and Gemini still hasn't produced text,
        // force a final synthesis call WITHOUT tool declarations.
        if (!finalReply && turnCount >= ADVISOR_CONSTANTS.MAX_TOOL_TURNS) {
          this.logger.warn(
            `Advisor Circuit Breaker triggered after ${turnCount} tool turns for session ${session.id}. Forcing final synthesis.`,
          );
          const synthesisResponse = await this.httpClient.post(url, {
            contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              temperature: ADVISOR_CONSTANTS.TEMPERATURE,
            },
          });

          const synthesisParts: GeminiPart[] =
            synthesisResponse.data?.candidates?.[0]?.content?.parts || [];
          finalReply =
            synthesisParts
              .map((part) => part.text || '')
              .join('\n')
              .trim() || ADVISOR_FALLBACK_MESSAGES.CIRCUIT_BREAKER_TRIGGERED;
        }

        if (!finalReply) {
          finalReply = ADVISOR_FALLBACK_MESSAGES.CIRCUIT_BREAKER_TRIGGERED;
        }
      } catch (error) {
        hadNetworkError = true;
        const err = error as Error;
        this.logger.error(
          `Advisor Gemini API Error: ${err.message}`,
          err.stack,
        );
        finalReply = ADVISOR_FALLBACK_MESSAGES.NETWORK_ERROR;
      }

      places = Array.from(collectedPlacesMap.values());
      citations = Array.from(collectedCitationsMap.values());

      if (isInitialTurn && !hadNetworkError && finalReply) {
        this.setCachedInitialAnswer(cleanMessage, {
          reply: finalReply,
          places,
          citations,
          expiresAt: Date.now() + ADVISOR_CONSTANTS.LRU_CACHE_TTL_MS,
        });
      }
    }

    const metadataPayload: PersistedAdvisorMetadata = {
      places: places.length > 0 ? places : undefined,
      citations: citations.length > 0 ? citations : undefined,
    };

    // 4. Persist Agent response with discovered places & citations metadata (Single DRY exit path)
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'AGENT',
        content: finalReply,
        modelName: this.modelName,
        toolCalls:
          executedToolCalls.length > 0
            ? (JSON.parse(
                JSON.stringify(executedToolCalls),
              ) as Prisma.InputJsonValue)
            : undefined,
        toolResults:
          places.length > 0 || citations.length > 0
            ? (JSON.parse(
                JSON.stringify(metadataPayload),
              ) as Prisma.InputJsonValue)
            : undefined,
      },
    });

    await this.prisma.aiChatSession.update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 2 },
      },
    });

    // 5. Reuse existing CopilotAgentService BullMQ delta-summarization engine when threshold is reached (AGENTS.md Rung 2)
    if (
      this.copilotAgent &&
      session.messageCount + 2 >= ADVISOR_CONSTANTS.SUMMARIZATION_THRESHOLD
    ) {
      this.copilotAgent
        .enqueueSessionSummarization(session.id)
        .catch((err: Error) =>
          this.logger.warn(
            `Advisor background summarization warning: ${err.message}`,
          ),
        );
    }

    return {
      sessionId: session.id,
      reply: finalReply,
      places,
      citations,
    };
  }

  /**
   * Lists recent general AI Advisor sessions (linkedItineraryId IS NULL) for the user.
   */
  async getUserSessions(userId?: string): Promise<AdvisorSessionSummary[]> {
    if (!userId) {
      return [];
    }

    const sessions = await this.prisma.aiChatSession.findMany({
      where: {
        userId,
        linkedItineraryId: null,
        NOT: { contextCity: ADVISOR_CONSTANTS.GUEST_SESSION_MARKER },
      },
      orderBy: { createdAt: 'desc' },
      take: ADVISOR_CONSTANTS.MAX_SESSIONS_LIST,
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title || ADVISOR_CONSTANTS.DEFAULT_SESSION_TITLE,
      messageCount: s.messageCount,
      updatedAt: s.createdAt,
    }));
  }

  /**
   * Retrieves chronological message history (including saved place cards & citations) for a session.
   */
  async getSessionMessages(
    sessionId: string,
    userId?: string,
  ): Promise<AdvisorMessageHistoryItem[]> {
    const session = await this.prisma.aiChatSession.findFirst({
      where: {
        id: sessionId,
        linkedItineraryId: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên trò chuyện.');
    }

    this.assertSessionOwnership(session, userId);

    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: ADVISOR_CONSTANTS.MAX_HISTORY_MESSAGES,
    });

    return messages.map((msg) => {
      const metadata = (msg.toolResults || {}) as PersistedAdvisorMetadata;
      return {
        id: msg.id,
        sender: msg.sender === 'USER' ? 'user' : 'agent',
        content: msg.content || '',
        places: Array.isArray(metadata.places) ? metadata.places : undefined,
        citations: Array.isArray(metadata.citations)
          ? metadata.citations
          : undefined,
        createdAt: msg.createdAt,
      };
    });
  }

  /**
   * Deletes an Advisor chat session and its cascaded messages.
   */
  async deleteSession(
    sessionId: string,
    userId?: string,
  ): Promise<{ deleted: boolean }> {
    const session = await this.prisma.aiChatSession.findFirst({
      where: {
        id: sessionId,
        linkedItineraryId: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên trò chuyện để xóa.');
    }

    this.assertSessionOwnership(session, userId);

    await this.prisma.aiChatSession.delete({
      where: { id: session.id },
    });

    return { deleted: true };
  }

  private assertSessionOwnership(
    session: { userId: string; contextCity?: string | null },
    userId?: string,
  ): void {
    const isGuestSession =
      session.contextCity === ADVISOR_CONSTANTS.GUEST_SESSION_MARKER;
    if (!isGuestSession && session.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập phiên trò chuyện này.',
      );
    }
  }

  private async resolveSession(
    firstMessage: string,
    userId?: string,
    sessionId?: string,
  ) {
    if (sessionId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: {
          id: sessionId,
          linkedItineraryId: null,
        },
      });
      if (existing) {
        const isGuestSession =
          existing.contextCity === ADVISOR_CONSTANTS.GUEST_SESSION_MARKER;
        if (isGuestSession || existing.userId === userId) {
          return existing;
        }
      }
    }

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const fallbackUser = await this.prisma.user.findFirst({
        select: { id: true },
      });
      effectiveUserId =
        fallbackUser?.id || ADVISOR_CONSTANTS.GUEST_FALLBACK_USER_ID;
    }

    const maxLen = ADVISOR_CONSTANTS.SESSION_TITLE_MAX_LENGTH;
    const derivedTitle =
      firstMessage.length > maxLen
        ? `${firstMessage.slice(0, maxLen - 3)}...`
        : firstMessage || ADVISOR_CONSTANTS.DEFAULT_SESSION_TITLE;

    return this.prisma.aiChatSession.create({
      data: {
        userId: effectiveUserId,
        linkedItineraryId: null,
        title: derivedTitle,
        contextCity: userId
          ? ADVISOR_CONSTANTS.DEFAULT_CONTEXT_CITY
          : ADVISOR_CONSTANTS.GUEST_SESSION_MARKER,
      },
    });
  }

  /**
   * Builds Gemini conversation history with Observation Masking:
   * Raw intermediate tool JSONs are omitted, while discovered placeIds are appended
   * as a compact reference line so follow-up turns can call `get_place_detail(placeId)`.
   */
  private buildGeminiContents(
    history: Array<{
      sender: string;
      content: string | null;
      toolResults?: Prisma.JsonValue;
    }>,
    currentMessage: string,
  ): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const row of history) {
      if (!row.content) continue;

      let text = row.content;
      if (row.sender === 'AGENT' && row.toolResults) {
        const meta = row.toolResults as PersistedAdvisorMetadata;
        if (Array.isArray(meta.places) && meta.places.length > 0) {
          const placeRefs = meta.places
            .map((p) => `${p.name} (placeId: ${p.id})`)
            .join(', ');
          text = `${text}\n[Mã địa điểm đã gợi ý: ${placeRefs}]`;
        }
      }

      contents.push({
        role: row.sender === 'USER' ? 'user' : 'model',
        parts: [{ text }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: currentMessage }],
    });

    return contents;
  }

  private normalizeCacheKey(message: string): string {
    return message
      .toLowerCase()
      .replace(/[?!.,;:\s]+/g, ' ')
      .trim();
  }

  private getCachedInitialAnswer(
    message: string,
  ): CachedAdvisorAnswer | undefined {
    const key = this.normalizeCacheKey(message);
    const entry = this.initialQueryCache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.initialQueryCache.delete(key);
      return undefined;
    }

    // Refresh insertion order for true LRU behavior
    this.initialQueryCache.delete(key);
    this.initialQueryCache.set(key, entry);
    return entry;
  }

  private setCachedInitialAnswer(
    message: string,
    value: CachedAdvisorAnswer,
  ): void {
    const key = this.normalizeCacheKey(message);
    if (this.initialQueryCache.has(key)) {
      this.initialQueryCache.delete(key);
    } else if (
      this.initialQueryCache.size >= ADVISOR_CONSTANTS.LRU_CACHE_MAX_ENTRIES
    ) {
      const oldestKey = this.initialQueryCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.initialQueryCache.delete(oldestKey);
      }
    }
    this.initialQueryCache.set(key, value);
  }
}
