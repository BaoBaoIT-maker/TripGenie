import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BudgetLevel, Prisma, TravelArea } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TransitService, IntercityTransitResult } from './transit.service';
import { GeminiPlannerService } from './gemini-planner.service';
import {
  GenerateItineraryDto,
  IntracityModeEnum,
  BudgetLevelEnum,
  TransitModeEnum,
} from '../dto/generate-itinerary.dto';
import { PRICING_CONFIG, getDestinationTierMultiplier, calculatePlaceEstimatedCost } from '../../../config/pricing.config';
import {
  formatTimeOfDay,
  parseTimeOfDay,
} from '../../../common/utils/time-of-day.util';

const MS_PER_DAY = 86_400_000;
const MAX_TRIP_DAYS = 30;

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
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  activities: ItineraryActivity[];
}

/** Single response contract of POST /itineraries/generate and GET /itineraries/:id. */
export interface ItineraryDetail {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  coverPhoto?: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  totalDays: number;
  budgetLevel: string;
  intercityTransit: IntercityTransitResult | null;
  budgetBreakdown: BudgetBreakdown | null;
  days: ItineraryDay[];
}

/** What we keep inside Itinerary.aiPreferences JSON. */
interface StoredPlan {
  intercityTransit: IntercityTransitResult;
  budgetBreakdown: BudgetBreakdown;
  dayThemes: string[];
  plannedDays?: PlannedDay[];
}

