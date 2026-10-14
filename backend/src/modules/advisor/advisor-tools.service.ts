import { Inject, Injectable, Logger } from '@nestjs/common';
import { BudgetLevel } from '@prisma/client';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { PlaceSortBy, SortOrder } from '../../common/enums/places.enum';
import { KnowledgeService } from '../knowledge/knowledge.service';
import type { IKnowledgeRepository } from '../knowledge/knowledge.repository';
import { SearchPlacesDto } from '../places/dto/search-places.dto';
import type {
  IPlaceRepository,
  PlaceDetail,
  PlaceRow,
} from '../places/interfaces/place-repository.interface';
import {
  ADVISOR_CONSTANTS,
  ADVISOR_TOOL_NAMES,
  AdvisorToolName,
} from './advisor.constants';
import {
  AdvisorCitation,
  AdvisorPlaceSummary,
  ToolExecutionOutcome,
} from './advisor.types';

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolExecutionOutcome>;

@Injectable()
export class AdvisorToolsService {
  private readonly logger = new Logger(AdvisorToolsService.name);
  private readonly handlers: Record<AdvisorToolName, ToolHandler>;

  // ponytail: In-memory Map caches immutable travel_areas slug -> id lookups (ceiling: ~63 provinces; upgrade path: Redis cache if areas become dynamically editable at runtime).
  private readonly areaSlugCache = new Map<string, number | null>();

  constructor(
    private readonly knowledgeService: KnowledgeService,
    @Inject(INJECT_TOKENS.KNOWLEDGE_REPOSITORY)
    private readonly knowledgeRepo: IKnowledgeRepository,
    @Inject(INJECT_TOKENS.PLACE_REPOSITORY)
    private readonly placeRepo: IPlaceRepository,
  ) {
    // Strategy/Dispatcher map: Open/Closed Principle (OCP) without switch/if-else chains
    this.handlers = {
      [ADVISOR_TOOL_NAMES.QUERY_TRAVEL_KNOWLEDGE]: (args) =>
        this.handleQueryTravelKnowledge(args),
      [ADVISOR_TOOL_NAMES.SEARCH_PLACES]: (args) =>
        this.handleSearchPlaces(args),
      [ADVISOR_TOOL_NAMES.GET_PLACE_DETAIL]: (args) =>
        this.handleGetPlaceDetail(args),
    };
  }

  /**
   * Dispatches a Gemini functionCall to the appropriate domain tool handler.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolExecutionOutcome> {
    const handler = this.handlers[toolName as AdvisorToolName];
    if (!handler) {
      this.logger.warn(`Unknown advisor tool requested: ${toolName}`);
      return {
        toolResponsePayload: {
          status: 'ERROR',
          message: `Công cụ "${toolName}" không tồn tại trong hệ thống.`,
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }

    try {
      return await handler(args);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error executing advisor tool "${toolName}": ${err.message}`,
        err.stack,
      );
      return {
        toolResponsePayload: {
          status: 'ERROR',
          message: `Không thể truy xuất dữ liệu từ công cụ "${toolName}" lúc này.`,
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }
  }

  /**
   * Tool 1: Queries pgvector knowledge base for curated travel guides, ticket prices,
   * regulations, scam alerts, weather seasons, or TripGenie platform rules.
   * Applies Score-Gap Filtering to prune low-relevance secondary chunks and save LLM tokens.
   */
  private async handleQueryTravelKnowledge(
    args: Record<string, unknown>,
  ): Promise<ToolExecutionOutcome> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const areaSlug =
      typeof args.areaSlug === 'string' ? args.areaSlug.trim() : undefined;

