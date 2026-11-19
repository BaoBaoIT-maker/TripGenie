import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { BudgetLevel, Prisma, type TravelArea } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  TransitService,
  IntercityTransitResult,
  computeLocalTransfer,
  formatDurationVi,
  formatVndCurrency,
} from './transit.service';
import { GeminiPlannerService } from './gemini-planner.service';
import { ItineraryAccessService } from './itinerary-access.service';
import {
  TourBriefing,
  normalizeTourBriefing,
  redactTourBriefing,
} from './tour-briefing.util';
import { evaluateOpeningStatus, OpeningStatus } from './opening-hours.util';
import {
  WeatherService,
  resolveItineraryCoordinates,
} from '../../weather/weather.service';
import {
  buildWeatherGuidance,
  WEATHER_THRESHOLDS,
  type TripWeatherResponse,
} from '../../weather/weather.constants';
import { buildSeasonalDayWeather } from '../../weather/seasonal-climate';
import { WEATHER_DEFAULTS } from '../../../config/weather.config';
import {
  GenerateItineraryDto,
  IntracityModeEnum,
  BudgetLevelEnum,
  TransitModeEnum,
  TravelPaceEnum,
  UpdateTourBriefingDto,
  UpdateItineraryDto,
  UpdateItineraryLodgingDto,
  getTravelPaceSpec,
} from '../dto/generate-itinerary.dto';
import {
  PRICING_CONFIG,
  UnitBudgetBreakdownInput,
  getDestinationTierMultiplier,
  calculatePlaceEstimatedCost,
  scaleBudgetBreakdownForParty,
} from '../../../config/pricing.config';
import {
  formatTimeOfDay,
  parseTimeOfDay,
} from '../../../common/utils/time-of-day.util';
import {
  ActivityRole,
  ITINERARY_PLANNING_CONFIG,
  computeCandidateLimit,
} from '../../../config/itinerary-planning.config';
import {
  classifyActivityRole,
  isLodgingCategory,
  selectBalancedCandidatePool,
} from '../../../common/utils/brand-key.util';
import { computeCentroid, GeoCoord } from '../../../common/utils/geo.util';
import {
  clusterPlacesByDay,
  isDiningCandidate,
  toCoord,
} from './route-optimizer/day-clustering';
import {
  optimizeDayRoute,
  resolveDayTimeWindow,
} from './route-optimizer/day-route-optimizer';
import {
  selectDefaultLodging,
  buildLodgingSuggestions,
  ScoredLodgingCandidate,
} from './lodging-selector';

const MS_PER_DAY = 86_400_000;

/** One planned day while the plan is being assembled (before persistence). */
interface PlannedDay {
  dayNumber: number;
  theme: string;
  activities: Array<{
    placeId: string | null;
    placeName: string;
    startTime: string; // "08:30"
    endTime: string; // "10:30"
    durationMinutes: number;
    visitOrder: number;
    notes?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    estimatedCost?: number | null;
    isDining?: boolean;
    isFree?: boolean;
  }>;
}

export interface BudgetBreakdown {
  transitRoundTrip: number;
  accommodation: number;
  food: number;
  tickets: number;
  localTransit: number;
  totalEstimated: number;
  perPersonEstimated?: number;
  partySize?: number;
}

export interface ItineraryActivity {
  id?: string;
  placeId: string;
  placeName: string;
  startTime: string | null; // "HH:mm"
  endTime: string | null;
  durationMinutes: number | null;
  visitOrder: number;
  notes: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  categoryName: string | null;
  distanceToNextKm: number | null; // straight-line to the next stop of the same day
  durationToNextMinutes?: number | null; // realistic travel duration to next stop
  travelModeToNext?: 'WALK' | 'BIKE' | 'CAR' | null;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  priceLevel?: string | null;
  priceRange?: any;
  estimatedCost?: number | null;
  openingHours?: any;
  openingStatus?: OpeningStatus | null;
}

export interface ItineraryDayLodging {
  nightNumber: number;
  isCheckOutDay?: boolean;
  isAutoSuggested: boolean;
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  priceRange: unknown;
  pricePerNight: number | null;
  imageUrl: string | null;
  distanceToFirstStopKm: number | null;
}

export interface ItineraryLodgingSuggestionItem {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  priceRange: unknown;
  pricePerNight: number | null;
  imageUrl: string | null;
  distanceKm: number;
  score: number;
}

export interface ItineraryLodgingSuggestionsResponse {
  nightNumber: number;
  totalNights: number;
  currentPlaceId: string | null;
  nearest: ItineraryLodgingSuggestionItem[];
  bestValue: ItineraryLodgingSuggestionItem[];
  topRated: ItineraryLodgingSuggestionItem[];
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  lodging?: ItineraryDayLodging | null;
  activities: ItineraryActivity[];
}