const DETAIL_INCLUDE = {
  destinations: {
    orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
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
          category: { select: { name: true, nameVi: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { imageUrl: true, thumbnailUrl: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ItineraryInclude;

type ItineraryRow = Prisma.ItineraryGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class ItineraryPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitService: TransitService,
    private readonly geminiPlanner: GeminiPlannerService,
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

    if (totalDays > MAX_TRIP_DAYS) {
      throw new BadRequestException(`Hệ thống hỗ trợ tạo lịch trình tối đa ${MAX_TRIP_DAYS} ngày`);
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
            { slug: { contains: dto.destinationCity.toLowerCase().replace(/\s+/g, '-') } },
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
    let bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    if (
      area &&
      area.bboxMinLat !== null &&
      area.bboxMaxLat !== null &&
      area.bboxMinLng !== null &&
      area.bboxMaxLng !== null &&
      area.bboxMaxLat - area.bboxMinLat < 2.0 // ensure it's a local city/province bbox
    ) {
      bbox = {
        minLat: area.bboxMinLat,
        maxLat: area.bboxMaxLat,
        minLng: area.bboxMinLng,
        maxLng: area.bboxMaxLng,
      };
    } else {
      const radiusKm = 45;
      const deltaLat = radiusKm / 111;
      const deltaLng = radiusKm / (111 * Math.cos((destLat * Math.PI) / 180));
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

    let candidatePlaces = await this.prisma.place.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        ...(areaIds.length > 0 ? { areaId: { in: areaIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        priceLevel: true,
        priceRange: true,
        ratingAvg: true,
        category: {
          select: { name: true, nameVi: true, slug: true },
        },
        tags: true,
      },
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
      take: 25,
    });

    // If candidate count is low, expand to all places in the destination Bounding Box
    if (candidatePlaces.length < 10) {
      const bboxPlaces = await this.prisma.place.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          latitude: { gte: bbox.minLat, lte: bbox.maxLat },
          longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          priceLevel: true,
          priceRange: true,
          ratingAvg: true,
          category: {
            select: { name: true, nameVi: true, slug: true },
          },
          tags: true,
        },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: 25,
      });

      const existingIds = new Set(candidatePlaces.map((p) => p.id));
      for (const p of bboxPlaces) {
        if (!existingIds.has(p.id)) {
          candidatePlaces.push(p);
          existingIds.add(p.id);
        }
      }
    }


    // 3. Compute Intercity Transit
    const intercityTransit = await this.transitService.calculateIntercityTransit({
      originCity: dto.originCity,
      originLat: dto.originLat,
      originLng: dto.originLng,
      destCity: dto.destinationCity,
      destLat,
      destLng,
      transitMode: dto.transitMode,
      departDate: dto.startDate,
      returnDate: dto.endDate,
    });

    // 4. Calculate Living Expenses based on Config
    const budgetLevel = dto.budgetLevel || BudgetLevelEnum.MEDIUM;
    const dailyFood =
      PRICING_CONFIG.LIVING_EXPENSES.FOOD_PER_DAY[budgetLevel] ||
      PRICING_CONFIG.LIVING_EXPENSES.FOOD_PER_DAY.MEDIUM;
    const dailyHotel =
      PRICING_CONFIG.LIVING_EXPENSES.HOTEL_PER_NIGHT[budgetLevel] ||
      PRICING_CONFIG.LIVING_EXPENSES.HOTEL_PER_NIGHT.MEDIUM;

    const nights = Math.max(1, totalDays - 1); // nights = days - 1
    const tierMultiplier = getDestinationTierMultiplier(dto.destinationCity);
    const totalHotelCost = Math.round(dailyHotel * nights * tierMultiplier);

    // Local intracity transit cost adjusted by destination tier
    let dailyLocalTransit = PRICING_CONFIG.INTRACITY.MOTORBIKE_RENTAL_PER_DAY + PRICING_CONFIG.INTRACITY.DAILY_MOTORBIKE_GAS_ALLOWANCE;
    const dailyKm = PRICING_CONFIG.INTRACITY.AVG_DAILY_KM;
    if (dto.intracityMode === IntracityModeEnum.TAXI_CAR) {
      dailyLocalTransit = dailyKm * PRICING_CONFIG.INTRACITY.TAXI_CAR_PER_KM;
    } else if (dto.intracityMode === IntracityModeEnum.GRAB_BIKE) {
      dailyLocalTransit = dailyKm * PRICING_CONFIG.INTRACITY.GRAB_BIKE_PER_KM;
    }
    const totalLocalTransitCost = Math.round(dailyLocalTransit * totalDays * tierMultiplier);

    // 5. Build Compact Gemini Prompt
    const placesContext = candidatePlaces.map((p) => ({
      id: p.id,
      name: p.name,
      cat: p.category?.nameVi || p.category?.name || 'Điểm tham quan',
      rating: p.ratingAvg,
      tags: p.tags?.slice(0, 3) || [],
    }));

    const planJson = await this.geminiPlanner.plan({
      originCity: dto.originCity,
      destCity: dto.destinationCity,
      destLat,
      destLng,
      totalDays,
      budgetLevel,
      pace: dto.pace || 'BALANCED',
      travelStyles: dto.travelStyles || ['CULTURE', 'FOOD'],
      customPrompt: dto.customPrompt,
      places: placesContext,
    });

    // 6. Assemble Full Day Plans & Map Coordinates
    const days: PlannedDay[] = [];
    const placeMap = new Map(candidatePlaces.map((p) => [p.id, p]));

    for (let d = 1; d <= totalDays; d++) {
      const dayRaw = planJson.days?.find((item) => item.dayNumber === d) || {
        dayNumber: d,
        theme: `Khám phá ${dto.destinationCity} - Ngày ${d}`,
        activities: [],
      };

      const activities: PlannedDay['activities'] = [];
      let order = 1;

      for (const act of dayRaw.activities || []) {
        // Trust boundary: accept only IDs from our candidate set (LLM may hallucinate UUIDs)
        const placeDetails = act.placeId ? placeMap.get(act.placeId) : undefined;
        const placeCostInfo = calculatePlaceEstimatedCost({
          category: placeDetails?.category,
          priceRange: placeDetails?.priceRange,
          priceLevel: placeDetails?.priceLevel || budgetLevel,
          placeName: placeDetails?.name || act.placeName,
        });

        let actLat = placeDetails?.latitude
          ? Number(placeDetails.latitude)
          : act.latitude
          ? Number(act.latitude)
          : destLat;
        let actLng = placeDetails?.longitude
          ? Number(placeDetails.longitude)
          : act.longitude
          ? Number(act.longitude)
          : destLng;

        // Bounding Box verification: if coordinates fall outside destination bbox, reset to dest center
        if (
          actLat < bbox.minLat ||
          actLat > bbox.maxLat ||
          actLng < bbox.minLng ||
          actLng > bbox.maxLng
        ) {
          actLat = destLat;
          actLng = destLng;
        }

        let actAddress = placeDetails?.address || act.address;
        if (!placeDetails && (!actAddress || !actAddress.toLowerCase().includes(dto.destinationCity.toLowerCase()))) {
          actAddress = `${act.placeName || 'Điểm đến'}, ${dto.destinationCity}, Việt Nam`;
        }

        activities.push({
          placeId: placeDetails?.id ?? null,
          placeName: placeDetails?.name || act.placeName || 'Điểm tham quan',
          startTime: act.startTime || '08:30',
          endTime: act.endTime || '10:30',
          durationMinutes: act.durationMinutes || 90,
          visitOrder: order++,
          notes: act.notes || '',
          latitude: actLat,
          longitude: actLng,
          address: actAddress,
          estimatedCost: placeCostInfo.cost,
          isDining: placeCostInfo.isDining,
          isFree: placeCostInfo.isFree,
        });
      }

      days.push({
        dayNumber: d,
        theme: dayRaw.theme || `Ngày ${d}`,
        activities,
      });
    }

    // Bottom-Up calculation for Tickets and Food
    let bottomUpTickets = 0;
    let bottomUpFood = 0;
    let diningCount = 0;

    for (const day of days) {
      for (const act of day.activities) {
        if (act.isDining) {
          bottomUpFood += act.estimatedCost || 0;
          diningCount++;
        } else {
          bottomUpTickets += act.estimatedCost || 0;
        }
      }
    }

    // Safety fallback for meals: If planner scheduled fewer than 3 meals/day, add baseline for remaining meals
    const targetMeals = totalDays * 3;
    if (diningCount < targetMeals) {
      const missingMeals = targetMeals - diningCount;
      const baselineMealCost = Math.round(
        (dailyFood / 3) * tierMultiplier,
      );
      bottomUpFood += missingMeals * baselineMealCost;
    }

    const totalEstimated =
      intercityTransit.estimatedPriceRoundTrip +
      totalHotelCost +
      bottomUpFood +
      bottomUpTickets +
      totalLocalTransitCost;

    const budgetBreakdown: BudgetBreakdown = {
      transitRoundTrip: intercityTransit.estimatedPriceRoundTrip,
      accommodation: totalHotelCost,
      food: bottomUpFood,
      tickets: bottomUpTickets,
      localTransit: totalLocalTransitCost,
      totalEstimated,
    };

    // 7. Persist to Database (Itinerary & ItineraryDestination in an Atomic Transaction)
    let effectiveCreatorId = creatorId;
    if (!effectiveCreatorId) {
      const fallbackUser = await this.prisma.user.findFirst({ select: { id: true } });
      if (fallbackUser) {
        effectiveCreatorId = fallbackUser.id;
      } else {
        const bot = await this.prisma.user.create({
          data: {
            email: 'genie-bot@tripgenie.vn',
            fullName: 'TripGenie AI Bot',
            role: 'ADMIN',
          },
        });
        effectiveCreatorId = bot.id;
      }
    }

    const savedItinerary = await this.prisma.$transaction(async (tx) => {
      // Ensure all activities have a valid placeId in database within the destination Bounding Box
      for (const day of days) {
        for (const act of day.activities) {
          if (!act.placeId) {
            let existingPlace = await tx.place.findFirst({
              where: {
                name: { equals: act.placeName, mode: 'insensitive' },
                deletedAt: null,
                latitude: { gte: bbox.minLat, lte: bbox.maxLat },
                longitude: { gte: bbox.minLng, lte: bbox.maxLng },
              },
              select: { id: true },
            });
            if (!existingPlace) {
              existingPlace = await tx.place.create({
                data: {
                  name: act.placeName,
                  address: act.address || `${act.placeName}, ${dto.destinationCity}, Việt Nam`,
                  latitude: act.latitude ?? destLat,
                  longitude: act.longitude ?? destLng,
                  areaId: areaId || undefined,
                  status: 'ACTIVE',
                  ratingAvg: 4.6,
                  reviewCount: 18,
                },
                select: { id: true },
              });
            }
            act.placeId = existingPlace.id;
          }
        }
      }


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
          budgetLevel: budgetLevel as BudgetLevel,
          isAiGenerated: true,
          isPublic: true,
          totalPlaces: days.reduce((sum, d) => sum + d.activities.length, 0),
          aiPreferences: {
            originCity: dto.originCity,
            transitMode: intercityTransit.mode,
            intracityMode: dto.intracityMode,
            pace: dto.pace,
            travelStyles: dto.travelStyles,
            intercityTransit,
            budgetBreakdown,
            dayThemes: days.map((d) => d.theme),
            plannedDays: days,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // Bulk create destinations inside transaction
      const destinationsToCreate: Prisma.ItineraryDestinationCreateManyInput[] = [];
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
              estimatedCost: act.estimatedCost != null ? new Prisma.Decimal(act.estimatedCost) : null,
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

      return itin;
    });

    return this.getById(savedItinerary.id, effectiveCreatorId);
  }

  /**
   * Retrieve an itinerary in the same shape `generateItinerary` returns.
   */
  async getById(id: string, _requesterId?: string): Promise<ItineraryDetail> {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Itinerary with id "${id}" not found`);
    }
    return this.toDetail(row);
  }

  /**
   * Calculates realistic travel duration and mode between stops within a day in Vietnam cities.
   * - Under 0.8 km: Walking (4.5 km/h)
   * - Above 0.8 km: Motorbike (~25 km/h) or Car (~22 km/h) with 1.25x road detour factor + traffic buffer.
   */
  private computeIntracityTransit(
    distanceKm: number | null,
    intracityMode?: string | null,
  ): { durationMinutes: number | null; travelMode: 'WALK' | 'BIKE' | 'CAR' | null } {
    if (distanceKm == null || distanceKm <= 0) {
      return { durationMinutes: null, travelMode: null };
    }
    if (distanceKm <= 0.8) {
      return {
        durationMinutes: Math.max(2, Math.round((distanceKm / 4.5) * 60)),
        travelMode: 'WALK',
      };
    }
    const roadKm = distanceKm * 1.25;
    if (intracityMode === 'TAXI_CAR') {
      return {
        durationMinutes: Math.max(4, Math.round((roadKm / 22) * 60) + 3),
        travelMode: 'CAR',
      };
    }
    return {
      durationMinutes: Math.max(3, Math.round((roadKm / 25) * 60) + 2),
      travelMode: 'BIKE',
    };
  }

  private toDetail(row: ItineraryRow): ItineraryDetail {
    const stored = readStoredPlan(row.aiPreferences);
    const byDay = new Map<number, ItineraryActivity[]>();
    const rows = row.destinations;

    rows.forEach((dest, i) => {
      const next = rows[i + 1];
      const sameDayNext = next && next.dayNumber === dest.dayNumber ? next : null;
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

      const transitInfo = this.computeIntracityTransit(distanceToNextKm, (stored as any).intracityMode);
      const image = dest.place.images[0];
      const list = byDay.get(dest.dayNumber) ?? [];
      list.push({
        id: dest.id,
        placeId: dest.place.id,
        placeName: dest.place.name,
        startTime: formatTimeOfDay(dest.startTime),
        endTime: formatTimeOfDay(dest.endTime),
        durationMinutes: dest.estimatedDurationMinutes,
        visitOrder: Number(dest.visitOrder),
        notes: dest.notes,
        latitude: dest.place.latitude,
        longitude: dest.place.longitude,
        address: dest.place.address,
        imageUrl: image?.imageUrl ?? image?.thumbnailUrl ?? null,
        categoryName: dest.place.category?.nameVi ?? dest.place.category?.name ?? null,
        distanceToNextKm,
        durationToNextMinutes: transitInfo.durationMinutes,
        travelModeToNext: transitInfo.travelMode,
        ratingAvg: dest.place.ratingAvg ?? 4.6,
        reviewCount: dest.place.reviewCount ?? 120,
        priceLevel: dest.place.priceLevel ?? 'MEDIUM',
        priceRange: dest.place.priceRange ?? null,
        estimatedCost: dest.estimatedCost != null ? Number(dest.estimatedCost) : null,
        openingHours: dest.place.openingHours ?? null,
      });
      byDay.set(dest.dayNumber, list);
    });

    // If destination has 0 DB places, restore from stored.plannedDays
    if (byDay.size === 0 && stored.plannedDays && Array.isArray(stored.plannedDays)) {
      for (const pd of stored.plannedDays) {
        const acts: ItineraryActivity[] = (pd.activities || []).map((a, idx, arr) => {
          const nextAct = arr[idx + 1];
          let distanceToNextKm: number | null = null;
          if (nextAct && a.latitude && a.longitude && nextAct.latitude && nextAct.longitude) {
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
          const transitInfo = this.computeIntracityTransit(distanceToNextKm, (stored as any).intracityMode);

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
            categoryName: 'Điểm tham quan',
            distanceToNextKm,
            durationToNextMinutes: transitInfo.durationMinutes,
            travelModeToNext: transitInfo.travelMode,
            estimatedCost: a.estimatedCost ?? null,
          };
        });
        byDay.set(pd.dayNumber, acts);
      }
    }

    const spanDays =
      row.startDate && row.endDate
        ? Math.round((row.endDate.getTime() - row.startDate.getTime()) / MS_PER_DAY) + 1
        : 0;
    const totalDays = Math.max(spanDays, ...byDay.keys(), 1);

    const days: ItineraryDay[] = Array.from({ length: totalDays }, (_, i) => ({
      dayNumber: i + 1,
      theme: stored.dayThemes?.[i] ?? `Ngày ${i + 1}`,
      activities: byDay.get(i + 1) ?? [],
    }));

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      destination: row.destination,
      coverPhoto: (stored as any).coverPhoto || (stored as any).coverImage || null,
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      totalDays,
      budgetLevel: row.budgetLevel ?? 'MEDIUM',
      intercityTransit: stored.intercityTransit ?? null,
      budgetBreakdown: stored.budgetBreakdown ?? null,
      days,
    };
  }

  /**
   * List recent itineraries from database.
   */
  async listItineraries(_userId?: string): Promise<ItineraryDetail[]> {
    const rows = await this.prisma.itinerary.findMany({
      where: { deletedAt: null },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => this.toDetail(r));
  }

  /**
   * Soft-delete an itinerary.
   * Only marks deletedAt for this itinerary.
   * If other users or trips were cloned from this itinerary (clonedFromId),
   * their cloned itineraries remain 100% active and untouched.
   */
  async deleteItinerary(id: string, _requesterId?: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, creatorId: true },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy lịch trình hoặc lịch trình đã bị xóa.');
    }

    await this.prisma.itinerary.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  /**
   * Soft-delete multiple itineraries at once.
   * Only marks deletedAt for these itineraries.
   * Clones belonging to others remain untouched and preserved.
   */
  async bulkDeleteItineraries(ids: string[], _requesterId?: string): Promise<{ success: boolean; count: number }> {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await this.prisma.itinerary.updateMany({
      where: {
        id: { in: ids },
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
    const source = await this.prisma.itinerary.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });

    if (!source) {
      throw new NotFoundException('Không tìm thấy lịch trình để sao chép.');
    }

    let effectiveCreatorId = userId;
    if (!effectiveCreatorId) {
      const fallbackUser = await this.prisma.user.findFirst({ select: { id: true } });
      effectiveCreatorId = fallbackUser?.id || source.creatorId;
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
          aiPrompt: source.aiPrompt,
          aiPreferences: source.aiPreferences as any,
          status: 'DRAFT',
          isPublic: false,
          clonedFromId: source.id,
          totalPlaces: source.totalPlaces,
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
            travelDistanceMeters: d.travelDistanceMeters,
            travelDurationSeconds: d.travelDurationSeconds,
            notes: d.notes,
          })),
        });
      }

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

    const stored = readStoredPlan(row.aiPreferences);
    const originCity = (stored as any).originCity || 'Hồ Chí Minh';
    const destCity = row.destination || (stored as any).destCity || 'Đà Nẵng';
    const departDate =
      row.startDate?.toISOString().slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    const returnDate = row.endDate?.toISOString().slice(0, 10) || undefined;

    // Recalculate intercity transit with new mode
    const intercityTransit = await this.transitService.calculateIntercityTransit({
      originCity,
      destCity,
      transitMode: newTransitMode,
      departDate,
      returnDate,
    });

    // Recalculate budget breakdown with updated round-trip transit price
    const oldBreakdown = stored.budgetBreakdown;
    const accommodation = oldBreakdown?.accommodation ?? 0;
    const food = oldBreakdown?.food ?? 0;
    const tickets = oldBreakdown?.tickets ?? 0;
    const localTransit = oldBreakdown?.localTransit ?? 0;
    const transitRoundTrip = intercityTransit.estimatedPriceRoundTrip;
    const totalEstimated =
      transitRoundTrip + accommodation + food + tickets + localTransit;

    const budgetBreakdown: BudgetBreakdown = {
      transitRoundTrip,
      accommodation,
      food,
      tickets,
      localTransit,
      totalEstimated,
    };

    const updatedAiPreferences = {
      ...(typeof row.aiPreferences === 'object' && row.aiPreferences !== null
        ? row.aiPreferences
        : {}),
      transitMode: newTransitMode,
      intercityTransit,
      budgetBreakdown,
    };

    await this.prisma.itinerary.update({
      where: { id },
      data: {
        totalBudget: totalEstimated,
        estimatedCost: totalEstimated,
        aiPreferences: updatedAiPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getById(id, userId);
  }

  /**
   * Update the cover photo of an itinerary.
   */
  async updateCoverPhoto(id: string, coverPhoto: string, userId?: string) {
    const row = await this.prisma.itinerary.findUnique({
      where: { id },
      select: { id: true, aiPreferences: true },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy lịch trình hoặc lịch trình đã bị xóa.');
    }

    const currentAiPreferences =
      typeof row.aiPreferences === 'object' && row.aiPreferences !== null
        ? (row.aiPreferences as Record<string, unknown>)
        : {};

    await this.prisma.itinerary.update({
      where: { id },
      data: {
        aiPreferences: {
          ...currentAiPreferences,
          coverPhoto,
          coverImage: coverPhoto,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getById(id, userId);
  }
}

/** aiPreferences is untyped JSON in the DB; accept only an object, fields are optional. */
function readStoredPlan(json: Prisma.JsonValue): Partial<StoredPlan> {
  return json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Partial<StoredPlan>)
    : {};
}
