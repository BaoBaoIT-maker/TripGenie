import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AlternativePlaceItem,
  CopilotToolExecutionResult,
  COPILOT_CONSTANTS,
  COPILOT_TOOL_NAMES,
} from './copilot.types';
import {
  parseTimeOfDay,
  formatTimeOfDay,
  resolveNonOverlappingTimeSlot,
} from '../../../common/utils/time-of-day.util';
import { calculatePlaceEstimatedCost } from '../../../config/pricing.config';

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

const QUERY_FILLER_REGEX = /\b(đi|nhé|nha|ạ|giúp tôi|cho tôi|với|nhá|nè|luôn)\b/gi;
const VENUE_PREFIX_REGEX = /^(quán ăn|nhà hàng|quán|tiệm|khu du lịch|điểm tham quan|địa điểm|chỗ)\s+/i;
const COMMAND_STOP_WORDS = new Set([
  'đổi',
  'sang',
  'thay',
  'bằng',
  'chỗ',
  'quán',
  'điểm',
  'ngày',
  'thêm',
  'vào',
]);
const FOOD_CATEGORY_SLUGS = new Set(['nha-hang', 'ca-phe', 'an-vat-via-he', 'bar-pub']);

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

@Injectable()
export class CopilotToolsService {
  private readonly logger = new Logger(CopilotToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fast DB query for alternative places (Hybrid model 1-click swap on Card).
   * Runs directly against Postgres without calling LLM.
   */
  async getAlternativesForActivity(
    itineraryId: string,
    activityId: string,
    limit: number = COPILOT_CONSTANTS.DEFAULT_ALTERNATIVES_LIMIT,
  ): Promise<AlternativePlaceItem[]> {
    const activity = await this.prisma.itineraryDestination.findFirst({
      where: { id: activityId, itineraryId },
      include: {
        place: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Không tìm thấy hoạt động trong lịch trình.');
    }

    const currentPlace = activity.place;
    const bbox = await this.resolveItineraryBbox(
      itineraryId,
      currentPlace.latitude,
      currentPlace.longitude,
    );

    const existingDestinations = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId },
      select: { placeId: true },
    });
    const excludedPlaceIds = new Set(existingDestinations.map((d) => d.placeId));

    let candidates = await this.prisma.place.findMany({
      where: {
        id: { notIn: Array.from(excludedPlaceIds) },
        deletedAt: null,
        status: 'ACTIVE',
        categoryId: currentPlace.categoryId ?? undefined,
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      },
      include: {
        category: true,
        images: { where: { isPrimary: true }, take: 1 },
      },
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
      take: limit,
    });

    if (candidates.length < limit) {
      const more = await this.prisma.place.findMany({
        where: {
          id: { notIn: [...Array.from(excludedPlaceIds), ...candidates.map((c) => c.id)] },
          deletedAt: null,
          status: 'ACTIVE',
          latitude: { gte: bbox.minLat, lte: bbox.maxLat },
          longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        },
        include: {
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: limit - candidates.length,
      });
      candidates = [...candidates, ...more];
    }

    return candidates.map((p) => {
      const dist = this.haversineDistance(
        currentPlace.latitude,
        currentPlace.longitude,
        p.latitude,
        p.longitude,
      );
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        ratingAvg: Number(p.ratingAvg ?? COPILOT_CONSTANTS.DEFAULT_RATING_FALLBACK),
        reviewCount: p.reviewCount ?? 0,
        priceLevel: p.priceLevel ? String(p.priceLevel) : null,
        imageUrl: p.images[0]?.imageUrl ?? null,
        categoryName: p.category?.nameVi ?? p.category?.name ?? 'Địa điểm',
        distanceKm: Math.round(dist * 10) / 10,
      };
    });
  }