export interface ItineraryMemberSummary {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

/** Single response contract of POST /itineraries/generate and GET /itineraries/:id. */
export interface ItineraryDetail {
  id: string;
  creatorId?: string;
  isPublic?: boolean;
  isOwner?: boolean;
  viewerRole?: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  canEdit?: boolean;
  canManageMembers?: boolean;
  updatedAt?: string;
  title: string;
  description: string | null;
  destination: string | null;
  coverPhoto?: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  totalDays: number;
  partySize?: number;
  pace?: string | null;
  budgetLevel: string;
  areaBounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  intercityTransit: IntercityTransitResult | null;
  budgetBreakdown: BudgetBreakdown | null;
  tourBriefing?: TourBriefing | null;
  days: ItineraryDay[];
  members?: ItineraryMemberSummary[];
  memberCount?: number;
}

/** What we keep inside Itinerary.aiPreferences JSON. */
interface StoredPlan {
  originCity?: string;
  destCity?: string;
  budgetLevel?: string;
  intracityMode?: string;
  coverPhoto?: string;
  coverImage?: string;
  intercityTransit: IntercityTransitResult;
  baseBudgetBreakdown?: UnitBudgetBreakdownInput;
  budgetBreakdown: BudgetBreakdown;
  pace?: string;
  dayThemes: string[];
  plannedDays?: PlannedDay[];
  tourBriefing?: TourBriefing | null;
}

const DETAIL_INCLUDE = {
  area: {
    select: {
      id: true,
      name: true,
      bboxMinLat: true,
      bboxMaxLat: true,
      bboxMinLng: true,
      bboxMaxLng: true,
    },
  },
  destinations: {
    orderBy: [
      { dayNumber: 'asc' },
      { startTime: 'asc' },
      { visitOrder: 'asc' },
    ],
    include: {
      place: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          ratingAvg: true,
          reviewCount: true,
          priceLevel: true,
          priceRange: true,
          openingHours: true,
          category: { select: { name: true, nameVi: true, slug: true } },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 1,
            select: { imageUrl: true, thumbnailUrl: true },
          },
        },
      },
    },
  },
  lodgings: {
    orderBy: [{ nightNumber: 'asc' }],
    include: {
      place: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          ratingAvg: true,
          reviewCount: true,
          priceLevel: true,
          priceRange: true,
          category: { select: { name: true, nameVi: true, slug: true } },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 1,
            select: { imageUrl: true, thumbnailUrl: true },
          },
        },
      },
    },
  },
  tripGroup: {
    select: {
      id: true,
      members: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ItineraryInclude;

type ItineraryRow = Prisma.ItineraryGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/**
 * Pure bottom-up cost aggregator for itinerary activities (tickets & food).
 * Shared between initial generation (`generate`) and live detail projection (`toDetail`)
 * so adding, removing, or swapping activities automatically keeps `budgetBreakdown` accurate.
 */
export function computeBottomUpActivityCosts(
  items: Array<{ isDining?: boolean; estimatedCost?: number | null }>,
  totalDays: number,
  budgetLevel: string | null | undefined,
  destinationCity: string | null | undefined,
): { food: number; tickets: number } {
  const levelKey = (budgetLevel ||
    'MEDIUM') as keyof typeof PRICING_CONFIG.LIVING_EXPENSES.FOOD_PER_DAY;
  const dailyFood =
    PRICING_CONFIG.LIVING_EXPENSES.FOOD_PER_DAY[levelKey] ||
    PRICING_CONFIG.LIVING_EXPENSES.FOOD_PER_DAY.MEDIUM;
  const tierMultiplier = getDestinationTierMultiplier(destinationCity || '');

  let bottomUpTickets = 0;
  let bottomUpFood = 0;
  let diningCount = 0;

  for (const act of items) {
    if (act.isDining) {
      bottomUpFood += act.estimatedCost || 0;
      diningCount++;
    } else {
      bottomUpTickets += act.estimatedCost || 0;
    }
  }

  // Safety fallback for meals: If fewer than MEALS_PER_DAY meals/day are scheduled, add baseline for remaining meals
  const mealsPerDay = PRICING_CONFIG.LIVING_EXPENSES.MEALS_PER_DAY;
  const targetMeals = Math.max(1, totalDays) * mealsPerDay;
  if (diningCount < targetMeals) {
    const missingMeals = targetMeals - diningCount;
    const baselineMealCost = Math.round(
      (dailyFood / mealsPerDay) * tierMultiplier,
    );
    bottomUpFood += missingMeals * baselineMealCost;
  }

  return { food: bottomUpFood, tickets: bottomUpTickets };
}

export function assembleBudgetBreakdown(parts: {
  transitRoundTrip: number;
  accommodation: number;
  food: number;
  tickets: number;
  localTransit: number;
}): BudgetBreakdown {
  const transitRoundTrip = parts.transitRoundTrip || 0;
  const accommodation = parts.accommodation || 0;
  const food = parts.food || 0;
  const tickets = parts.tickets || 0;
  const localTransit = parts.localTransit || 0;
  return {
    transitRoundTrip,
    accommodation,
    food,
    tickets,
    localTransit,
    totalEstimated:
      transitRoundTrip + accommodation + food + tickets + localTransit,
  };
}

function computeDayDateIso(
  startDate: Date | null | undefined,
  dayNumber: number,
): string | null {
  if (!startDate) return null;
  const target = new Date(startDate.getTime() + (dayNumber - 1) * MS_PER_DAY);
  return target.toISOString().slice(0, 10);
}

/** Trip length = max(calendar span, highest scheduled day, 1). Single source for detail, weather and budget flows. */
function computeTotalDays(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  scheduledDayNumbers: Iterable<number>,
): number {
  const spanDays =
    startDate && endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
      : 0;
  return Math.max(spanDays, ...scheduledDayNumbers, 1);
}

type DestinationRow = ItineraryRow['destinations'][number];

/** Single source of per-stop cost classification (dining vs ticket) used by detail view and budget updates. */
function toLiveCostItem(
  dest: DestinationRow,
  budgetLevel: string | null,
): { isDining: boolean; estimatedCost: number } {
  const placeCostInfo = calculatePlaceEstimatedCost({
    category: dest.place.category,
    priceRange: dest.place.priceRange,
    priceLevel: dest.place.priceLevel || budgetLevel,
    placeName: dest.place.name,
  });
  return {
    isDining: placeCostInfo.isDining,
    estimatedCost:
      dest.estimatedCost != null
        ? Number(dest.estimatedCost)
        : placeCostInfo.cost,
  };
}

/** Same trip length as `toDetail`, derived from a loaded row (scheduled stops or stored plan fallback). */
function computeRowTotalDays(
  row: ItineraryRow,
  stored: Partial<StoredPlan>,
): number {
  const scheduled =
    row.destinations.length > 0 ? row.destinations : (stored.plannedDays ?? []);
  return computeTotalDays(
    row.startDate,
    row.endDate,
    scheduled.map((d) => d.dayNumber),
  );
}

export function resolveNightlyHotelRate(params: {
  lodgingPlace?: { priceRange?: any } | null;
  budgetLevel?: string | null;
  destinationCity?: string | null;
}): number {
  const minPrice =
    params.lodgingPlace?.priceRange?.min != null
      ? Number(params.lodgingPlace.priceRange.min)
      : NaN;
  if (Number.isFinite(minPrice) && minPrice > 0) {
    return Math.round(minPrice);
  }
  const levelKey = (params.budgetLevel ||
    'MEDIUM') as keyof typeof PRICING_CONFIG.LIVING_EXPENSES.HOTEL_PER_NIGHT;
  const dailyHotel =
    PRICING_CONFIG.LIVING_EXPENSES.HOTEL_PER_NIGHT[levelKey] ||
    PRICING_CONFIG.LIVING_EXPENSES.HOTEL_PER_NIGHT.MEDIUM;
  const tierMultiplier = getDestinationTierMultiplier(
    params.destinationCity || '',
  );
  return Math.round(dailyHotel * tierMultiplier);
}

function computeUnitLivingExpenses(
  totalDays: number,
  budgetLevel?: string | null,
  destinationCity?: string | null,
  intracityMode?: string | null,
  lodgingPlace?: { priceRange?: any } | null,
): { accommodation: number; localTransit: number } {
  const nights = Math.max(1, totalDays - 1);
  const tierMultiplier = getDestinationTierMultiplier(destinationCity || '');
  const nightlyRate = resolveNightlyHotelRate({
    lodgingPlace,
    budgetLevel,
    destinationCity,
  });
  const accommodation = Math.round(nightlyRate * nights);

  let dailyLocalTransit =
    PRICING_CONFIG.INTRACITY.MOTORBIKE_RENTAL_PER_DAY +
    PRICING_CONFIG.INTRACITY.DAILY_MOTORBIKE_GAS_ALLOWANCE;
  const dailyKm = PRICING_CONFIG.INTRACITY.AVG_DAILY_KM;
  if (intracityMode === IntracityModeEnum.TAXI_CAR) {
    dailyLocalTransit = dailyKm * PRICING_CONFIG.INTRACITY.TAXI_CAR_PER_KM;
  } else if (intracityMode === IntracityModeEnum.GRAB_BIKE) {
    dailyLocalTransit = dailyKm * PRICING_CONFIG.INTRACITY.GRAB_BIKE_PER_KM;
  }
  const localTransit = Math.round(
    dailyLocalTransit * totalDays * tierMultiplier,
  );

  return { accommodation, localTransit };
}

function computeScaledPartyBudget(params: {
  stored: Partial<StoredPlan>;
  liveCostItems: Array<{ isDining?: boolean; estimatedCost?: number | null }>;
  totalDays: number;
  budgetLevel?: string | null;
  destination?: string | null;
  partySize?: number | null;
  currentRowPartySize?: number | null;
  overrideTransitRoundTrip?: number;
  overrideIntercityMode?: string | null;
}): {
  unitBase: UnitBudgetBreakdownInput;
  scaled: BudgetBreakdown;
} {
  const currentParty =
    params.currentRowPartySize ?? PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE;
  // Legacy rows have baseBudgetBreakdown unset & partySize === 1, so stored.budgetBreakdown is 1-unit base.
  const baseSource =
    params.stored.baseBudgetBreakdown ??
    (currentParty === 1 ? params.stored.budgetBreakdown : undefined);
  const fallbackLiving = baseSource
    ? null
    : computeUnitLivingExpenses(
        params.totalDays,
        params.budgetLevel,
        params.destination,
        params.stored.intracityMode,
      );
  const activityCosts =
    params.liveCostItems.length > 0
      ? computeBottomUpActivityCosts(
          params.liveCostItems,
          params.totalDays,
          params.budgetLevel,
          params.destination,
        )
      : null;

  const unitBase: UnitBudgetBreakdownInput = {
    transitRoundTrip:
      params.overrideTransitRoundTrip ??
      baseSource?.transitRoundTrip ??
      params.stored.intercityTransit?.estimatedPriceRoundTrip ??
      0,
    accommodation:
      baseSource?.accommodation ?? fallbackLiving?.accommodation ?? 0,
    food: activityCosts?.food ?? baseSource?.food ?? 0,
    tickets: activityCosts?.tickets ?? baseSource?.tickets ?? 0,
    localTransit: baseSource?.localTransit ?? fallbackLiving?.localTransit ?? 0,
  };

  const scaled = scaleBudgetBreakdownForParty(unitBase, {
    partySize: params.partySize ?? currentParty,
    intercityMode:
      params.overrideIntercityMode ?? params.stored.intercityTransit?.mode,
    intracityMode: params.stored.intracityMode,
  });

  return { unitBase, scaled };
}

interface CachedLodgingPlace {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  ratingAvg: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  priceRange: unknown;
  category: {
    name: string | null;
    nameVi: string | null;
    slug: string | null;
  } | null;
  imageUrl?: string | null;
}

@Injectable()
export class ItineraryPlannerService {
  // ponytail: process-local TTL cache for city bbox lodging candidates (ceiling: single-node memory; upgrade path: Redis cache key when horizontally scaled).
  private readonly lodgingCandidateCache = new Map<
    string,
    { expiresAt: number; items: CachedLodgingPlace[] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly transitService: TransitService,
    private readonly geminiPlanner: GeminiPlannerService,
    private readonly accessService: ItineraryAccessService,
    @Optional() private readonly weatherService?: WeatherService,
  ) {}

  /**
   * Main pipeline: User Input -> DB Places -> Gemini Planner -> Save to DB -> Output
   */
  async generateItinerary(
    dto: GenerateItineraryDto,
    creatorId?: string,
  ): Promise<ItineraryDetail> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException(
        'Ngày kết thúc chuyến đi không thể trước ngày bắt đầu',
      );
    }

    const dayDiff = Math.round(
      (endDate.getTime() - startDate.getTime()) / MS_PER_DAY,
    );
    const totalDays = Math.max(1, dayDiff + 1);

    if (totalDays > ITINERARY_PLANNING_CONFIG.LIMITS.AI_MAX_TRIP_DAYS) {
      throw new BadRequestException(
        `Hệ thống hỗ trợ tạo lịch trình AI tối đa ${ITINERARY_PLANNING_CONFIG.LIMITS.AI_MAX_TRIP_DAYS} ngày`,
      );
    }

    // 1. Resolve Destination TravelArea & Geographic Coordinates
    let area: TravelArea | null = null;
    if (dto.destinationAreaId) {
      area = await this.prisma.travelArea.findUnique({
        where: { id: dto.destinationAreaId },
      });
    }
    if (!area) {
      area = await this.prisma.travelArea.findFirst({
        where: {
          OR: [
            { name: { contains: dto.destinationCity, mode: 'insensitive' } },
            { nameVi: { contains: dto.destinationCity, mode: 'insensitive' } },
            {
              slug: {
                contains: dto.destinationCity
                  .toLowerCase()
                  .replace(/\s+/g, '-'),
              },
            },
          ],
        },
      });
    }

    const destCoords =
      dto.destinationLat && dto.destinationLng
        ? { lat: dto.destinationLat, lng: dto.destinationLng, areaId: area?.id }
        : await this.transitService.resolveCityLocation(dto.destinationCity);

    if (!area && destCoords.areaId) {
      area = await this.prisma.travelArea.findUnique({
        where: { id: destCoords.areaId },
      });
    }

    // Critical Guard: A country-level area (e.g. areaId === 1, type === 'COUNTRY', or parentId === null)
    // is NOT a local destination area and must never be used to expand children across all 63 provinces!
    if (area && (area.id === 1 || area.type === 'COUNTRY' || !area.parentId)) {
      area = null;
    }

    const areaId = area?.id;
    const destLat = destCoords.lat;
    const destLng = destCoords.lng;

    // 2. Compute Physical Geographic Bounding Box (Source of Truth for local places)
    let bbox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
    if (
      area &&
      area.bboxMinLat !== null &&
      area.bboxMaxLat !== null &&
      area.bboxMinLng !== null &&
      area.bboxMaxLng !== null &&
      area.bboxMaxLat - area.bboxMinLat < ITINERARY_PLANNING_CONFIG.GEO.LOCAL_AREA_MAX_LAT_SPAN_DEG
    ) {
      bbox = {
        minLat: area.bboxMinLat,
        maxLat: area.bboxMaxLat,
        minLng: area.bboxMinLng,
        maxLng: area.bboxMaxLng,
      };
    } else {
      const GEO = ITINERARY_PLANNING_CONFIG.GEO;
      const deltaLat = GEO.FALLBACK_BBOX_RADIUS_KM / GEO.KM_PER_DEG_LAT;
      const deltaLng =
        GEO.FALLBACK_BBOX_RADIUS_KM /
        (GEO.KM_PER_DEG_LAT * Math.cos((destLat * Math.PI) / 180));
      bbox = {
        minLat: destLat - deltaLat,
        maxLat: destLat + deltaLat,
        minLng: destLng - deltaLng,
        maxLng: destLng + deltaLng,
      };
    }

    // 3. Fetch candidate Places strictly within the Bounding Box
    const areaIds = area
      ? [
          area.id,
          ...(
            await this.prisma.travelArea.findMany({
              where: { parentId: area.id },
              select: { id: true },
            })
          ).map((c) => c.id),
        ]
      : [];

    const paceSpec = getTravelPaceSpec(dto.pace);
    const { candidateLimit, queryLimit } = computeCandidateLimit(
      totalDays,
      paceSpec.maxStopsPerDay,
    );

    const candidateSelect = {
      id: true,
      name: true,
      nameNormalized: true,
      address: true,
      latitude: true,
      longitude: true,
      priceLevel: true,
      priceRange: true,
      openingHours: true,
      ratingAvg: true,
      reviewCount: true,
      category: {
        select: { name: true, nameVi: true, slug: true },
      },
      tags: true,
    } satisfies Prisma.PlaceSelect;

    const candidateWhere: Prisma.PlaceWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      ...(areaIds.length > 0 ? { areaId: { in: areaIds } } : {}),
      ...(dto.budgetLevel === BudgetLevelEnum.LOW
        ? { priceLevel: { in: [BudgetLevel.LOW, BudgetLevel.MEDIUM] } }
        : {}),
      category: {
        slug: {
          notIn: [
            ...ITINERARY_PLANNING_CONFIG.LODGING.CATEGORY_SLUGS,
            ...ITINERARY_PLANNING_CONFIG.LODGING.EXCLUDED_CATEGORY_SLUGS,
          ],
        },
      },
    };

    const [rawActivityPlaces, lodgingCandidates] = await Promise.all([
      this.prisma.place.findMany({
        where: candidateWhere,
        select: candidateSelect,
        orderBy: [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }],
        take: queryLimit,
      }),
      totalDays > 1
        ? this.prisma.place.findMany({
            where: {
              status: 'ACTIVE',
              deletedAt: null,
              latitude: { gte: bbox.minLat, lte: bbox.maxLat },
              longitude: { gte: bbox.minLng, lte: bbox.maxLng },
              category: {
                slug: {
                  in: [...ITINERARY_PLANNING_CONFIG.LODGING.CATEGORY_SLUGS],
                },
              },
            },
            select: candidateSelect,
            orderBy: [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }],
            take: ITINERARY_PLANNING_CONFIG.LIMITS.CANDIDATE_MAX,
          })
        : Promise.resolve([]),
    ]);

    // If activity candidate count is low, expand to all non-lodging places in the destination Bounding Box
    if (
      rawActivityPlaces.length <
      ITINERARY_PLANNING_CONFIG.LIMITS.BBOX_EXPAND_THRESHOLD
    ) {
      const bboxPlaces = await this.prisma.place.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          latitude: { gte: bbox.minLat, lte: bbox.maxLat },
          longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        },
        select: candidateSelect,
        orderBy: [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }],
        take: queryLimit,
      });

      const existingIds = new Set(rawActivityPlaces.map((p) => p.id));
      for (const p of bboxPlaces) {
        if (
          !existingIds.has(p.id) &&
          !isLodgingCategory(p.category, p.name)
        ) {
          rawActivityPlaces.push(p);
          existingIds.add(p.id);
        }
      }
    }

    // Stratified popularity ranking + brand deduplication + balanced role quotas
    const candidatePlaces = selectBalancedCandidatePool(
      rawActivityPlaces,
      candidateLimit,
    );

    // 3 & 4. Compute Intercity Transit, User Preferences, and Trip Weather in parallel
    const partySize = Math.max(
      PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE,
      Math.min(
        PRICING_CONFIG.PARTY_SCALING.MAX_PARTY_SIZE,
        Math.trunc(
          dto.partySize ?? PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE,
        ),
      ),
    );

    const [intercityTransit, userPref, tripWeather] = await Promise.all([
      this.transitService.calculateIntercityTransit({
        originCity: dto.originCity,
        originLat: dto.originLat,
        originLng: dto.originLng,
        destCity: dto.destinationCity,
        destLat,
        destLng,
        transitMode: dto.transitMode,
        departDate: dto.startDate,
        returnDate: dto.endDate,
      }),
      creatorId
        ? this.prisma.userPreference.findUnique({
            where: { userId: creatorId },
          })
        : Promise.resolve(null),
      this.weatherService
        ? this.weatherService.getTripWeather({
            lat: destLat,
            lng: destLng,
            destination: dto.destinationCity,
            startDate: dto.startDate,
            totalDays,
          })
        : Promise.resolve(null),
    ]);

    const budgetLevel =
      dto.budgetLevel ||
      (userPref?.budgetLevel as unknown as BudgetLevelEnum) ||
      BudgetLevelEnum.MEDIUM;

    const travelStyles =
      dto.travelStyles && dto.travelStyles.length > 0
        ? dto.travelStyles
        : userPref?.travelStyle && userPref.travelStyle.length > 0
          ? userPref.travelStyle
          : ['CULTURE', 'FOOD'];

    const fallbackCoord: GeoCoord = { lat: destLat, lng: destLng };
    const candidateCentroid =
      computeCentroid(
        candidatePlaces.map((p) => toCoord(p, fallbackCoord)),
      ) ?? fallbackCoord;

    // 4b. Select default lodging (1 hotel for all nights when totalDays > 1)
    const selectedLodging =
      totalDays > 1
        ? selectDefaultLodging(lodgingCandidates, {
            budgetLevel,
            referenceCoord: candidateCentroid,
          })
        : null;
    const lodgingCoord: GeoCoord | null = selectedLodging
      ? toCoord(selectedLodging.place, fallbackCoord)
      : null;

    // 4c. Geographic clustering into K = totalDays pools ordered from lodgingCoord
    const dayClusters = clusterPlacesByDay({
      places: candidatePlaces,
      totalDays,
      maxStopsPerDay: paceSpec.maxStopsPerDay,
      fallbackCoord,
      anchorCoord: lodgingCoord ?? candidateCentroid,
    });

    const {
      accommodation: totalHotelCost,
      localTransit: totalLocalTransitCost,
    } = computeUnitLivingExpenses(
      totalDays,
      budgetLevel,
      dto.destinationCity,
      dto.intracityMode,
      selectedLodging?.place ?? null,
    );

    // 5. Build Compact Gemini Prompt with per-day pools
    const toPlannerPlace = (p: (typeof candidatePlaces)[number]) => ({
      id: p.id,
      name: p.name,
      cat: p.category?.nameVi || p.category?.name || 'Điểm tham quan',
      rating: p.ratingAvg,
      tags: p.tags?.slice(0, 2) || [],
      isDining: isDiningCandidate(p),
      role: classifyActivityRole(p),
    });

    const placesContext = candidatePlaces.map(toPlannerPlace);
    const dayPools = dayClusters.map((dc) => ({
      dayNumber: dc.dayNumber,
      places: dc.places.map(toPlannerPlace),
    }));

    const planJson = await this.geminiPlanner.plan({
      originCity: dto.originCity,
      destCity: dto.destinationCity,
      destLat,
      destLng,
      totalDays,
      partySize,
      budgetLevel,
      pace: paceSpec.value,
      travelStyles,
      dietaryRestrictions: userPref?.dietaryRestrictions || [],
      preferredCategories: userPref?.preferredCategories || [],
      customPrompt: dto.customPrompt,
      dailyWeather: tripWeather?.days,
      lodgingName: selectedLodging?.place.name ?? null,
      places: placesContext,
      dayPools,
    });

    // 6. Validate LLM placeIds against day pools (placeId: null strictly banned) & optimize in-day route
    const days: PlannedDay[] = [];
    const globalPlaceMap = new Map(candidatePlaces.map((p) => [p.id, p]));
    const usedPlaceIds = new Set<string>();
    const optCfg = ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER;
    const mismatchThreshold = optCfg.PENALTIES.MEAL_MISMATCH_METERS;
    const forbiddenThreshold = optCfg.PENALTIES.FORBIDDEN_ROLE_METERS;

    for (let d = 1; d <= totalDays; d++) {
      const dayCluster = dayClusters[d - 1];
      const dayPool = dayCluster?.places ?? candidatePlaces;
      const dayPoolMap = new Map(dayPool.map((p) => [p.id, p]));

      const dayRaw = planJson.days?.find((item) => item.dayNumber === d) || {
        dayNumber: d,
        theme: `Khám phá ${dto.destinationCity} - Ngày ${d}`,
        activities: [],
      };

      const rawActivities =
        dayRaw.activities && dayRaw.activities.length > 0
          ? dayRaw.activities
          : paceSpec.fallbackSlots.map((slot) => ({
              placeId: null as string | null,
              placeName: '',
              startTime: slot.start,
              endTime: slot.end,
              durationMinutes: slot.dur,
              notes: slot.note,
            }));

      const validatedActivities: Array<
        PlannedDay['activities'][number] & {
          openingHours?: unknown;
          activityRole?: ActivityRole;
        }
      > = [];

      for (const act of rawActivities) {
        const slotWindow = resolveDayTimeWindow(act.startTime);
        const rolePenalties = optCfg.SLOT_ROLE_PENALTIES[slotWindow];

        // Strict pool validation: prefer dayPool match, then globalPool match
        const llmCandidate =
          act.placeId && !usedPlaceIds.has(act.placeId)
            ? (dayPoolMap.get(act.placeId) ?? globalPlaceMap.get(act.placeId))
            : undefined;

        // Guardrail: reject LLM pick if its ActivityRole violates the slot window (e.g. attraction in dinner or restaurant in morning sightseeing)
        let resolvedPlace =
          llmCandidate &&
          rolePenalties[classifyActivityRole(llmCandidate)] < mismatchThreshold
            ? llmCandidate
            : undefined;

        if (!resolvedPlace) {
          const isCompatible = (
            p: (typeof candidatePlaces)[number],
            maxPen: number,
          ) =>
            !usedPlaceIds.has(p.id) &&
            rolePenalties[classifyActivityRole(p)] <= maxPen;

          resolvedPlace =
            dayPool.find((p) => isCompatible(p, 0)) ??
            dayPool.find((p) => isCompatible(p, mismatchThreshold - 1)) ??
            candidatePlaces.find((p) => isCompatible(p, 0)) ??
            candidatePlaces.find((p) =>
              isCompatible(p, mismatchThreshold - 1),
            ) ??
            (llmCandidate &&
            rolePenalties[classifyActivityRole(llmCandidate)] <
              forbiddenThreshold
              ? llmCandidate
              : undefined) ??
            dayPool.find((p) => isCompatible(p, forbiddenThreshold - 1)) ??
            candidatePlaces.find((p) =>
              isCompatible(p, forbiddenThreshold - 1),
            ) ??
            dayPool.find((p) => !usedPlaceIds.has(p.id)) ??
            candidatePlaces.find((p) => !usedPlaceIds.has(p.id));
        }

        // Ban placeId: null — if pool is completely exhausted, skip slot rather than fabricating a DB Place
        if (!resolvedPlace) {
          continue;
        }
        usedPlaceIds.add(resolvedPlace.id);

        const placeCostInfo = calculatePlaceEstimatedCost({
          category: resolvedPlace.category,
          priceRange: resolvedPlace.priceRange,
          priceLevel: resolvedPlace.priceLevel || budgetLevel,
          placeName: resolvedPlace.name,
        });

        validatedActivities.push({
          placeId: resolvedPlace.id,
          placeName: resolvedPlace.name,
          startTime: act.startTime || '08:30',
          endTime: act.endTime || '10:30',
          durationMinutes: act.durationMinutes || 90,
          visitOrder: validatedActivities.length + 1,
          notes: act.notes || '',
          latitude: Number(resolvedPlace.latitude),
          longitude: Number(resolvedPlace.longitude),
          address: resolvedPlace.address,
          estimatedCost: placeCostInfo.cost,
          isDining: placeCostInfo.isDining,
          isFree: placeCostInfo.isFree,
          openingHours: resolvedPlace.openingHours,
          activityRole: classifyActivityRole(resolvedPlace),
        });
      }

      // 7. Exhaustive branch-and-bound route optimization anchored at lodging
      const dayDateIso = computeDayDateIso(startDate, d);
      const startAnchor = totalDays > 1 ? lodgingCoord : null;
      const endAnchor = d < totalDays ? lodgingCoord : null;
      const optimizedActivities = optimizeDayRoute({
        activities: validatedActivities,
        startAnchor,
        endAnchor,
        dayDate: dayDateIso,
      }).map(({ openingHours: _oh, activityRole: _ar, ...rest }) => rest);

      days.push({
        dayNumber: d,
        theme: dayRaw.theme || `Ngày ${d}`,
        activities: optimizedActivities,
      });
    }

    // Bottom-Up calculation for Tickets and Food using shared pure aggregator
    const { food: bottomUpFood, tickets: bottomUpTickets } =
      computeBottomUpActivityCosts(
        days.flatMap((d) => d.activities),
        totalDays,
        budgetLevel,
        dto.destinationCity,
      );

    const baseBudgetBreakdown: UnitBudgetBreakdownInput = {
      transitRoundTrip: intercityTransit.estimatedPriceRoundTrip,
      accommodation: totalHotelCost,
      food: bottomUpFood,
      tickets: bottomUpTickets,
      localTransit: totalLocalTransitCost,
    };
    const budgetBreakdown = scaleBudgetBreakdownForParty(baseBudgetBreakdown, {
      partySize,
      intercityMode: intercityTransit.mode,
      intracityMode: dto.intracityMode,
    });
    const { totalEstimated } = budgetBreakdown;

    // 8. Persist to Database (Itinerary, ItineraryDestination & ItineraryLodging in an Atomic Transaction)
    if (!creatorId) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để tạo lịch trình du lịch.',
      );
    }
    const effectiveCreatorId = creatorId;

    const savedItinerary = await this.prisma.$transaction(async (tx) => {
      const itin = await tx.itinerary.create({
        data: {
          creatorId: effectiveCreatorId,
          title:
            planJson.title ||
            `Hành trình khám phá ${dto.destinationCity} ${totalDays}N${Math.max(1, totalDays - 1)}Đ`,
          description:
            planJson.description ||
            `Lịch trình AI thiết kế tự động cho chuyến đi ${dto.destinationCity}`,
          destination: dto.destinationCity,
          areaId,
          startDate,
          endDate,
          totalBudget: totalEstimated,
          estimatedCost: totalEstimated,
          budgetLevel: budgetLevel,
          isAiGenerated: true,
          isPublic: false,
          totalPlaces: days.reduce((sum, d) => sum + d.activities.length, 0),
          partySize,
          aiPreferences: {
            originCity: dto.originCity,
            transitMode: intercityTransit.mode,
            intracityMode: dto.intracityMode,
            pace: paceSpec.value,
            travelStyles,
            dietaryRestrictions: userPref?.dietaryRestrictions || [],
            intercityTransit,
            baseBudgetBreakdown,
            budgetBreakdown,
            dayThemes: days.map((d) => d.theme),
            plannedDays: days,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // Bulk create destinations inside transaction
      const destinationsToCreate: Prisma.ItineraryDestinationCreateManyInput[] =
        [];
      for (const day of days) {
        for (const act of day.activities) {
          if (act.placeId) {
            destinationsToCreate.push({
              itineraryId: itin.id,
              placeId: act.placeId,
              dayNumber: day.dayNumber,
              visitOrder: act.visitOrder,
              startTime: parseTimeOfDay(act.startTime),
              endTime: parseTimeOfDay(act.endTime),
              estimatedDurationMinutes: act.durationMinutes,
              estimatedCost:
                act.estimatedCost != null
                  ? new Prisma.Decimal(act.estimatedCost)
                  : null,
              notes: act.notes,
            });
          }
        }
      }

      if (destinationsToCreate.length > 0) {
        await tx.itineraryDestination.createMany({
          data: destinationsToCreate,
        });
      }

      // Persist N - 1 nights of default lodging if trip has >= 1 night
      if (totalDays > 1 && selectedLodging) {
        const totalNights = totalDays - 1;
        const lodgingsToCreate: Prisma.ItineraryLodgingCreateManyInput[] =
          Array.from({ length: totalNights }, (_, idx) => ({
            itineraryId: itin.id,
            nightNumber: idx + 1,
            placeId: selectedLodging.place.id,
            isAutoSuggested: true,
          }));
        await tx.itineraryLodging.createMany({
          data: lodgingsToCreate,
        });
      }

      return itin;
    });

    return this.getById(savedItinerary.id, effectiveCreatorId);
  }

  /**
   * Shared ownership assertion for itinerary mutations & Copilot actions.
   */
  async assertItineraryOwnership(id: string, userId?: string): Promise<void> {
    if (!userId) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để thực hiện thao tác này.',
      );
    }
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, creatorId: true },
    });
    if (!row) {
      throw new NotFoundException(
        'Không tìm thấy lịch trình hoặc lịch trình đã bị xóa.',
      );
    }
    if (row.creatorId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa lịch trình của người khác.',
      );
    }
  }

  /**
   * Retrieve an itinerary in the same shape `generateItinerary` returns.
   * Allows access if the requester is the owner OR if the itinerary is public.
   */
  async getById(id: string, requesterId?: string): Promise<ItineraryDetail> {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }
    const isOwner = Boolean(requesterId && row.creatorId === requesterId);
    const isMember = Boolean(
      requesterId &&
      row.tripGroup?.members.some((m) => m.userId === requesterId),
    );
    if (!row.isPublic && !isOwner && !isMember) {
      if (!requesterId) {
        throw new UnauthorizedException(
          'Vui lòng đăng nhập để xem lịch trình riêng tư này.',
        );
      }
      throw new ForbiddenException('Lịch trình này đang ở chế độ riêng tư.');
    }
    return this.toDetail(row, requesterId);
  }

  /**
   * Calculates realistic travel duration and mode between stops within a day in Vietnam cities.
   * - Under 0.8 km: Walking (4.5 km/h)
   * - Above 0.8 km: Motorbike (~25 km/h) or Car (~22 km/h) with 1.25x road detour factor + traffic buffer.
   */
  private computeIntracityTransit(
    distanceKm: number | null,
    intracityMode?: string | null,
  ): {
    durationMinutes: number | null;
    travelMode: 'WALK' | 'BIKE' | 'CAR' | null;
  } {
    if (distanceKm == null || distanceKm <= 0) {
      return { durationMinutes: null, travelMode: null };
    }
    const IC = PRICING_CONFIG.INTRACITY;
    if (distanceKm <= IC.WALK_THRESHOLD_KM) {
      return {
        durationMinutes: Math.max(
          IC.MIN_WALK_MINUTES,
          Math.round((distanceKm / IC.WALK_SPEED_KMH) * 60),
        ),
        travelMode: 'WALK',
      };
    }
    const roadKm = distanceKm * IC.ROAD_DETOUR_FACTOR;
    if (intracityMode === 'TAXI_CAR') {
      return {
        durationMinutes: Math.max(
          IC.MIN_CAR_MINUTES,
          Math.round((roadKm / IC.CAR_SPEED_KMH) * 60) +
            IC.CAR_TRAFFIC_BUFFER_MINUTES,
        ),
        travelMode: 'CAR',
      };
    }
    return {
      durationMinutes: Math.max(
        IC.MIN_BIKE_MINUTES,
        Math.round((roadKm / IC.BIKE_SPEED_KMH) * 60) +
          IC.BIKE_TRAFFIC_BUFFER_MINUTES,
      ),
      travelMode: 'BIKE',
    };
  }

  /**
   * Normalizes legacy stored intercityTransit snapshots so older DB itineraries
   * display accurate destination names and local transfer steps without re-generating.
   */
  private normalizeStoredTransit(
    transit: IntercityTransitResult | null | undefined,
    destination: string | null,
  ): IntercityTransitResult | null {
    if (!transit) return null;
    const cleanDest = destination?.trim() || transit.destName;

    // Legacy snapshots stored the airport/station hub name inside destName
    const isHubNameInDest =
      transit.destHub?.name &&
      transit.destName === transit.destHub.name &&
      cleanDest !== transit.destHub.name;
    const normalizedDestName = isHubNameInDest ? cleanDest : transit.destName;

    let routeSteps = transit.details?.routeSteps
      ? [...transit.details.routeSteps]
      : [];
    if (routeSteps.length === 0 && transit.mode === 'FLIGHT') {
      const hubName = transit.destHub?.name || `Sân bay đi ${cleanDest}`;
      const { transferKm, transferMinutes } = computeLocalTransfer(
        transit.destHub?.distanceKm,
      );
      const durM =
        transit.durationMinutes ||
        PRICING_CONFIG.INTERCITY.FLIGHT.MINUTES_SHORT;
      routeSteps = [
        `Chặng bay chính: Khởi hành từ ${transit.originHub?.name || transit.originName} ──> ${hubName} (~${formatDurationVi(durM, true)}, ~${formatVndCurrency(transit.estimatedPriceOneWay || 0)}/vé)`,
        `Trung chuyển sân bay về trung tâm: Xe trung chuyển / Taxi từ ${hubName} về trung tâm ${cleanDest} (~${transferKm}km, ~${transferMinutes} phút)`,
      ];
    }

    return {
      ...transit,
      destName: normalizedDestName,
      details: {
        ...transit.details,
        routeSteps,
      },
    };
  }

  private toDetail(row: ItineraryRow, requesterId?: string): ItineraryDetail {
    const stored = readStoredPlan(row.aiPreferences);
    const byDay = new Map<number, ItineraryActivity[]>();
    const rows = row.destinations;
    const liveCostItems: Array<{ isDining: boolean; estimatedCost: number }> =
      [];

    rows.forEach((dest, i) => {
      const next = rows[i + 1];
      const sameDayNext =
        next && next.dayNumber === dest.dayNumber ? next : null;
      const distanceToNextKm = sameDayNext
        ? Math.round(
            this.transitService.computeHaversineDistance(
              dest.place.latitude,
              dest.place.longitude,
              sameDayNext.place.latitude,
              sameDayNext.place.longitude,
            ) * 10,
          ) / 10
        : null;

      const transitInfo = this.computeIntracityTransit(
        distanceToNextKm,
        stored.intracityMode,
      );
      const image = dest.place.images[0];
      const costItem = toLiveCostItem(dest, row.budgetLevel);
      const resolvedCost = costItem.estimatedCost;
      liveCostItems.push(costItem);

      const startTimeStr = formatTimeOfDay(dest.startTime);
      const dayDate = computeDayDateIso(row.startDate, dest.dayNumber);
      const list = byDay.get(dest.dayNumber) ?? [];
      list.push({
        id: dest.id,
        placeId: dest.place.id,
        placeName: dest.place.name,
        startTime: startTimeStr,
        endTime: formatTimeOfDay(dest.endTime),
        durationMinutes: dest.estimatedDurationMinutes,
        visitOrder: list.length + 1,
        notes: dest.notes,
        latitude: dest.place.latitude,
        longitude: dest.place.longitude,
        address: dest.place.address,
        imageUrl: image?.imageUrl ?? image?.thumbnailUrl ?? null,
        thumbnailUrl: image?.thumbnailUrl ?? null,
        categoryName:
          dest.place.category?.nameVi ?? dest.place.category?.name ?? null,
        distanceToNextKm,
        durationToNextMinutes: transitInfo.durationMinutes,
        travelModeToNext: transitInfo.travelMode,
        ratingAvg:
          dest.place.ratingAvg != null && Number(dest.place.ratingAvg) > 0
            ? Number(dest.place.ratingAvg)
            : null,
        reviewCount:
          dest.place.reviewCount != null && Number(dest.place.reviewCount) > 0
            ? Number(dest.place.reviewCount)
            : null,
        priceLevel: dest.place.priceLevel ?? 'MEDIUM',
        priceRange: dest.place.priceRange ?? null,
        estimatedCost: resolvedCost,
        openingHours: dest.place.openingHours ?? null,
        openingStatus: evaluateOpeningStatus(
          dest.place.openingHours,
          dayDate,
          startTimeStr,
        ),
      });
      byDay.set(dest.dayNumber, list);
    });

    // If destination has 0 DB places, restore from stored.plannedDays
    if (
      byDay.size === 0 &&
      stored.plannedDays &&
      Array.isArray(stored.plannedDays)
    ) {
      for (const pd of stored.plannedDays) {
        const acts: ItineraryActivity[] = (pd.activities || []).map(
          (a, idx, arr) => {
            const nextAct = arr[idx + 1];
            let distanceToNextKm: number | null = null;
            if (
              nextAct &&
              a.latitude &&
              a.longitude &&
              nextAct.latitude &&
              nextAct.longitude
            ) {
              distanceToNextKm =
                Math.round(
                  this.transitService.computeHaversineDistance(
                    a.latitude,
                    a.longitude,
                    nextAct.latitude,
                    nextAct.longitude,
                  ) * 10,
                ) / 10;
            }
            const transitInfo = this.computeIntracityTransit(
              distanceToNextKm,
              stored.intracityMode,
            );

            return {
              placeId: a.placeId || `p-${pd.dayNumber}-${idx + 1}`,
              placeName: a.placeName,
              startTime: a.startTime || '08:30',
              endTime: a.endTime || '10:30',
              durationMinutes: a.durationMinutes || 90,
              visitOrder: a.visitOrder || idx + 1,
              notes: a.notes || null,
              latitude: a.latitude || 16.0544,
              longitude: a.longitude || 108.2022,
              address: a.address || null,
              imageUrl: null,
              thumbnailUrl: null,
              categoryName: 'Điểm tham quan',
              distanceToNextKm,
              durationToNextMinutes: transitInfo.durationMinutes,
              travelModeToNext: transitInfo.travelMode,
              ratingAvg: null,
              reviewCount: null,
              estimatedCost: a.estimatedCost ?? null,
              openingStatus: null,
            };
          },
        );
        byDay.set(pd.dayNumber, acts);
      }
    }

    const totalDays = computeTotalDays(
      row.startDate,
      row.endDate,
      byDay.keys(),
    );

    const lodgingRows = row.lodgings ?? [];
    const lodgingByNight = new Map(
      lodgingRows.map((l) => [l.nightNumber, l]),
    );

    const days: ItineraryDay[] = Array.from({ length: totalDays }, (_, i) => {
      const dayNumber = i + 1;
      const dayActivities = byDay.get(dayNumber) ?? [];
      const isCheckOutDay = totalDays > 1 && dayNumber === totalDays;
      const targetNight = isCheckOutDay ? totalDays - 1 : dayNumber;
      const lodgingRow =
        totalDays > 1 ? lodgingByNight.get(targetNight) : undefined;

      let lodging: ItineraryDayLodging | null = null;
      if (lodgingRow && lodgingRow.place) {
        const lp = lodgingRow.place;
        const firstStop = dayActivities[0];
        const distanceToFirstStopKm =
          firstStop &&
          Number.isFinite(Number(lp.latitude)) &&
          Number.isFinite(Number(lp.longitude)) &&
          Number.isFinite(Number(firstStop.latitude)) &&
          Number.isFinite(Number(firstStop.longitude))
            ? Math.round(
                this.transitService.computeHaversineDistance(
                  Number(lp.latitude),
                  Number(lp.longitude),
                  Number(firstStop.latitude),
                  Number(firstStop.longitude),
                ) * 10,
              ) / 10
            : null;
        const img = lp.images?.[0];
        const pricePerNight = resolveNightlyHotelRate({
          lodgingPlace: lp,
          budgetLevel: row.budgetLevel,
          destinationCity: row.destination,
        });

        lodging = {
          nightNumber: lodgingRow.nightNumber,
          isCheckOutDay,
          isAutoSuggested: Boolean(lodgingRow.isAutoSuggested),
          placeId: lp.id,
          name: lp.name,
          address: lp.address ?? null,
          latitude: Number(lp.latitude),
          longitude: Number(lp.longitude),
          ratingAvg:
            lp.ratingAvg != null && Number(lp.ratingAvg) > 0
              ? Number(lp.ratingAvg)
              : null,
          reviewCount:
            lp.reviewCount != null && Number(lp.reviewCount) > 0
              ? Number(lp.reviewCount)
              : null,
          priceLevel: lp.priceLevel ?? null,
          priceRange: lp.priceRange ?? null,
          pricePerNight,
          imageUrl: img?.imageUrl ?? img?.thumbnailUrl ?? null,
          distanceToFirstStopKm,
        };
      }

      return {
        dayNumber,
        theme: stored.dayThemes?.[i] ?? `Ngày ${dayNumber}`,
        lodging,
        activities: dayActivities,
      };
    });

    const isOwner = Boolean(requesterId && row.creatorId === requesterId);
    const memberRole = requesterId
      ? row.tripGroup?.members.find((m) => m.userId === requesterId)?.role
      : null;
    const isTripMember = Boolean(memberRole);
    const viewerRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null = isOwner
      ? 'OWNER'
      : memberRole === 'EDITOR'
        ? 'EDITOR'
        : memberRole === 'VIEWER'
          ? 'VIEWER'
          : null;
    const canEdit = isOwner || memberRole === 'EDITOR';
    const canManageMembers = isOwner;

    const mappedMembers: ItineraryMemberSummary[] = (
      row.tripGroup?.members || []
    ).map((m: any) => ({
      userId: m.userId,
      fullName: m.user?.fullName ?? null,
      avatarUrl: m.user?.avatarUrl ?? null,
      role: m.role,
    }));
    const memberCount = mappedMembers.length > 0 ? mappedMembers.length : 1;
    const partySize =
      row.partySize ?? PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE;

    const hasBudgetData = Boolean(
      stored.baseBudgetBreakdown ||
      stored.budgetBreakdown ||
      liveCostItems.length > 0,
    );
    const liveBudgetBreakdown: BudgetBreakdown | null = hasBudgetData
      ? computeScaledPartyBudget({
          stored,
          liveCostItems,
          totalDays,
          budgetLevel: row.budgetLevel,
          destination: row.destination,
          partySize,
          currentRowPartySize: partySize,
        }).scaled
      : null;

    const areaBounds =
      row.area?.bboxMinLat != null &&
      row.area?.bboxMaxLat != null &&
      row.area?.bboxMinLng != null &&
      row.area?.bboxMaxLng != null
        ? {
            minLat: Number(row.area.bboxMinLat),
            maxLat: Number(row.area.bboxMaxLat),
            minLng: Number(row.area.bboxMinLng),
            maxLng: Number(row.area.bboxMaxLng),
          }
        : null;

    return {
      id: row.id,
      creatorId: row.creatorId,
      isPublic: row.isPublic,
      isOwner,
      viewerRole,
      canEdit,
      canManageMembers,
      updatedAt: row.updatedAt
        ? row.updatedAt.toISOString()
        : new Date().toISOString(),
      title: row.title,
      description: row.description,
      destination: row.destination,
      coverPhoto: stored.coverPhoto || stored.coverImage || null,
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      totalDays,
      partySize,
      pace: stored.pace ?? null,
      budgetLevel: row.budgetLevel ?? 'MEDIUM',
      areaBounds,
      intercityTransit: this.normalizeStoredTransit(
        stored.intercityTransit,
        row.destination,
      ),
      budgetBreakdown: liveBudgetBreakdown,
      tourBriefing: redactTourBriefing(
        stored.tourBriefing,
        isOwner || isTripMember,
      ),
      members: mappedMembers,
      memberCount,
      days,
    };
  }

  /**
   * List itineraries belonging ONLY to the currently authenticated user.
   */
  async listItineraries(
    userId?: string,
    scope: 'OWNED' | 'JOINED' = 'OWNED',
  ): Promise<ItineraryDetail[]> {
    if (!userId) {
      return [];
    }
    const where: Prisma.ItineraryWhereInput =
      scope === 'JOINED'
        ? {
            creatorId: { not: userId },
            deletedAt: null,
            tripGroup: {
              members: {
                some: { userId },
              },
            },
          }
        : {
            creatorId: userId,
            deletedAt: null,
          };

    const rows = await this.prisma.itinerary.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: ITINERARY_PLANNING_CONFIG.LIMITS.LIST_ITINERARIES_MAX,
    });
    return rows.map((r) => this.toDetail(r, userId));
  }

  /**
   * Soft-delete an itinerary.
   * Only marks deletedAt for this itinerary if owned by the requester.
   * If other users or trips were cloned from this itinerary (clonedFromId),
   * their cloned itineraries remain 100% active and untouched.
   */
  async deleteItinerary(
    id: string,
    requesterId?: string,
  ): Promise<{ success: boolean; id: string }> {
    await this.accessService.assertCanEdit(id, requesterId);

    await this.prisma.itinerary.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  /**
   * Soft-delete multiple itineraries owned by the requester at once.
   * Clones belonging to others remain untouched and preserved.
   */
  async bulkDeleteItineraries(
    ids: string[],
    requesterId?: string,
  ): Promise<{ success: boolean; count: number }> {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0 };
    }
    if (!requesterId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để xóa lịch trình.');
    }

    const result = await this.prisma.itinerary.updateMany({
      where: {
        id: { in: ids },
        creatorId: requesterId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true, count: result.count };
  }

  /**
   * Clone an itinerary into a new independent trip.
   * Sets clonedFromId to the source itinerary id.
   */
  async cloneItinerary(id: string, userId?: string): Promise<ItineraryDetail> {
    if (!userId) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để nhân bản lịch trình.',
      );
    }

    const source = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });

    if (!source) {
      throw new NotFoundException('Không tìm thấy lịch trình để sao chép.');
    }

    if (!source.isPublic && source.creatorId !== userId) {
      throw new ForbiddenException(
        'Không thể sao chép lịch trình riêng tư của người khác.',
      );
    }

    const effectiveCreatorId = userId;
    const rawPrefs =
      typeof source.aiPreferences === 'object' &&
      source.aiPreferences !== null &&
      !Array.isArray(source.aiPreferences)
        ? { ...(source.aiPreferences as Record<string, unknown>) }
        : {};
    if (source.creatorId !== effectiveCreatorId) {
      delete rawPrefs.tourBriefing;
    }

    const cloned = await this.prisma.$transaction(async (tx) => {
      const newItin = await tx.itinerary.create({
        data: {
          creatorId: effectiveCreatorId,
          title: `${source.title} (Bản sao)`,
          description: source.description,
          destination: source.destination,
          areaId: source.areaId,
          startDate: source.startDate,
          endDate: source.endDate,
          totalBudget: source.totalBudget,
          budgetLevel: source.budgetLevel,
          estimatedCost: source.estimatedCost,
          isAiGenerated: false,
          aiPreferences: rawPrefs as unknown as Prisma.InputJsonValue,
          status: 'DRAFT',
          isPublic: false,
          clonedFromId: source.id,
          totalPlaces: source.totalPlaces,
          partySize:
            source.partySize ?? PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE,
        },
      });

      if (source.destinations && source.destinations.length > 0) {
        await tx.itineraryDestination.createMany({
          data: source.destinations.map((d) => ({
            itineraryId: newItin.id,
            placeId: d.placeId,
            dayNumber: d.dayNumber,
            visitOrder: d.visitOrder,
            startTime: d.startTime,
            endTime: d.endTime,
            estimatedDurationMinutes: d.estimatedDurationMinutes,
            estimatedCost: d.estimatedCost,
            notes: d.notes,
          })),
        });
      }

      if (source.lodgings && source.lodgings.length > 0) {
        await tx.itineraryLodging.createMany({
          data: source.lodgings.map((l) => ({
            itineraryId: newItin.id,
            nightNumber: l.nightNumber,
            placeId: l.placeId,
            isAutoSuggested: l.isAutoSuggested,
          })),
        });
      }

      // ponytail: direct tx update of communityPost.cloneCount couples itinerary planner to community table. Upgrade to domain event (ItineraryClonedEvent) with outbox if community is ever split into a microservice.
      await tx.communityPost.updateMany({
        where: { itineraryId: source.id, deletedAt: null },
        data: { cloneCount: { increment: 1 } },
      });

      return newItin;
    });

    return this.getById(cloned.id, effectiveCreatorId);
  }

  /**
   * Update the intercity transit mode of an itinerary and recalculate
   * deep links, travel duration, round-trip prices, and budget breakdown.
   */
  async updateTransitMode(
    id: string,
    newTransitMode: TransitModeEnum,
    userId?: string,
  ): Promise<ItineraryDetail> {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });

    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }
    if (row.creatorId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa phương tiện của lịch trình này.',
      );
    }

    const stored = readStoredPlan(row.aiPreferences);
    const originCity = stored.originCity || PRICING_CONFIG.DEFAULTS.ORIGIN_CITY;
    const destCity =
      row.destination || stored.destCity || PRICING_CONFIG.DEFAULTS.DEST_CITY;
    const departDate =
      row.startDate?.toISOString().slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    const returnDate = row.endDate?.toISOString().slice(0, 10) || undefined;

    // Recalculate intercity transit with new mode
    const intercityTransit =
      await this.transitService.calculateIntercityTransit({
        originCity,
        destCity,
        transitMode: newTransitMode,
        budgetLevel: row.budgetLevel || stored.budgetLevel,
        departDate,
        returnDate,
      });

    // Recalculate 1-unit base & party-scaled budget breakdown with new round-trip transit price
    const { unitBase, scaled: budgetBreakdown } = computeScaledPartyBudget({
      stored,
      liveCostItems: row.destinations.map((d) =>
        toLiveCostItem(d, row.budgetLevel),
      ),
      totalDays: computeRowTotalDays(row, stored),
      budgetLevel: row.budgetLevel,
      destination: row.destination,
      partySize: row.partySize,
      currentRowPartySize: row.partySize,
      overrideTransitRoundTrip: intercityTransit.estimatedPriceRoundTrip,
      overrideIntercityMode: intercityTransit.mode,
    });
    const { totalEstimated } = budgetBreakdown;

    const updatedAiPreferences = {
      ...(typeof row.aiPreferences === 'object' && row.aiPreferences !== null
        ? row.aiPreferences
        : {}),
      transitMode: newTransitMode,
      intercityTransit,
      baseBudgetBreakdown: unitBase,
      budgetBreakdown,
    };

    const updated = await this.prisma.itinerary.update({
      where: { id },
      data: {
        totalBudget: totalEstimated,
        estimatedCost: totalEstimated,
        aiPreferences: updatedAiPreferences as unknown as Prisma.InputJsonValue,
      },
      include: DETAIL_INCLUDE,
    });

    // Owner already verified above; project the updated row directly (no extra read round-trip).
    return this.toDetail(updated, userId);
  }

  /**
   * Load the aiPreferences JSON of a live (not soft-deleted) itinerary, asserting caller ownership.
   */
  private async loadOwnedPreferences(
    id: string,
    userId: string | undefined,
    forbiddenMessage: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      select: { creatorId: true, aiPreferences: true },
    });
    if (!row) {
      throw new NotFoundException(
        'Không tìm thấy lịch trình hoặc lịch trình đã bị xóa.',
      );
    }
    if (row.creatorId !== userId) {
      throw new ForbiddenException(forbiddenMessage);
    }
    return { ...readStoredPlan(row.aiPreferences) };
  }

  /**
   * Update the cover photo of an itinerary.
   */
  async updateCoverPhoto(id: string, coverPhoto: string, userId?: string) {
    const current = await this.loadOwnedPreferences(
      id,
      userId,
      'Bạn không có quyền thay đổi ảnh bìa của lịch trình này.',
    );

    await this.prisma.itinerary.update({
      where: { id },
      data: {
        aiPreferences: {
          ...current,
          coverPhoto,
          coverImage: coverPhoto,
        },
      },
    });

    return this.getById(id, userId);
  }

  /**
   * Update the tour leader & assembly briefing info of an itinerary (owner only).
   */
  async updateTourBriefing(
    id: string,
    dto: UpdateTourBriefingDto,
    userId?: string,
  ): Promise<ItineraryDetail> {
    const current = await this.loadOwnedPreferences(
      id,
      userId,
      'Bạn không có quyền chỉnh sửa thông tin đoàn của lịch trình này.',
    );

    await this.prisma.itinerary.update({
      where: { id },
      data: {
        aiPreferences: {
          ...current,
          tourBriefing: normalizeTourBriefing(dto),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getById(id, userId);
  }

  /**
   * Update trip metadata atomically:
   * - title / description / dates: OWNER or EDITOR (`assertCanEdit`)
   * - partySize: OWNER only (`assertOwner`), recalculating scaled budget without invoking LLM
   */
  async updateItineraryMeta(
    id: string,
    dto: UpdateItineraryDto,
    userId?: string,
  ): Promise<ItineraryDetail> {
    const hasTitle = dto.title !== undefined;
    const hasDescription = dto.description !== undefined;
    const hasPartySize = dto.partySize !== undefined;
    const hasDates = dto.startDate !== undefined || dto.endDate !== undefined;

    if (!hasTitle && !hasDescription && !hasPartySize && !hasDates) {
      throw new BadRequestException(
        'Vui lòng cung cấp ít nhất một thông tin cần cập nhật.',
      );
    }

    if (hasPartySize) {
      await this.accessService.assertOwner(id, userId);
    } else {
      await this.accessService.assertCanEdit(id, userId);
    }

    let normalizedTitle: string | undefined;
    if (hasTitle) {
      normalizedTitle = dto.title!.trim();
      if (!normalizedTitle) {
        throw new BadRequestException(
          'Tiêu đề lịch trình không được để trống.',
        );
      }
    }

    let parsedStart: Date | undefined;
    let parsedEnd: Date | undefined;
    let newSpanDays: number | undefined;

    if (hasDates) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          'Vui lòng cung cấp cả ngày bắt đầu và ngày kết thúc.',
        );
      }
      parsedStart = new Date(`${dto.startDate}T00:00:00.000Z`);
      parsedEnd = new Date(`${dto.endDate}T00:00:00.000Z`);
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
        throw new BadRequestException(
          'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.',
        );
      }
      if (parsedEnd < parsedStart) {
        throw new BadRequestException(
          'Ngày kết thúc không thể trước ngày bắt đầu.',
        );
      }
      newSpanDays =
        Math.round((parsedEnd.getTime() - parsedStart.getTime()) / MS_PER_DAY) +
        1;
      if (newSpanDays > ITINERARY_PLANNING_CONFIG.LIMITS.MANUAL_MAX_TRIP_DAYS) {
        throw new BadRequestException(
          `Thời gian chuyến đi tối đa là ${ITINERARY_PLANNING_CONFIG.LIMITS.MANUAL_MAX_TRIP_DAYS} ngày.`,
        );
      }
    }

    // If total days reduced, handle out-of-bounds stops (dayNumber > newSpanDays)
    if (newSpanDays !== undefined) {
      if (dto.dayShiftMode === 'trim') {
        await this.prisma.itineraryDestination.deleteMany({
          where: { itineraryId: id, dayNumber: { gt: newSpanDays } },
        });
      } else {
        // Default: merge out-of-bounds stops into the last valid day
        await this.prisma.itineraryDestination.updateMany({
          where: { itineraryId: id, dayNumber: { gt: newSpanDays } },
          data: { dayNumber: newSpanDays },
        });
      }
    }

    const updateData: Prisma.ItineraryUpdateInput = {};
    if (normalizedTitle !== undefined) {
      updateData.title = normalizedTitle;
    }
    if (hasDescription) {
      const trimmedDesc = dto.description!.trim();
      updateData.description = trimmedDesc.length > 0 ? trimmedDesc : null;
    }
    if (parsedStart && parsedEnd) {
      updateData.startDate = parsedStart;
      updateData.endDate = parsedEnd;
    }

    // Party size update or date changes trigger scaled budget recalculation
    if (hasPartySize || hasDates) {
      const row = await this.prisma.itinerary.findFirst({
        where: { id, deletedAt: null },
        include: DETAIL_INCLUDE,
      });
      if (!row) {
        throw new NotFoundException(`Itinerary with id "${id}" not found`);
      }
      const targetPartySize =
        dto.partySize ??
        row.partySize ??
        PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE;
      const budgetUpdate = this.buildPartySizeUpdate(
        {
          ...row,
          startDate: parsedStart ?? row.startDate,
          endDate: parsedEnd ?? row.endDate,
        },
        targetPartySize,
      );
      Object.assign(updateData, budgetUpdate);
    }
    const updated = await this.prisma.itinerary.update({
      where: { id },
      data: updateData,
      include: DETAIL_INCLUDE,
    });

    // Access already verified above; project the updated row directly (no extra read round-trip).
    return this.toDetail(updated, userId);
  }

  /**
   * Owner-only partySize update: delegates to `updateItineraryMeta` for single-path handling.
   */
  async updatePartySize(
    id: string,
    rawPartySize: number,
    userId?: string,
  ): Promise<ItineraryDetail> {
    return this.updateItineraryMeta(id, { partySize: rawPartySize }, userId);
  }

  /**
   * Deterministic (no LLM) party-size rescale: returns the Prisma fields to persist.
   */
  private buildPartySizeUpdate(
    row: Prisma.ItineraryGetPayload<{ include: typeof DETAIL_INCLUDE }>,
    rawPartySize: number,
  ): Prisma.ItineraryUpdateInput {
    const partySize = Math.max(
      PRICING_CONFIG.PARTY_SCALING.MIN_PARTY_SIZE,
      Math.min(
        PRICING_CONFIG.PARTY_SCALING.MAX_PARTY_SIZE,
        Math.trunc(rawPartySize),
      ),
    );
    const stored = readStoredPlan(row.aiPreferences);

    const { unitBase, scaled: budgetBreakdown } = computeScaledPartyBudget({
      stored,
      liveCostItems: row.destinations.map((d) =>
        toLiveCostItem(d, row.budgetLevel),
      ),
      totalDays: computeRowTotalDays(row, stored),
      budgetLevel: row.budgetLevel,
      destination: row.destination,
      partySize,
      currentRowPartySize: row.partySize,
    });
    const { totalEstimated } = budgetBreakdown;

    const updatedAiPreferences = {
      ...(typeof row.aiPreferences === 'object' && row.aiPreferences !== null
        ? row.aiPreferences
        : {}),
      baseBudgetBreakdown: unitBase,
      budgetBreakdown,
    };

    return {
      partySize,
      totalBudget: totalEstimated,
      estimatedCost: totalEstimated,
      aiPreferences: updatedAiPreferences as unknown as Prisma.InputJsonValue,
    };
  }

  /**
   * Fetch trip-specific weather (Open-Meteo 16-day forecast or 7-region seasonal climate fallback).
   */
  async getWeatherById(
    id: string,
    requesterId?: string,
  ): Promise<TripWeatherResponse> {
    await this.accessService.assertCanView(id, requesterId);

    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        destination: true,
        startDate: true,
        endDate: true,
        aiPreferences: true,
        area: {
          select: {
            bboxMinLat: true,
            bboxMaxLat: true,
            bboxMinLng: true,
            bboxMaxLng: true,
          },
        },
        destinations: {
          select: {
            dayNumber: true,
            place: { select: { latitude: true, longitude: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }

    const stored = readStoredPlan(row.aiPreferences);
    const scheduledDayNumbers = [
      ...(row.destinations || []).map((d) => d.dayNumber || 0),
      ...(stored.plannedDays || []).map((d) => d.dayNumber || 0),
    ];
    const totalDays = computeTotalDays(
      row.startDate,
      row.endDate,
      scheduledDayNumbers,
    );

    let coords = resolveItineraryCoordinates(row);
    if (!coords && row.destination) {
      try {
        const resolved = await this.transitService.resolveCityLocation(
          row.destination,
        );
        if (resolved?.lat && resolved?.lng) {
          coords = { lat: resolved.lat, lng: resolved.lng };
        }
      } catch {
        // Seasonal fallback works without coordinates
      }
    }

    if (!this.weatherService) {
      const month = (row.startDate ?? new Date()).getUTCMonth() + 1;
      const days = Array.from({ length: totalDays }, (_, i) =>
        buildSeasonalDayWeather({
          dayNumber: i + 1,
          date: computeDayDateIso(row.startDate, i + 1),
          destination: row.destination,
          month,
        }),
      );
      return {
        destination: row.destination,
        coordinates: coords,
        timezone: WEATHER_DEFAULTS.TIMEZONE,
        hasForecastDays: false,
        days,
        guidance: buildWeatherGuidance(days),
      };
    }

    return this.weatherService.getTripWeather({
      lat: coords?.lat,
      lng: coords?.lng,
      destination: row.destination,
      startDate: row.startDate,
      totalDays,
    });
  }

  private async getCachedLodgingCandidates(bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): Promise<CachedLodgingPlace[]> {
    const key = `${bbox.minLat.toFixed(2)}:${bbox.maxLat.toFixed(2)}:${bbox.minLng.toFixed(2)}:${bbox.maxLng.toFixed(2)}`;
    const now = Date.now();
    const hit = this.lodgingCandidateCache.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.items;
    }

    const rows = await this.prisma.place.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        category: {
          slug: {
            in: [...ITINERARY_PLANNING_CONFIG.LODGING.CATEGORY_SLUGS],
          },
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        ratingAvg: true,
        reviewCount: true,
        priceLevel: true,
        priceRange: true,
        category: { select: { name: true, nameVi: true, slug: true } },
      },
      orderBy: [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }],
      take: ITINERARY_PLANNING_CONFIG.LIMITS.CANDIDATE_MAX,
    });

    const items: CachedLodgingPlace[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      ratingAvg:
        r.ratingAvg != null && Number(r.ratingAvg) > 0
          ? Number(r.ratingAvg)
          : null,
      reviewCount:
        r.reviewCount != null && Number(r.reviewCount) > 0
          ? Number(r.reviewCount)
          : null,
      priceLevel: r.priceLevel ?? null,
      priceRange: r.priceRange ?? null,
      category: r.category ?? null,
      imageUrl: undefined,
    }));

    const cfg = ITINERARY_PLANNING_CONFIG.LODGING;
    if (this.lodgingCandidateCache.size >= cfg.CANDIDATE_CACHE_MAX_ENTRIES) {
      const oldestKey = this.lodgingCandidateCache.keys().next().value;
      if (oldestKey) this.lodgingCandidateCache.delete(oldestKey);
    }
    this.lodgingCandidateCache.set(key, {
      expiresAt: now + cfg.CANDIDATE_CACHE_TTL_MS,
      items,
    });

    return items;
  }

  /**
   * Returns 3 groups of lodging suggestions (nearest to day stops, best value for budget, top rated)
   * for a given night of an itinerary.
   */
  async getLodgingSuggestions(
    id: string,
    query: { night?: number; budget?: string },
    requesterId?: string,
  ): Promise<ItineraryLodgingSuggestionsResponse> {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        creatorId: true,
        isPublic: true,
        startDate: true,
        endDate: true,
        budgetLevel: true,
        destination: true,
        aiPreferences: true,
        area: {
          select: {
            bboxMinLat: true,
            bboxMaxLat: true,
            bboxMinLng: true,
            bboxMaxLng: true,
          },
        },
        lodgings: {
          select: { nightNumber: true, placeId: true },
        },
        destinations: {
          select: {
            dayNumber: true,
            place: { select: { latitude: true, longitude: true } },
          },
        },
        tripGroup: {
          select: {
            members: {
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }

    const isOwner = Boolean(requesterId && row.creatorId === requesterId);
    const isMember = Boolean(
      requesterId &&
        row.tripGroup?.members.some((m) => m.userId === requesterId),
    );
    if (!row.isPublic && !isOwner && !isMember) {
      if (!requesterId) {
        throw new UnauthorizedException(
          'Vui lòng đăng nhập để xem lịch trình riêng tư này.',
        );
      }
      throw new ForbiddenException('Lịch trình này đang ở chế độ riêng tư.');
    }

    const stored = readStoredPlan(row.aiPreferences);
    const scheduledDays =
      row.destinations.length > 0
        ? row.destinations.map((d) => d.dayNumber)
        : (stored.plannedDays ?? []).map((d) => d.dayNumber);
    const totalDays = computeTotalDays(
      row.startDate,
      row.endDate,
      scheduledDays,
    );
    const totalNights = Math.max(1, totalDays - 1);
    const nightNumber = Math.max(
      1,
      Math.min(totalNights, Math.trunc(Number(query.night) || 1)),
    );
    const effectiveBudget = query.budget || row.budgetLevel || 'MEDIUM';

    // Compute centroid of the target day's stops (or all stops / destination bbox center)
    const dayStops = row.destinations.filter(
      (d) => d.dayNumber === nightNumber,
    );
    const stopSource = dayStops.length > 0 ? dayStops : row.destinations;
    let dayCentroid = computeCentroid(
      stopSource
        .filter(
          (d) =>
            Number.isFinite(Number(d.place.latitude)) &&
            Number.isFinite(Number(d.place.longitude)),
        )
        .map((d) => ({
          lat: Number(d.place.latitude),
          lng: Number(d.place.longitude),
        })),
    );

    if (!dayCentroid) {
      if (
        row.area?.bboxMinLat != null &&
        row.area?.bboxMaxLat != null &&
        row.area?.bboxMinLng != null &&
        row.area?.bboxMaxLng != null
      ) {
        dayCentroid = {
          lat: (Number(row.area.bboxMinLat) + Number(row.area.bboxMaxLat)) / 2,
          lng: (Number(row.area.bboxMinLng) + Number(row.area.bboxMaxLng)) / 2,
        };
      } else {
        const resolved = await this.transitService.resolveCityLocation(
          row.destination || '',
        );
        dayCentroid = { lat: resolved.lat, lng: resolved.lng };
      }
    }

    const bbox =
      row.area?.bboxMinLat != null &&
      row.area?.bboxMaxLat != null &&
      row.area?.bboxMinLng != null &&
      row.area?.bboxMaxLng != null
        ? {
            minLat: Number(row.area.bboxMinLat),
            maxLat: Number(row.area.bboxMaxLat),
            minLng: Number(row.area.bboxMinLng),
            maxLng: Number(row.area.bboxMaxLng),
          }
        : {
            minLat:
              dayCentroid.lat -
              ITINERARY_PLANNING_CONFIG.GEO.SUGGESTION_BBOX_EXPAND_DEG,
            maxLat:
              dayCentroid.lat +
              ITINERARY_PLANNING_CONFIG.GEO.SUGGESTION_BBOX_EXPAND_DEG,
            minLng:
              dayCentroid.lng -
              ITINERARY_PLANNING_CONFIG.GEO.SUGGESTION_BBOX_EXPAND_DEG,
            maxLng:
              dayCentroid.lng +
              ITINERARY_PLANNING_CONFIG.GEO.SUGGESTION_BBOX_EXPAND_DEG,
          };

    const currentLodging = (row.lodgings ?? []).find(
      (l) => l.nightNumber === nightNumber,
    );
    const currentPlaceId = currentLodging?.placeId ?? null;

    const candidates = await this.getCachedLodgingCandidates(bbox);

    const groups = buildLodgingSuggestions(candidates, {
      budgetLevel: effectiveBudget,
      dayCentroid,
      currentPlaceId,
    });

    // Lazy primary-image resolution only for the <= 15 winning hotels (memoized onto cached items)
    const winningPlaces = [
      ...groups.nearest,
      ...groups.bestValue,
      ...groups.topRated,
    ].map((item) => item.place);
    const missingImgPlaces = Array.from(
      new Set(winningPlaces.filter((p) => p.imageUrl === undefined)),
    );

    if (missingImgPlaces.length > 0) {
      const images = await this.prisma.placeImage.findMany({
        where: {
          placeId: { in: missingImgPlaces.map((p) => p.id) },
          isPrimary: true,
        },
        select: { placeId: true, imageUrl: true, thumbnailUrl: true },
      });
      const imgByPlaceId = new Map(
        images.map((img) => [
          img.placeId,
          img.imageUrl ?? img.thumbnailUrl ?? null,
        ]),
      );
      for (const p of missingImgPlaces) {
        p.imageUrl = imgByPlaceId.get(p.id) ?? null;
      }
    }

    const mapSuggestion = (
      item: ScoredLodgingCandidate<CachedLodgingPlace>,
    ): ItineraryLodgingSuggestionItem => {
      const p = item.place;
      return {
        placeId: p.id,
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        priceLevel: p.priceLevel,
        priceRange: p.priceRange,
        pricePerNight: resolveNightlyHotelRate({
          lodgingPlace: p,
          budgetLevel: effectiveBudget,
          destinationCity: row.destination,
        }),
        imageUrl: p.imageUrl ?? null,
        distanceKm: item.distanceKm,
        score: Math.round(item.score * 1000) / 1000,
      };
    };

    return {
      nightNumber,
      totalNights,
      currentPlaceId,
      nearest: groups.nearest.map(mapSuggestion),
      bestValue: groups.bestValue.map(mapSuggestion),
      topRated: groups.topRated.map(mapSuggestion),
    };
  }

  /**
   * Updates lodging for a night range [fromNight..toNight], recalculates accommodation budget,
   * and re-optimizes in-day route sequences for all affected days.
   * Allowed for itinerary OWNER and trip group EDITOR.
   */
  async updateLodging(
    id: string,
    dto: UpdateItineraryLodgingDto,
    userId?: string,
  ): Promise<ItineraryDetail> {
    await this.accessService.assertCanEdit(id, userId);

    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }

    const stored = readStoredPlan(row.aiPreferences);
    const totalDays = computeRowTotalDays(row, stored);
    if (totalDays <= 1) {
      throw new BadRequestException(
        'Chuyến đi trong ngày không có đêm lưu trú.',
      );
    }

    const totalNights = totalDays - 1;
    const fromNight = Math.max(1, Math.min(totalNights, dto.fromNight));
    const toNight = Math.max(
      fromNight,
      Math.min(totalNights, dto.toNight ?? totalNights),
    );

    const place = await this.prisma.place.findFirst({
      where: { id: dto.placeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        priceRange: true,
        priceLevel: true,
      },
    });
    if (!place) {
      throw new NotFoundException('Không tìm thấy địa điểm lưu trú đã chọn.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Bulk replace lodgings in [fromNight..toNight]: delete + createMany avoids N upsert round-trips.
      const nightsInRange = Array.from(
        { length: toNight - fromNight + 1 },
        (_, i) => fromNight + i,
      );
      await tx.itineraryLodging.deleteMany({
        where: { itineraryId: id, nightNumber: { in: nightsInRange } },
      });
      await tx.itineraryLodging.createMany({
        data: nightsInRange.map((night) => ({
          itineraryId: id,
          nightNumber: night,
          placeId: place.id,
          isAutoSuggested: false,
        })),
      });

      const allLodgings = await tx.itineraryLodging.findMany({
        where: { itineraryId: id },
        include: {
          place: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              priceRange: true,
            },
          },
        },
      });
      const lodgingByNight = new Map(
        allLodgings.map((l) => [l.nightNumber, l]),
      );

      // Re-optimize affected days: nights [fromNight..toNight] anchor days [fromNight .. min(totalDays, toNight + 1)]
      const startAffectedDay = Math.max(1, fromNight);
      const endAffectedDay = Math.min(totalDays, toNight + 1);
      const destUpdates: Promise<unknown>[] = [];

      for (let d = startAffectedDay; d <= endAffectedDay; d++) {
        const dayDests = row.destinations.filter((dest) => dest.dayNumber === d);
        if (dayDests.length <= 1) continue;

        const startLodgingRow =
          lodgingByNight.get(d === totalDays ? totalDays - 1 : d) ??
          lodgingByNight.get(Math.max(1, d - 1));
        const endLodgingRow =
          d < totalDays ? lodgingByNight.get(d) : undefined;

        const startAnchor: GeoCoord | null = startLodgingRow?.place
          ? {
              lat: Number(startLodgingRow.place.latitude),
              lng: Number(startLodgingRow.place.longitude),
            }
          : null;
        const endAnchor: GeoCoord | null = endLodgingRow?.place
          ? {
              lat: Number(endLodgingRow.place.latitude),
              lng: Number(endLodgingRow.place.longitude),
            }
          : null;

        const optimizable = dayDests.map((dest, idx) => {
          const costInfo = toLiveCostItem(dest, row.budgetLevel);
          return {
            destId: dest.id,
            placeId: dest.placeId,
            placeName: dest.place.name,
            startTime: formatTimeOfDay(dest.startTime) || '08:30',
            endTime: formatTimeOfDay(dest.endTime) || '10:30',
            durationMinutes: dest.estimatedDurationMinutes || 90,
            visitOrder: idx + 1,
            latitude: Number(dest.place.latitude),
            longitude: Number(dest.place.longitude),
            isDining: costInfo.isDining,
            openingHours: dest.place.openingHours,
            category: dest.place.category,
          };
        });

        const optimized = optimizeDayRoute({
          activities: optimizable,
          startAnchor,
          endAnchor,
          dayDate: computeDayDateIso(row.startDate, d),
        });

        for (const item of optimized) {
          destUpdates.push(
            tx.itineraryDestination.update({
              where: { id: item.destId },
              data: {
                visitOrder: item.visitOrder,
                startTime: parseTimeOfDay(item.startTime),
                endTime: parseTimeOfDay(item.endTime),
                estimatedDurationMinutes: item.durationMinutes,
              },
            }),
          );
        }
      }

      if (destUpdates.length > 0) {
        await Promise.all(destUpdates);
      }

      // Recalculate 1-room accommodation sum across all nights 1..totalNights
      let newUnitAccommodation = 0;
      for (let n = 1; n <= totalNights; n++) {
        const lRow = lodgingByNight.get(n);
        newUnitAccommodation += resolveNightlyHotelRate({
          lodgingPlace: lRow?.place ?? null,
          budgetLevel: row.budgetLevel,
          destinationCity: row.destination,
        });
      }

      const updatedStored: Partial<StoredPlan> = {
        ...stored,
        baseBudgetBreakdown: stored.baseBudgetBreakdown
          ? {
              ...stored.baseBudgetBreakdown,
              accommodation: newUnitAccommodation,
            }
          : undefined,
      };

      const { unitBase, scaled: budgetBreakdown } = computeScaledPartyBudget({
        stored: updatedStored,
        liveCostItems: row.destinations.map((d) =>
          toLiveCostItem(d, row.budgetLevel),
        ),
        totalDays,
        budgetLevel: row.budgetLevel,
        destination: row.destination,
        partySize: row.partySize,
        currentRowPartySize: row.partySize,
      });
      unitBase.accommodation = newUnitAccommodation;
      const rescaled = scaleBudgetBreakdownForParty(unitBase, {
        partySize: row.partySize,
        intercityMode: stored.intercityTransit?.mode,
        intracityMode: stored.intracityMode,
      });

      const updatedAiPreferences = {
        ...(typeof row.aiPreferences === 'object' && row.aiPreferences !== null
          ? row.aiPreferences
          : {}),
        baseBudgetBreakdown: unitBase,
        budgetBreakdown: rescaled,
      };

      await tx.itinerary.update({
        where: { id },
        data: {
          totalBudget: rescaled.totalEstimated,
          estimatedCost: rescaled.totalEstimated,
          aiPreferences:
            updatedAiPreferences as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.getById(id, userId);
  }
}

/** aiPreferences is untyped JSON in the DB; accept only an object, fields are optional. */
function readStoredPlan(json: Prisma.JsonValue): Partial<StoredPlan> {
  return json && typeof json === 'object' && !Array.isArray(json) ? json : {};
}
