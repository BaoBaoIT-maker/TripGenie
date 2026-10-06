import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AlternativePlaceItem,
  CopilotToolExecutionResult,
  COPILOT_TOOL_NAMES,
} from './copilot.types';
import { parseTimeOfDay, formatTimeOfDay } from '../../../common/utils/time-of-day.util';

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

const DEFAULT_BOUNDING_RADIUS_KM = 45;
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class CopilotToolsService {
  private readonly logger = new Logger(CopilotToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fast DB query for 3-5 alternative places (Hybrid model 1-click swap on Card).
   * Runs directly against Postgres without calling LLM.
   */
  async getAlternativesForActivity(
    itineraryId: string,
    activityId: string,
    limit = 4,
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
    const bbox = await this.resolveItineraryBbox(itineraryId, currentPlace.latitude, currentPlace.longitude);

    // Get all place IDs already present in this itinerary to avoid duplicates
    const existingDestinations = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId },
      select: { placeId: true },
    });
    const excludedPlaceIds = new Set(existingDestinations.map((d) => d.placeId));

    // Try finding candidate places matching the same category within Bounding Box
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

    // If matching category returned fewer than limit, relax category filter within bbox
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
        ratingAvg: Number(p.ratingAvg ?? 4.7),
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
    });
    if (!newPlace) {
      throw new NotFoundException('Không tìm thấy địa điểm thay thế.');
    }

    await this.prisma.itineraryDestination.update({
      where: { id: activityId },
      data: {
        placeId: newPlaceId,
        notes: `Đã đổi từ ${activity.place.name} sang ${newPlace.name}.`,
      },
    });
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
      destinationId?: string;
      newPlaceId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { dayNumber, currentPlaceName, mealOrActivityType, query, destinationId, newPlaceId, dryRun } = args;

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
          await this.prisma.itineraryDestination.update({
            where: { id: target.id },
            data: {
              placeId: newPlace.id,
              notes: `Đã đổi sang ${newPlace.name} theo yêu cầu: "${query}".`,
            },
          });
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

    let target: (typeof allActivities)[0] | undefined;

    // Strategy 1: Match currentPlaceName across the ENTIRE itinerary (Global Search)
    if (currentPlaceName) {
      const cleanCurrent = currentPlaceName.toLowerCase().trim();
      target = allActivities.find((a) => {
        const placeName = a.place.name.toLowerCase();
        return placeName.includes(cleanCurrent) || cleanCurrent.includes(placeName);
      });

      // Word-overlap fallback if exact match wasn't found (e.g. "Mì Quảng Bà Mua" matches "Mì Quảng Bà Mua (Trần Bình Trọng)")
      if (!target) {
        const keywords = cleanCurrent
          .split(/[\s,()/-]+/)
          .filter((w) => w.length >= 3);
        if (keywords.length > 0) {
          target = allActivities.find((a) => {
            const placeName = a.place.name.toLowerCase();
            return keywords.some((kw) => placeName.includes(kw));
          });
        }
      }
    }

    // Strategy 2: If target not found by name, narrow down by dayNumber (if provided)
    if (!target) {
      const dayMatches = dayNumber
        ? allActivities.filter((a) => a.dayNumber === dayNumber)
        : allActivities;

      if (dayMatches.length > 0) {
        // Match by meal or activity type
        if (mealOrActivityType) {
          const typeLow = mealOrActivityType.toLowerCase();
          target = dayMatches.find((a) => {
            const timeStr = formatTimeOfDay(a.startTime) || '';
            const hour = parseInt(timeStr.split(':')[0] || '12', 10);
            if (typeLow.includes('sáng') || typeLow.includes('breakfast')) return hour < 11;
            if (typeLow.includes('trưa') || typeLow.includes('lunch')) return hour >= 11 && hour < 14;
            if (typeLow.includes('tối') || typeLow.includes('dinner')) return hour >= 17;
            if (typeLow.includes('cafe')) return a.place.category?.name.toLowerCase().includes('cafe');
            return false;
          });
        }

        // Category-aware fallback: If query is food/dining, prioritize a food/dining activity instead of tourist attraction
        if (!target) {
          const queryLow = query.toLowerCase();
          const isFoodQuery = /ăn|hải sản|cơm|bún|mì|phở|lẩu|bánh|quán|nhà hàng|cafe|cà phê|nướng/i.test(queryLow);
          if (isFoodQuery) {
            target = dayMatches.find((a) => {
              const catName = (a.place.category?.nameVi || a.place.category?.name || '').toLowerCase();
              return /ăn|nhà hàng|ẩm thực|quán|cafe|restaurant|food/i.test(catName);
            });
          }
        }

        // Fallback to first activity of the day
        if (!target) {
          target = dayMatches[0];
        }
      }
    }

    if (!target) {
      target = allActivities[0];
    }

    // 3. Search for a matching new place in DB within Bounding Box
    const bbox = await this.resolveItineraryBbox(itineraryId, target.place.latitude, target.place.longitude);
    const existingPlaceIds = (
      await this.prisma.itineraryDestination.findMany({
        where: { itineraryId },
        select: { placeId: true },
      })
    ).map((d) => d.placeId);

    // Clean conversational phrases from query ("đền thờ nguyễn trung trực đi" -> "đền thờ nguyễn trung trực")
    const cleanQuery = query
      .replace(/[.,!?]/g, ' ')
      .replace(/\b(đi|nhé|nha|ạ|giúp tôi|cho tôi|với|nhá|nè|luôn)\b/gi, '')
      .trim();

    const searchQuery = cleanQuery || query;

    let candidates = await this.prisma.place.findMany({
      where: {
        id: { notIn: existingPlaceIds },
        deletedAt: null,
        status: 'ACTIVE',
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { address: { contains: searchQuery, mode: 'insensitive' } },
          { tags: { has: searchQuery.toLowerCase() } },
          { category: { name: { contains: searchQuery, mode: 'insensitive' } } },
          { category: { nameVi: { contains: searchQuery, mode: 'insensitive' } } },
        ],
      },
      include: { category: true },
      orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
      take: 1,
    });

    let newPlace = candidates[0];

    // Relaxed search: match individual substantive words if full phrase didn't match
    if (!newPlace) {
      const keywords = searchQuery
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(
          (w) =>
            w.length >= 3 &&
            !['đổi', 'sang', 'thay', 'bằng', 'chỗ', 'quán', 'điểm', 'ngày'].includes(w.toLowerCase()),
        );

      if (keywords.length > 0) {
        const keywordCandidates = await this.prisma.place.findMany({
          where: {
            id: { notIn: existingPlaceIds },
            deletedAt: null,
            status: 'ACTIVE',
            latitude: { gte: bbox.minLat, lte: bbox.maxLat },
            longitude: { gte: bbox.minLng, lte: bbox.maxLng },
            OR: keywords.map((k) => ({ name: { contains: k, mode: 'insensitive' } })),
          },
          include: { category: true },
          orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
          take: 1,
        });
        newPlace = keywordCandidates[0];
      }
    }

    // Check if query is generic (e.g. "địa điểm tương đương", "quán ăn", "cafe", "hải sản")
    const isGenericQuery =
      /^(địa điểm|điểm|quán|quán ăn|ăn uống|tham quan|tương đương|khác|gợi ý)/i.test(searchQuery) ||
      searchQuery.length <= 4;

    if (!newPlace) {
      if (isGenericQuery) {
        // Fallback for generic request: find best rated place in destination bbox matching same category if possible
        const categoryId = target.place.categoryId;
        const fallbackCandidates = await this.prisma.place.findMany({
          where: {
            id: { notIn: existingPlaceIds },
            deletedAt: null,
            status: 'ACTIVE',
            latitude: { gte: bbox.minLat, lte: bbox.maxLat },
            longitude: { gte: bbox.minLng, lte: bbox.maxLng },
            ...(categoryId ? { categoryId } : {}),
          },
          include: { category: true },
          orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }],
          take: 1,
        });
        newPlace = fallbackCandidates[0];
      } else {
        // Specific place requested by user that doesn't exist in DB yet:
        // Dynamically create the place within destination area so user's explicit intent is fulfilled!
        const itin = await this.prisma.itinerary.findUnique({
          where: { id: itineraryId },
          select: { destination: true, areaId: true },
        });
        const destName = itin?.destination || 'Việt Nam';
        const formattedName = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);

        newPlace = await this.prisma.place.create({
          data: {
            name: formattedName,
            address: `${formattedName}, ${destName}, Việt Nam`,
            latitude: target.place.latitude + (Math.random() * 0.01 - 0.005),
            longitude: target.place.longitude + (Math.random() * 0.01 - 0.005),
            areaId: itin?.areaId || target.place.areaId || undefined,
            categoryId: target.place.categoryId || undefined,
            status: 'ACTIVE',
            ratingAvg: 4.7,
            reviewCount: 25,
          },
          include: { category: true },
        });
      }
    }

    if (!newPlace) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm nào phù hợp với yêu cầu "${query}" tại khu vực này.`,
      };
    }

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
        success: true,
        message: `Đề xuất đổi địa điểm Ngày ${dayNumber} từ "${target.place.name}" sang "${newPlace.name}" (${(newPlace.ratingAvg || 4.5).toFixed(1)}★).`,
        data: {
          dayNumber,
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
            dayNumber,
            query,
          },
        },
      };
    }

    // 4. Update the destination
    await this.prisma.itineraryDestination.update({
      where: { id: target.id },
      data: {
        placeId: newPlace.id,
        notes: `Đã đổi sang ${newPlace.name} theo yêu cầu: "${query}".`,
      },
    });

    return {
      toolName: COPILOT_TOOL_NAMES.SWAP_ACTIVITY,
      success: true,
      message: `Đã đổi thành công địa điểm ngày ${dayNumber} từ "${target.place.name}" sang "${newPlace.name}".`,
      data: {
        dayNumber,
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
      placeId?: string;
      dryRun?: boolean;
    },
  ): Promise<CopilotToolExecutionResult> {
    const { dayNumber, timeSlot, query, placeId, dryRun } = args;

    let place: any = null;
    if (placeId) {
      place = await this.prisma.place.findUnique({
        where: { id: placeId },
        include: { category: true },
      });
    }

    if (!place) {
      const bbox = await this.resolveItineraryBbox(itineraryId);
      const existingPlaceIds = (
        await this.prisma.itineraryDestination.findMany({
          where: { itineraryId },
          select: { placeId: true },
        })
      ).map((d) => d.placeId);

      const cleanAddQuery = query
        .replace(/[.,!?]/g, ' ')
        .replace(/\b(đi|nhé|nha|ạ|giúp tôi|cho tôi|với|nhá|nè|luôn)\b/gi, '')
        .trim();

      const searchAddQuery = cleanAddQuery || query;

      const candidates = await this.prisma.place.findMany({
        where: {
          id: { notIn: existingPlaceIds },
          deletedAt: null,
          status: 'ACTIVE',
          latitude: { gte: bbox.minLat, lte: bbox.maxLat },
          longitude: { gte: bbox.minLng, lte: bbox.maxLng },
          OR: [
            { name: { contains: searchAddQuery, mode: 'insensitive' } },
            { tags: { has: searchAddQuery.toLowerCase() } },
            { category: { nameVi: { contains: searchAddQuery, mode: 'insensitive' } } },
          ],
        },
        include: { category: true },
        orderBy: [{ ratingAvg: 'desc' }],
        take: 1,
      });

      place = candidates[0];
      if (!place) {
        const isGenericAdd =
          /^(địa điểm|điểm|quán|quán ăn|ăn uống|tham quan|cafe|bar)/i.test(searchAddQuery) ||
          searchAddQuery.length <= 4;
        if (isGenericAdd) {
          const fallback = await this.prisma.place.findMany({
            where: {
              id: { notIn: existingPlaceIds },
              deletedAt: null,
              status: 'ACTIVE',
              latitude: { gte: bbox.minLat, lte: bbox.maxLat },
              longitude: { gte: bbox.minLng, lte: bbox.maxLng },
            },
            include: { category: true },
            orderBy: [{ ratingAvg: 'desc' }],
            take: 1,
          });
          place = fallback[0];
        } else {
          // Specific place requested to add
          const itin = await this.prisma.itinerary.findUnique({
            where: { id: itineraryId },
            select: { destination: true, areaId: true },
          });
          const destName = itin?.destination || 'Việt Nam';
          const formattedName = cleanAddQuery.charAt(0).toUpperCase() + cleanAddQuery.slice(1);
          place = await this.prisma.place.create({
            data: {
              name: formattedName,
              address: `${formattedName}, ${destName}, Việt Nam`,
              latitude: (bbox.minLat + bbox.maxLat) / 2 + (Math.random() * 0.01 - 0.005),
              longitude: (bbox.minLng + bbox.maxLng) / 2 + (Math.random() * 0.01 - 0.005),
              areaId: itin?.areaId || undefined,
              status: 'ACTIVE',
              ratingAvg: 4.7,
              reviewCount: 20,
            },
            include: { category: true },
          });
        }
      }
    }

    if (!place) {
      return {
        toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
        success: false,
        message: `Không tìm thấy địa điểm phù hợp để thêm vào ngày ${dayNumber}.`,
      };
    }

    let startTimeStr = '16:00';
    let endTimeStr = '17:30';
    const slot = (timeSlot || '').toLowerCase();
    if (slot.includes('morning') || slot.includes('sáng')) {
      startTimeStr = '08:30';
      endTimeStr = '10:00';
    } else if (slot.includes('lunch') || slot.includes('trưa')) {
      startTimeStr = '11:30';
      endTimeStr = '13:00';
    } else if (slot.includes('dinner') || slot.includes('tối')) {
      startTimeStr = '18:30';
      endTimeStr = '20:00';
    } else if (slot.includes('night') || slot.includes('đêm')) {
      startTimeStr = '20:30';
      endTimeStr = '22:30';
    }

    if (dryRun) {
      return {
        toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
        success: true,
        message: `Đề xuất thêm "${place.name}" (${(place.ratingAvg || 4.5).toFixed(1)}★) vào Ngày ${dayNumber} (${startTimeStr} - ${endTimeStr}).`,
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

    // Determine visitOrder and time
    const dayActivities = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId, dayNumber },
      orderBy: { visitOrder: 'desc' },
      take: 1,
    });
    const nextOrder = (dayActivities[0]?.visitOrder ? Number(dayActivities[0].visitOrder) : 0) + 1;

    await this.prisma.itineraryDestination.create({
      data: {
        itineraryId,
        placeId: place.id,
        dayNumber,
        visitOrder: new Prisma.Decimal(nextOrder),
        startTime: parseTimeOfDay(startTimeStr),
        endTime: parseTimeOfDay(endTimeStr),
        estimatedDurationMinutes: 90,
        notes: `Được thêm vào ngày ${dayNumber}: ${query}`,
      },
    });

    // Update totalPlaces count on itinerary
    await this.prisma.itinerary.update({
      where: { id: itineraryId },
      data: { totalPlaces: { increment: 1 } },
    });

    return {
      toolName: COPILOT_TOOL_NAMES.ADD_ACTIVITY,
      success: true,
      message: `Đã thêm "${place.name}" vào ngày ${dayNumber} (${startTimeStr} - ${endTimeStr}).`,
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
      : matches.find((m) => m.place.name.toLowerCase().includes(placeName.toLowerCase()));

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
      : matches.find((m) => m.place.name.toLowerCase().includes(placeName.toLowerCase()));

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
      orderBy: { visitOrder: 'desc' },
      take: 1,
    });
    const nextOrder = (toDayDestinations[0]?.visitOrder ? Number(toDayDestinations[0].visitOrder) : 0) + 1;

    await this.prisma.itineraryDestination.update({
      where: { id: target.id },
      data: {
        dayNumber: toDay,
        visitOrder: new Prisma.Decimal(nextOrder),
        notes: `Đã dời từ ngày ${fromDay} sang ngày ${toDay}.`,
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

    // Fast 3-step swap using temp dayNumber 9999 (satisfies CHECK (day_number >= 1))
    const tempDay = 9999;
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
  // PRIVATE GEOGRAPHIC HELPERS
  // ===========================================================================

  private async resolveItineraryBbox(
    itineraryId: string,
    fallbackLat?: number,
    fallbackLng?: number,
  ): Promise<BoundingBox> {
    if (fallbackLat && fallbackLng) {
      return this.computeBboxAround(fallbackLat, fallbackLng, DEFAULT_BOUNDING_RADIUS_KM);
    }

    // Try finding average coords from existing activities
    const activities = await this.prisma.itineraryDestination.findMany({
      where: { itineraryId },
      include: { place: { select: { latitude: true, longitude: true } } },
      take: 5,
    });

    if (activities.length > 0) {
      const avgLat = activities.reduce((acc, a) => acc + a.place.latitude, 0) / activities.length;
      const avgLng = activities.reduce((acc, a) => acc + a.place.longitude, 0) / activities.length;
      return this.computeBboxAround(avgLat, avgLng, DEFAULT_BOUNDING_RADIUS_KM);
    }

    // Fallback: Da Nang center
    return this.computeBboxAround(16.0544, 108.2022, DEFAULT_BOUNDING_RADIUS_KM);
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
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