  /**
   * Direct 1-click swap on Card (Hybrid model).
   */
  async swapActivityDirect(
    itineraryId: string,
    activityId: string,
    newPlaceId: string,
  ): Promise<void> {
    const activity = await this.prisma.itineraryDestination.findFirst({
      where: { id: activityId, itineraryId },
      include: { place: true },
    });
    if (!activity) {
      throw new NotFoundException('Không tìm thấy hoạt động trong lịch trình.');
    }

    const newPlace = await this.prisma.place.findFirst({
      where: { id: newPlaceId, deletedAt: null },
      include: { category: true },
    });
    if (!newPlace) {
      throw new NotFoundException('Không tìm thấy địa điểm thay thế.');
    }

    await this.persistActivitySwap(
      activityId,
      newPlace,
      `Đã đổi từ ${activity.place.name} sang ${newPlace.name}.`,
    );
  }

  /**
   * Tool: swap_activity — LLM Agent Function Calling.
   */
  async swapActivity(
    itineraryId: string,
    args: {
      dayNumber?: number;
      currentPlaceName?: string;
      mealOrActivityType?: string;
      query: string;
      categorySlug?: string;
      destinationId?: string;
      newPlaceId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const {
      dayNumber,
      currentPlaceName,
      mealOrActivityType,
      query,
      categorySlug,
      destinationId,
      newPlaceId,
      dryRun,
    } = args;

    // Direct ID swap path (when user confirms a proposal)
    if (destinationId && newPlaceId) {
      const target = await this.prisma.itineraryDestination.findFirst({
        where: { id: destinationId, itineraryId },
        include: { place: { include: { category: true } } },
      });
      const newPlace = await this.prisma.place.findUnique({
        where: { id: newPlaceId },
        include: { category: true },
      });
      if (target && newPlace) {
        if (!dryRun) {
          await this.persistActivitySwap(
            target.id,
            newPlace,
            `Đã đổi sang ${newPlace.name} theo yêu cầu: "${query}".`,
          );
        }
        return {
          toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
          success: true,
          message: `Đã đổi thành công địa điểm Ngày ${target.dayNumber} từ "${target.place.name}" sang "${newPlace.name}".`,
          data: {
            dayNumber: target.dayNumber,
            oldPlaceName: target.place.name,
            newPlaceName: newPlace.name,
            address: newPlace.address,
          },
        };
      }
    }

    // 1. Fetch all activities across the entire itinerary to enable global matching
    const allActivities = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId },
      include: { place: { include: { category: true } } },
      orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
    });

    if (allActivities.length === 0) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
        success: false,
        message: 'Lịch trình hiện chưa có hoạt động nào để đổi.',
      };
    }

    const target = this.resolveTargetActivity(allActivities, {
      dayNumber,
      currentPlaceName,
      mealOrActivityType,
      query,
      categorySlug,
    });

    // 2. Resolve best replacement place in Bounding Box using shared DRY resolver
    const bbox = await this.resolveItineraryBbox(
      itineraryId,
      target.place.latitude,
      target.place.longitude,
    );
    const existingPlaceIds = allActivities.map((d) => d.placeId);

    const newPlace = await this.resolveCandidatePlace({
      query,
      bbox,
      existingPlaceIds,
      preferredCategoryId: target.place.categoryId,
      preferredCategorySlug: categorySlug || target.place.category?.slug,
      allowRevisitExisting: false,
    });

    if (!newPlace) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm nào phù hợp với yêu cầu "${query}" tại khu vực này.`,
      };
    }

    const resolvedDayNumber = target.dayNumber;

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
        success: true,
        message: `Đề xuất đổi địa điểm Ngày ${resolvedDayNumber} từ "${target.place.name}" sang "${newPlace.name}" (${Number(newPlace.ratingAvg || COPILOT_CONSTANTS.DEFAULT_RATING_FALLBACK).toFixed(1)}★).`,
        data: {
          dayNumber: resolvedDayNumber,
          oldPlaceId: target.place.id,
          oldPlaceName: target.place.name,
          oldPlaceCoordinates: {
            latitude: Number(target.place.latitude),
            longitude: Number(target.place.longitude),
          },
          newPlaceId: newPlace.id,
          newPlaceName: newPlace.name,
          newPlaceRating: newPlace.ratingAvg,
          newPlaceCategory: newPlace.category?.nameVi || newPlace.category?.name,
          newPlaceAddress: newPlace.address,
          newPlaceCoordinates: {
            latitude: Number(newPlace.latitude),
            longitude: Number(newPlace.longitude),
          },
          args: {
            destinationId: target.id,
            newPlaceId: newPlace.id,
            dayNumber: resolvedDayNumber,
            query,
          },
        },
      };
    }

    await this.persistActivitySwap(
      target.id,
      newPlace,
      `Đã đổi sang ${newPlace.name} theo yêu cầu: "${query}".`,
    );

    return {
      toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
      success: true,
      message: `Đã đổi thành công địa điểm ngày ${resolvedDayNumber} từ "${target.place.name}" sang "${newPlace.name}".`,
      data: {
        dayNumber: resolvedDayNumber,
        oldPlaceName: target.place.name,
        newPlaceName: newPlace.name,
        address: newPlace.address,
      },
    };
  }

  /**
   * Tool: add_activity — LLM Agent Function Calling.
   */
  async addActivity(
    itineraryId: string,
    args: {
      dayNumber: number;
      timeSlot?: string;
      query: string;
      categorySlug?: string;
      placeId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { dayNumber, timeSlot, query, categorySlug, placeId, dryRun } = args;

    let place = placeId
      ? await this.prisma.place.findUnique({
          where: { id: placeId },
          include: { category: true },
        })
      : null;

    if (!place) {
      const bbox = await this.resolveItineraryBbox(itineraryId);
      const existingPlaceIds = (
        await this.prisma.itineraryDestination.findMany({
          where: { itineraryId },
          select: { placeId: true },
        })
      ).map((d) => d.placeId);

      place = await this.resolveCandidatePlace({
        query,
        bbox,
        existingPlaceIds,
        preferredCategorySlug: categorySlug,
        allowRevisitExisting: true,
      });
    }

    if (!place) {
      return {
        toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm phù hợp để thêm vào ngày ${dayNumber}.`,
      };
    }

    const existingInSameDay = await this.prisma.itineraryDestination.findFirst({
      where: { itineraryId, dayNumber, placeId: place.id },
    });
    if (existingInSameDay) {
      return {
        toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
        success: false,
        message: `Địa điểm "${place.name}" đã có trong Ngày ${dayNumber} của lịch trình.`,
      };
    }

    const dayActivities = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId, dayNumber },
      orderBy: [{ startTime: 'asc' }, { visitOrder: 'asc' }],
    });

    const baseSlot = this.resolveTimeSlotRange(timeSlot);
    const {
      start: startTimeStr,
      end: endTimeStr,
      durationMinutes,
    } = resolveNonOverlappingTimeSlot(baseSlot, dayActivities);

    const isRevisit =
      (await this.prisma.itineraryDestination.findFirst({
        where: { itineraryId, placeId: place.id },
      })) !== null;

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
        success: true,
        message: `Đề xuất thêm "${place.name}"${isRevisit ? ' (ghé lại)' : ''} (${Number(place.ratingAvg || COPILOT_CONSTANTS.DEFAULT_RATING_FALLBACK).toFixed(1)}★) vào Ngày ${dayNumber} (${startTimeStr} - ${endTimeStr}).`,
        data: {
          dayNumber,
          placeName: place.name,
          newPlaceId: place.id,
          newPlaceName: place.name,
          newPlaceRating: place.ratingAvg,
          newPlaceCategory: place.category?.nameVi || place.category?.name,
          newPlaceAddress: place.address,
          newPlaceCoordinates: {
            latitude: Number(place.latitude),
            longitude: Number(place.longitude),
          },
          args: {
            dayNumber,
            placeId: place.id,
            query,
            timeSlot,
          },
        },
      };
    }

    const maxOrder = dayActivities.reduce(
      (max, item) => Math.max(max, item.visitOrder ? Number(item.visitOrder) : 0),
      0,
    );
    const nextOrder = maxOrder + 1;
    const { cost: estimatedCost } = calculatePlaceEstimatedCost({
      category: place.category,
      priceRange: place.priceRange,
      priceLevel: place.priceLevel,
      placeName: place.name,
    });

    await this.prisma.itineraryDestination.create({
      data: {
        itineraryId,
        placeId: place.id,
        dayNumber,
        visitOrder: new Prisma.Decimal(nextOrder),
        startTime: parseTimeOfDay(startTimeStr),
        endTime: parseTimeOfDay(endTimeStr),
        estimatedDurationMinutes: durationMinutes,
        estimatedCost: new Prisma.Decimal(estimatedCost),
        notes: `Được thêm vào ngày ${dayNumber}${isRevisit ? ' (ghé lại)' : ''}: ${query}`,
      },
    });

    await this.prisma.itinerary.update({
      where: { id: itineraryId },
      data: { totalPlaces: { increment: 1 } },
    });

    return {
      toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
      success: true,
      message: `Đã thêm "${place.name}"${isRevisit ? ' (ghé lại)' : ''} vào ngày ${dayNumber} (${startTimeStr} - ${endTimeStr}).`,
      data: {
        dayNumber,
        placeName: place.name,
        startTime: startTimeStr,
        endTime: endTimeStr,
      },
    };
  }

  /**
   * Tool: remove_activity — LLM Agent Function Calling.
   */
  async removeActivity(
    itineraryId: string,
    args: {
      dayNumber: number;
      placeName: string;
      destinationId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { dayNumber, placeName, destinationId, dryRun } = args;

    const matches = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId, dayNumber },
      include: { place: true },
    });

    const target = destinationId
      ? matches.find((m) => m.id === destinationId)
      : matches.find((m) =>
          normalizeVietnamese(m.place.name).includes(normalizeVietnamese(placeName)),
        );

    if (!target) {
      return {
        toolName: COPILOT_TOOL_NAMES.REMOVE_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm "${placeName}" trong ngày ${dayNumber} để xóa.`,
      };
    }

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.REMOVE_ACTIVITY,
        success: true,
        message: `Đề xuất xóa hoạt động "${target.place.name}" khỏi Ngày ${dayNumber}.`,
        data: {
          dayNumber,
          oldPlaceName: target.place.name,
          placeName: target.place.name,
          args: {
            dayNumber,
            placeName: target.place.name,
            destinationId: target.id,
          },
        },
      };
    }

    await this.prisma.itineraryDestination.delete({
      where: { id: target.id },
    });

    await this.prisma.itinerary.update({
      where: { id: itineraryId },
      data: { totalPlaces: { decrement: 1 } },
    });

    return {
      toolName: COPILOT_TOOL_NAMES.REMOVE_ACTIVITY,
      success: true,
      message: `Đã xóa hoạt động "${target.place.name}" khỏi ngày ${dayNumber}.`,
      data: {
        dayNumber,
        removedPlaceName: target.place.name,
      },
    };
  }

  /**
   * Tool: move_activity — LLM Agent Function Calling.
   */
  async moveActivity(
    itineraryId: string,
    args: {
      placeName: string;
      fromDay: number;
      toDay: number;
      targetTimeSlot?: string;
      destinationId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { placeName, fromDay, toDay, destinationId, dryRun } = args;

    const matches = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId, dayNumber: fromDay },
      include: { place: true },
    });

    const target = destinationId
      ? matches.find((m) => m.id === destinationId)
      : matches.find((m) =>
          normalizeVietnamese(m.place.name).includes(normalizeVietnamese(placeName)),
        );

    if (!target) {
      return {
        toolName: COPILOT_TOOL_NAMES.MOVE_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm "${placeName}" ở ngày ${fromDay} để chuyển.`,
      };
    }

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.MOVE_ACTIVITY,
        success: true,
        message: `Đề xuất chuyển "${target.place.name}" từ Ngày ${fromDay} sang Ngày ${toDay}.`,
        data: {
          placeName: target.place.name,
          fromDay,
          toDay,
          args: {
            placeName: target.place.name,
            fromDay,
            toDay,
            destinationId: target.id,
          },
        },
      };
    }

    const toDayDestinations = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId, dayNumber: toDay },
      orderBy: [{ startTime: 'asc' }, { visitOrder: 'asc' }],
    });
    const maxOrder = toDayDestinations.reduce(
      (max, item) => Math.max(max, item.visitOrder ? Number(item.visitOrder) : 0),
      0,
    );
    const nextOrder = maxOrder + 1;
    const baseMoveSlot = args.targetTimeSlot
      ? this.resolveTimeSlotRange(args.targetTimeSlot)
      : {
          start: formatTimeOfDay(target.startTime) || COPILOT_CONSTANTS.TIME_SLOTS.AFTERNOON.start,
          end: formatTimeOfDay(target.endTime) || COPILOT_CONSTANTS.TIME_SLOTS.AFTERNOON.end,
        };
    const {
      start: movedStartStr,
      end: movedEndStr,
      durationMinutes: movedDuration,
    } = resolveNonOverlappingTimeSlot(baseMoveSlot, toDayDestinations);

    await this.prisma.itineraryDestination.update({
      where: { id: target.id },
      data: {
        dayNumber: toDay,
        visitOrder: new Prisma.Decimal(nextOrder),
        startTime: parseTimeOfDay(movedStartStr),
        endTime: parseTimeOfDay(movedEndStr),
        estimatedDurationMinutes: movedDuration,
        notes: `Đã dời từ ngày ${fromDay} sang ngày ${toDay} (${movedStartStr} - ${movedEndStr}).`,
      },
    });

    return {
      toolName: COPILOT_TOOL_NAMES.MOVE_ACTIVITY,
      success: true,
      message: `Đã chuyển "${target.place.name}" từ ngày ${fromDay} sang ngày ${toDay}.`,
      data: {
        placeName: target.place.name,
        fromDay,
        toDay,
      },
    };
  }

  /**
   * Tool: swap_days — LLM Agent Function Calling.
   */
  async swapDays(
    itineraryId: string,
    args: {
      dayA: number;
      dayB: number;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { dayA, dayB, dryRun } = args;
    if (dayA === dayB) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_DAYS,
        success: false,
        message: 'Ngày muốn đổi giống nhau.',
      };
    }

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_DAYS,
        success: true,
        message: `Đề xuất hoán đổi toàn bộ lịch trình giữa Ngày ${dayA} và Ngày ${dayB}.`,
        data: {
          dayA,
          dayB,
          args: { dayA, dayB },
        },
      };
    }

    const tempDay = COPILOT_CONSTANTS.SWAP_TEMP_DAY_NUMBER;
    await this.prisma.$transaction(async (tx) => {
      await tx.itineraryDestination.updateMany({
        where: { itineraryId, dayNumber: dayA },
        data: { dayNumber: tempDay },
      });
      await tx.itineraryDestination.updateMany({
        where: { itineraryId, dayNumber: dayB },
        data: { dayNumber: dayA },
      });
      await tx.itineraryDestination.updateMany({
        where: { itineraryId, dayNumber: tempDay },
        data: { dayNumber: dayB },
      });
    });

    return {
      toolName: COPILOT_TOOL_NAMES.SWAP_DAYS,
      success: true,
      message: `Đã hoán đổi toàn bộ lịch trình giữa Ngày ${dayA} và Ngày ${dayB}.`,
      data: { dayA, dayB },
    };
  }

  // ===========================================================================
  // PRIVATE PLACE RESOLUTION & GEOGRAPHIC HELPERS (SRP & DRY)
  // ===========================================================================

  private resolveTargetActivity<
    T extends {
      dayNumber: number;
      startTime: Date | null;
      place: {
        name: string;
        category?: { name: string; nameVi?: string | null; slug?: string } | null;
      };
    },
  >(
    allActivities: T[],
    criteria: {
      dayNumber?: number;
      currentPlaceName?: string;
      mealOrActivityType?: string;
      query: string;
      categorySlug?: string;
    },
  ): T {
    const { dayNumber, currentPlaceName, mealOrActivityType, query, categorySlug } = criteria;
    const isFoodSwap =
      (categorySlug ? FOOD_CATEGORY_SLUGS.has(categorySlug) : false) ||
      /sáng|trưa|tối|breakfast|lunch|dinner|cafe/i.test((mealOrActivityType || '').toLowerCase()) ||
      /ăn|hải sản|cơm|bún|mì|phở|lẩu|bánh|quán|nhà hàng|cafe|cà phê|nướng/i.test(
        query.toLowerCase(),
      );

    const isFoodActivity = (a: T) =>
      (a.place.category?.slug ? FOOD_CATEGORY_SLUGS.has(a.place.category.slug) : false) ||
      /ăn|nhà hàng|ẩm thực|quán|cafe|cà phê|restaurant|food|street/i.test(
        (a.place.category?.nameVi || a.place.category?.name || '').toLowerCase(),
      );

    if (currentPlaceName) {
      const normCurrent = normalizeVietnamese(currentPlaceName);
      const exactMatch = allActivities.find((a) => {
        const normPlace = normalizeVietnamese(a.place.name);
        return normPlace.includes(normCurrent) || normCurrent.includes(normPlace);
      });
      if (exactMatch && (!isFoodSwap || isFoodActivity(exactMatch))) return exactMatch;

      const keywords = normCurrent.split(/[\s,()/-]+/).filter((w) => w.length >= 3);
      if (keywords.length > 0) {
        const overlapMatch = allActivities.find((a) => {
          const normPlace = normalizeVietnamese(a.place.name);
          return keywords.some((kw) => normPlace.includes(kw));
        });
        if (overlapMatch && (!isFoodSwap || isFoodActivity(overlapMatch))) return overlapMatch;
      }
    }

    const dayMatches = dayNumber
      ? allActivities.filter((a) => a.dayNumber === dayNumber)
      : allActivities;
    const pool = dayMatches.length > 0 ? dayMatches : allActivities;

    if (mealOrActivityType) {
      const typeLow = mealOrActivityType.toLowerCase();
      const byMealType = pool.find((a) => {
        if (typeLow.includes('cafe')) {
          return (
            a.place.category?.slug === 'ca-phe' ||
            a.place.category?.name.toLowerCase().includes('cafe')
          );
        }
        const timeStr = formatTimeOfDay(a.startTime);
        if (!timeStr) return false;
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (typeLow.includes('sáng') || typeLow.includes('breakfast')) return hour < 11;
        if (typeLow.includes('trưa') || typeLow.includes('lunch')) return hour >= 11 && hour < 14;
        if (typeLow.includes('tối') || typeLow.includes('dinner')) return hour >= 17;
        return false;
      });
      if (byMealType) return byMealType;
    }

    if (isFoodSwap) {
      const foodTarget = pool.find(isFoodActivity);
      if (foodTarget) return foodTarget;
    }

    return pool[0];
  }

  /**
   * Shared place resolution pipeline used by both `swapActivity` and `addActivity`:
   * 1. Exact/core phrase match (accented `name` + unaccented `nameNormalized`, address, tags, category)
   * 2. Multi-keyword `AND` match on `name` or `nameNormalized`
   * 3. Relevance-scored `OR` match with category affinity guard
   * 4. Category fallback within Bounding Box (never pollutes master `places` table with fake random records)
   */
  private async resolveCandidatePlace(params: {
    query: string;
    bbox: BoundingBox;
    existingPlaceIds: string[];
    preferredCategoryId?: number | null;
    preferredCategorySlug?: string | null;
    allowRevisitExisting: boolean;
  }) {
    const {
      query,
      bbox,
      existingPlaceIds,
      preferredCategoryId,
      preferredCategorySlug,
      allowRevisitExisting,
    } = params;

    const cleanQuery = query.replace(/[.,!?]/g, ' ').replace(QUERY_FILLER_REGEX, '').trim();
    const searchQuery = cleanQuery || query.trim();
    const corePhrase = searchQuery.replace(VENUE_PREFIX_REGEX, '').trim() || searchQuery;
    const normPhrase = normalizeVietnamese(corePhrase);

    const baseWhere: Prisma.PlaceWhereInput = {
      id: { notIn: existingPlaceIds },
      deletedAt: null,
      status: 'ACTIVE',
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };

    // Stage 1: Phrase match (accented name, unaccented nameNormalized, address, tags, category)
    const phraseCandidates = await this.prisma.place.findMany({
      where: {
        ...baseWhere,
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { name: { contains: corePhrase, mode: 'insensitive' } },
          { nameNormalized: { contains: normPhrase, mode: 'insensitive' } },
          { address: { contains: corePhrase, mode: 'insensitive' } },
          { tags: { has: corePhrase.toLowerCase() } },
          { category: { name: { contains: corePhrase, mode: 'insensitive' } } },
          { category: { nameVi: { contains: corePhrase, mode: 'insensitive' } } },
        ],
      },
      include: { category: true },
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
      take: 1,
    });
    if (phraseCandidates[0]) return phraseCandidates[0];

    // Extract substantive keywords (both original and unaccented)
    const keywords = corePhrase
      .split(/[\s,()/-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !COMMAND_STOP_WORDS.has(w.toLowerCase()));
    const normKeywords = keywords.map(normalizeVietnamese);

    if (keywords.length > 0) {
      // Stage 2: Strict multi-keyword AND match (supports both accented and unaccented input)
      const andCandidates = await this.prisma.place.findMany({
        where: {
          ...baseWhere,
          OR: [
            { AND: keywords.map((k) => ({ name: { contains: k, mode: 'insensitive' } })) },
            {
              AND: normKeywords.map((nk) => ({
                nameNormalized: { contains: nk, mode: 'insensitive' },
              })),
            },
          ],
        },
        include: { category: true },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: 1,
      });
      if (andCandidates[0]) return andCandidates[0];

      // Stage 3: Relevance-scored OR match with category affinity guard
      // ponytail: In-memory scoring over top 20 bbox candidates (ceiling: 20 rows; upgrade path: Postgres pg_trgm similarity index if bbox pool exceeds 10k places).
      const orPool = await this.prisma.place.findMany({
        where: {
          ...baseWhere,
          OR: [
            ...keywords.map((k) => ({ name: { contains: k, mode: 'insensitive' as const } })),
            ...normKeywords.map((nk) => ({
              nameNormalized: { contains: nk, mode: 'insensitive' as const },
            })),
          ],
        },
        include: { category: true },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
        take: COPILOT_CONSTANTS.CANDIDATE_POOL_SIZE,
      });

      const scored = orPool
        .map((candidate) => {
          const normCandidateName = normalizeVietnamese(
            candidate.nameNormalized || candidate.name,
          );
          const matchedCount = normKeywords.filter((nk) =>
            normCandidateName.includes(nk),
          ).length;
          const sameCategory =
            (Boolean(preferredCategorySlug) &&
              candidate.category?.slug === preferredCategorySlug) ||
            (Boolean(preferredCategoryId) && candidate.categoryId === preferredCategoryId);
          const score =
            matchedCount * COPILOT_CONSTANTS.KEYWORD_MATCH_WEIGHT +
            (sameCategory ? COPILOT_CONSTANTS.CATEGORY_AFFINITY_WEIGHT : 0) +
            Number(candidate.ratingAvg ?? 0);
          return { candidate, matchedCount, sameCategory, score };
        })
        .filter(
          (item) =>
            item.matchedCount >= 2 ||
            (item.matchedCount >= 1 &&
              (!preferredCategoryId && !preferredCategorySlug ? true : item.sameCategory)),
        )
        .sort((a, b) => b.score - a.score);

      if (scored[0]) return scored[0].candidate;
    }

    // Stage 4: Allow revisiting an already-scheduled place in DB when adding
    if (allowRevisitExisting) {
      const existingMatch = await this.prisma.place.findFirst({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          latitude: { gte: bbox.minLat, lte: bbox.maxLat },
          longitude: { gte: bbox.minLng, lte: bbox.maxLng },
          OR: [
            { name: { contains: corePhrase, mode: 'insensitive' } },
            { nameNormalized: { contains: normPhrase, mode: 'insensitive' } },
            { address: { contains: corePhrase, mode: 'insensitive' } },
          ],
        },
        include: { category: true },
        orderBy: [{ ratingAvg: 'desc' }],
      });
      if (existingMatch) return existingMatch;
    }

    // Stage 5: Category fallback within Bounding Box (clean DB-grounded fallback, zero fake data creation)
    const fallbackCandidates = await this.prisma.place.findMany({
      where: {
        ...baseWhere,
        ...(preferredCategorySlug
          ? { category: { slug: preferredCategorySlug } }
          : preferredCategoryId
            ? { categoryId: preferredCategoryId }
            : {}),
      },
      include: { category: true },
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
      take: 1,
    });
    return fallbackCandidates[0] ?? null;
  }

  private async persistActivitySwap(
    destinationId: string,
    newPlace: {
      id: string;
      name: string;
      category?: { name?: string | null; nameVi?: string | null; slug?: string | null } | null;
      priceRange?: unknown;
      priceLevel?: string | null;
    },
    notes: string,
  ): Promise<void> {
    const { cost: newEstimatedCost } = calculatePlaceEstimatedCost({
      category: newPlace.category,
      priceRange: newPlace.priceRange,
      priceLevel: newPlace.priceLevel,
      placeName: newPlace.name,
    });

    await this.prisma.itineraryDestination.update({
      where: { id: destinationId },
      data: {
        placeId: newPlace.id,
        estimatedCost: new Prisma.Decimal(newEstimatedCost),
        notes,
      },
    });
  }

  private resolveTimeSlotRange(timeSlot?: string): { start: string; end: string } {
    const slot = (timeSlot || '').toLowerCase();
    const matched = COPILOT_CONSTANTS.TIME_SLOT_ALIASES.find((rule) =>
      rule.keywords.some((kw) => slot.includes(kw)),
    );
    return matched
      ? COPILOT_CONSTANTS.TIME_SLOTS[matched.slot]
      : COPILOT_CONSTANTS.TIME_SLOTS.AFTERNOON;
  }

  private async resolveItineraryBbox(
    itineraryId: string,
    fallbackLat?: number,
    fallbackLng?: number,
  ): Promise<BoundingBox> {
    if (fallbackLat && fallbackLng) {
      return this.computeBboxAround(
        fallbackLat,
        fallbackLng,
        COPILOT_CONSTANTS.DEFAULT_BOUNDING_RADIUS_KM,
      );
    }

    // 1. Check TravelArea bounding box configured in DB for this itinerary
    const itineraryWithArea = await this.prisma.itinerary.findUnique({
      where: { id: itineraryId },
      select: {
        area: {
          select: {
            bboxMinLat: true,
            bboxMaxLat: true,
            bboxMinLng: true,
            bboxMaxLng: true,
          },
        },
      },
    });
    const areaBbox = itineraryWithArea?.area;
    if (
      areaBbox?.bboxMinLat != null &&
      areaBbox?.bboxMaxLat != null &&
      areaBbox?.bboxMinLng != null &&
      areaBbox?.bboxMaxLng != null
    ) {
      return {
        minLat: areaBbox.bboxMinLat,
        maxLat: areaBbox.bboxMaxLat,
        minLng: areaBbox.bboxMinLng,
        maxLng: areaBbox.bboxMaxLng,
        centerLat: (areaBbox.bboxMinLat + areaBbox.bboxMaxLat) / 2,
        centerLng: (areaBbox.bboxMinLng + areaBbox.bboxMaxLng) / 2,
      };
    }

    // 2. Compute center from existing scheduled activities
    const activities = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId },
      include: { place: { select: { latitude: true, longitude: true } } },
      take: 5,
    });

    if (activities.length > 0) {
      const avgLat = activities.reduce((acc, a) => acc + a.place.latitude, 0) / activities.length;
      const avgLng = activities.reduce((acc, a) => acc + a.place.longitude, 0) / activities.length;
      return this.computeBboxAround(avgLat, avgLng, COPILOT_CONSTANTS.DEFAULT_BOUNDING_RADIUS_KM);
    }

    return this.computeBboxAround(
      COPILOT_CONSTANTS.DEFAULT_CENTER_LAT,
      COPILOT_CONSTANTS.DEFAULT_CENTER_LNG,
      COPILOT_CONSTANTS.DEFAULT_BOUNDING_RADIUS_KM,
    );
  }

  private computeBboxAround(lat: number, lng: number, radiusKm: number): BoundingBox {
    const deltaLat = radiusKm / 111;
    const deltaLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    return {
      minLat: lat - deltaLat,
      maxLat: lat + deltaLat,
      minLng: lng - deltaLng,
      maxLng: lng + deltaLng,
      centerLat: lat,
      centerLng: lng,
    };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return COPILOT_CONSTANTS.EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