    if (!query) {
      return {
        toolResponsePayload: {
          status: 'EMPTY_QUERY',
          confidence: 'LOW',
          chunks: [],
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }

    const areaId = await this.resolveAreaId(areaSlug);

    const rawChunks = await this.knowledgeService.searchKnowledge(query, {
      areaId,
      limit: ADVISOR_CONSTANTS.DEFAULT_KNOWLEDGE_LIMIT,
      minSimilarity: ADVISOR_CONSTANTS.MIN_KNOWLEDGE_SIMILARITY,
    });

    if (rawChunks.length === 0) {
      return {
        toolResponsePayload: {
          status: 'NO_MATCH',
          confidence: 'LOW',
          note: 'Cẩm nang hiện chưa có dữ liệu khớp với truy vấn này. Tuyệt đối không tự bịa số liệu.',
          chunks: [],
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }

    const topScore = Number(rawChunks[0].similarity_score);
    const overallConfidence: 'HIGH' | 'LOW' =
      topScore >= ADVISOR_CONSTANTS.HIGH_CONFIDENCE_THRESHOLD ? 'HIGH' : 'LOW';

    // Score-Gap Filtering: When top chunk is HIGH confidence, drop noisy tail chunks
    const filteredChunks =
      overallConfidence === 'HIGH'
        ? rawChunks.filter((chunk, index) => {
            if (index === 0) return true;
            const score = Number(chunk.similarity_score);
            return (
              score >= ADVISOR_CONSTANTS.SECONDARY_CHUNK_MIN_SIMILARITY &&
              topScore - score <= ADVISOR_CONSTANTS.SCORE_GAP_MAX_DELTA
            );
          })
        : rawChunks;

    const discoveredCitations: AdvisorCitation[] = filteredChunks.map(
      (chunk) => {
        const score = Number(chunk.similarity_score);
        return {
          documentTitle: chunk.document_title,
          breadcrumbs:
            chunk.metadata?.breadcrumbs ||
            chunk.metadata?.sectionTitle ||
            chunk.document_title,
          confidence:
            score >= ADVISOR_CONSTANTS.HIGH_CONFIDENCE_THRESHOLD
              ? 'HIGH'
              : 'LOW',
          similarityScore: Number(score.toFixed(4)),
        };
      },
    );

    return {
      toolResponsePayload: {
        status: 'SUCCESS',
        confidence: overallConfidence,
        chunks: filteredChunks.map((c) => ({
          documentTitle: c.document_title,
          breadcrumbs:
            c.metadata?.breadcrumbs ||
            c.metadata?.sectionTitle ||
            c.document_title,
          similarityScore: Number(Number(c.similarity_score).toFixed(3)),
          content: c.content,
        })),
      },
      discoveredPlaces: [],
      discoveredCitations,
    };
  }

  /**
   * Tool 2: Searches structured places in PostgreSQL/PostGIS with token-compact serialization.
   */
  private async handleSearchPlaces(
    args: Record<string, unknown>,
  ): Promise<ToolExecutionOutcome> {
    const keyword =
      typeof args.keyword === 'string' ? args.keyword.trim() : undefined;
    const areaSlug =
      typeof args.areaSlug === 'string' ? args.areaSlug.trim() : undefined;
    const categorySlug =
      typeof args.categorySlug === 'string'
        ? args.categorySlug.trim()
        : undefined;
    const budgetLevelRaw =
      typeof args.budgetLevel === 'string'
        ? args.budgetLevel.trim().toUpperCase()
        : undefined;
    const minRating =
      typeof args.minRating === 'number' ? args.minRating : undefined;
    const lat = typeof args.lat === 'number' ? args.lat : undefined;
    const lng = typeof args.lng === 'number' ? args.lng : undefined;
    const requestedLimit =
      typeof args.limit === 'number'
        ? Math.min(
            Math.max(1, Math.floor(args.limit)),
            ADVISOR_CONSTANTS.MAX_PLACE_LIMIT,
          )
        : ADVISOR_CONSTANTS.DEFAULT_PLACE_LIMIT;

    const areaId = await this.resolveAreaId(areaSlug);

    const validBudgets = Object.values(BudgetLevel) as string[];
    const budgetLevels =
      budgetLevelRaw && validBudgets.includes(budgetLevelRaw)
        ? [budgetLevelRaw as BudgetLevel]
        : undefined;

    const searchDto: SearchPlacesDto = {
      keyword,
      areaId,
      categorySlugs: categorySlug ? [categorySlug] : undefined,
      budgetLevels,
      minRating,
      lat,
      lng,
      limit: requestedLimit,
      page: 1,
      sortBy:
        lat !== undefined && lng !== undefined
          ? PlaceSortBy.DISTANCE
          : PlaceSortBy.RATING,
      sortOrder: SortOrder.DESC,
    };

    const result = await this.placeRepo.searchPlaces(searchDto);
    const discoveredPlaces = result.items.map((row) =>
      this.mapPlaceRowToSummary(row),
    );

    return {
      toolResponsePayload: {
        status: discoveredPlaces.length > 0 ? 'SUCCESS' : 'NO_PLACES_FOUND',
        totalMatched: result.total,
        places: result.items.map((row) => ({
          id: row.id,
          name: row.name,
          category:
            row.category_name_vi ||
            row.category_name ||
            ADVISOR_CONSTANTS.DEFAULT_CATEGORY_LABEL,
          address: row.address,
          city: row.area_name_vi || row.city || '',
          rating: Number(row.rating_avg ?? 0),
          reviewCount: Number(row.review_count ?? 0),
          priceLevel: row.price_level || null,
          description: row.description
            ? row.description.slice(
                0,
                ADVISOR_CONSTANTS.PLACE_DESCRIPTION_MAX_CHARS,
              )
            : undefined,
        })),
      },
      discoveredPlaces,
      discoveredCitations: [],
    };
  }

  /**
   * Tool 3: Retrieves deep details (openingHours, hotline, website) for a specific place UUID.
   */
  private async handleGetPlaceDetail(
    args: Record<string, unknown>,
  ): Promise<ToolExecutionOutcome> {
    const placeId = typeof args.placeId === 'string' ? args.placeId.trim() : '';
    if (!placeId) {
      return {
        toolResponsePayload: {
          status: 'INVALID_ARGUMENT',
          message: 'Thiếu mã định danh placeId.',
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }

    const detail = await this.placeRepo.findById(placeId);
    if (!detail) {
      return {
        toolResponsePayload: {
          status: 'NOT_FOUND',
          message: `Không tìm thấy địa điểm với ID "${placeId}".`,
        },
        discoveredPlaces: [],
        discoveredCitations: [],
      };
    }

    const placeSummary = this.mapPlaceDetailToSummary(detail);

    return {
      toolResponsePayload: {
        status: 'SUCCESS',
        place: {
          id: detail.id,
          name: detail.name,
          category:
            detail.category?.nameVi ||
            detail.category?.name ||
            ADVISOR_CONSTANTS.DEFAULT_CATEGORY_LABEL,
          address: detail.address,
          city: detail.area?.nameVi || detail.area?.name || '',
          rating: Number(detail.ratingAvg ?? 0),
          reviewCount: Number(detail.reviewCount ?? 0),
          priceLevel: detail.priceLevel || null,
          phone: detail.phone || null,
          website: detail.website || null,
          openingHours: detail.openingHours || null,
          description: detail.description || null,
        },
      },
      discoveredPlaces: [placeSummary],
      discoveredCitations: [],
    };
  }

  private async resolveAreaId(areaSlug?: string): Promise<number | undefined> {
    if (!areaSlug) return undefined;
    const normalized = areaSlug.toLowerCase();

    if (this.areaSlugCache.has(normalized)) {
      const cached = this.areaSlugCache.get(normalized);
      return cached ?? undefined;
    }

    const resolvedId = await this.knowledgeRepo.findAreaIdBySlug(normalized);
    this.areaSlugCache.set(normalized, resolvedId);
    return resolvedId ?? undefined;
  }

  private mapPlaceRowToSummary(row: PlaceRow): AdvisorPlaceSummary {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.area_name_vi || row.city || '',
      categoryName:
        row.category_name_vi ||
        row.category_name ||
        ADVISOR_CONSTANTS.DEFAULT_CATEGORY_LABEL,
      ratingAvg: Number(row.rating_avg ?? 0),
      reviewCount: Number(row.review_count ?? 0),
      priceLevel: row.price_level ?? null,
      primaryImage: row.primary_image ?? null,
      latitude: Number(row.latitude ?? 0),
      longitude: Number(row.longitude ?? 0),
    };
  }

  private mapPlaceDetailToSummary(detail: PlaceDetail): AdvisorPlaceSummary {
    const primaryImg =
      detail.images?.find((img) => img.isPrimary)?.imageUrl ||
      detail.images?.[0]?.imageUrl ||
      null;

    return {
      id: detail.id,
      name: detail.name,
      address: detail.address,
      city: detail.area?.nameVi || detail.area?.name || '',
      categoryName:
        detail.category?.nameVi ||
        detail.category?.name ||
        ADVISOR_CONSTANTS.DEFAULT_CATEGORY_LABEL,
      ratingAvg: Number(detail.ratingAvg ?? 0),
      reviewCount: Number(detail.reviewCount ?? 0),
      priceLevel: detail.priceLevel ?? null,
      primaryImage: primaryImg,
      latitude: Number(detail.latitude ?? 0),
      longitude: Number(detail.longitude ?? 0),
    };
  }
}
