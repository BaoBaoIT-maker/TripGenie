import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  DayWeather,
  buildWeatherGuidance,
} from '../../weather/weather.constants';
import { getTravelPaceSpec } from '../dto/generate-itinerary.dto';
import {
  ActivityRole,
  ITINERARY_PLANNING_CONFIG,
  computeCandidateLimit,
} from '../../../config/itinerary-planning.config';
import { resolveDayTimeWindow } from './route-optimizer/day-route-optimizer';

/** Compact place record sent to the LLM as grounding context. */
export interface PlannerPlace {
  id: string;
  name: string;
  cat: string;
  rating: unknown;
  tags?: string[];
  isDining?: boolean;
  role?: ActivityRole;
}

export interface PlannerDayPool {
  dayNumber: number;
  places: PlannerPlace[];
}

export interface PlannerActivity {
  placeId?: string | null;
  placeName?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface PlannerDay {
  dayNumber: number;
  theme?: string;
  activities?: PlannerActivity[];
}

export interface PlannerPlan {
  title?: string;
  description?: string;
  days?: PlannerDay[];
}

export interface PlannerParams {
  originCity: string;
  destCity: string;
  destLat?: number;
  destLng?: number;
  totalDays: number;
  partySize?: number;
  budgetLevel: string;
  pace: string;
  travelStyles: string[];
  dietaryRestrictions?: string[];
  preferredCategories?: string[];
  customPrompt?: string;
  dailyWeather?: DayWeather[];
  lodgingName?: string | null;
  places: PlannerPlace[];
  dayPools?: PlannerDayPool[];
}

/**
 * Gemini HTTP client + deterministic fallback for day planning.
 * Single responsibility: turn (params + daily candidate pools) into a PlannerPlan. No DB access.
 */
@Injectable()
export class GeminiPlannerService {
  private readonly logger = new Logger(GeminiPlannerService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-flash-lite-latest',
    );
    this.httpClient = axios.create({ timeout: 25000 });
  }

  /**
   * Calls Gemini to synthesize days, flow, and timing. Never throws: falls back to a deterministic plan.
   */
  async plan(params: PlannerParams): Promise<PlannerPlan> {
    const modelPath = this.modelName.startsWith('models/')
      ? this.modelName
      : `models/${this.modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${this.apiKey}`;

    try {
      const response = await this.httpClient.post(url, {
        contents: [{ parts: [{ text: this.buildPrompt(params) }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const text: string | undefined =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      const cleanJson = text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleanJson) as PlannerPlan;
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Gemini planning error: ${e.message}`, e.stack);
      return this.buildFallbackPlan(params);
    }
  }

  private buildPrompt(params: PlannerParams): string {
    const weatherGuidance = buildWeatherGuidance(params.dailyWeather);
    const paceSpec = getTravelPaceSpec(params.pace);
    const { candidateLimit } = computeCandidateLimit(
      params.totalDays,
      paceSpec.maxStopsPerDay,
    );

    const hasDayPools = Boolean(
      params.dayPools && params.dayPools.length > 0,
    );
    const candidateSection = hasDayPools
      ? `POOL ĐỊA ĐIỂM ĐÃ PHÂN CỤM ĐỊA LÝ THEO TỪNG NGÀY (Ngày nào CHỈ ĐƯỢC chọn từ pool của ngày đó):\n${JSON.stringify(
          params.dayPools!.map((dp) => ({
            dayNumber: dp.dayNumber,
            candidates: dp.places.map((p) => ({
              id: p.id,
              name: p.name,
              cat: p.cat,
              role: p.role,
              rating: p.rating,
            })),
          })),
        )}`
      : `DANH SÁCH CANDIDATE_PLACES:\n${JSON.stringify(
          params.places.slice(0, candidateLimit).map((p) => ({
            id: p.id,
            name: p.name,
            cat: p.cat,
            role: p.role,
            rating: p.rating,
          })),
        )}`;

    return `Bạn là TripGenie - Chuyên gia thiết kế lịch trình du lịch thông minh tại Việt Nam.
Nhiệm vụ: Sắp xếp một lịch trình ${params.totalDays} ngày tại ${params.destCity}, xuất phát từ ${params.originCity}.
Số lượng khách: ${params.partySize || 1} người | Phong cách: ${params.travelStyles.join(', ')} | Nhịp độ: ${paceSpec.labelVi} (${paceSpec.minStopsPerDay}–${paceSpec.maxStopsPerDay} điểm/ngày) | Ngân sách: ${params.budgetLevel}.
${params.lodgingName ? `Chỗ lưu trú trung tâm của đoàn: ${params.lodgingName} (xuất phát mỗi sáng và về nghỉ mỗi tối tại đây).` : ''}
${params.dietaryRestrictions && params.dietaryRestrictions.length > 0 ? `Chế độ ăn / Kiêng cữ: ${params.dietaryRestrictions.join(', ')} (BẮT BUỘC tôn trọng các món ăn/nhà hàng phù hợp tiêu chí này).` : ''}
${params.preferredCategories && params.preferredCategories.length > 0 ? `Ưu tiên thể loại địa điểm: ${params.preferredCategories.length > 0 ? params.preferredCategories.join(', ') : ''}.` : ''}
${params.customPrompt ? `Yêu cầu riêng của khách: ${params.customPrompt}` : ''}
${weatherGuidance ? `\n${weatherGuidance}\n` : ''}
Quy tắc bắt buộc:
1. CHỈ CHỌN TRONG POOL VÀ CẤM BỊA ĐỊA ĐIỂM: Mỗi hoạt động BẮT BUỘC phải chọn đúng "id" từ danh sách ứng viên của ngày tương ứng. TUYỆT ĐỐI CẤM trả về placeId: null hoặc tự sáng tác tên địa điểm ngoài danh sách. Không lặp lại cùng một id trong suốt chuyến đi.
2. Tôn trọng nhịp sinh hoạt & các bữa ăn chính:
   - Sáng (07:15 - 08:30): Ăn sáng đặc sản địa phương hoặc cà phê sáng.
   - Sáng (08:30 - 11:30): Tham quan, ngắm cảnh ngoài trời hoặc di tích lịch sử, bảo tàng.
   - Trưa (11:30 - 13:15): BẮT BUỘC là Ăn trưa tại nhà hàng/quán ăn trong pool.
   - Chiều (13:45 - 17:45): Trải nghiệm văn hóa, check-in, thiên nhiên hoặc cà phê thư giãn ngắm cảnh.
   - Tối (18:00 - 20:00): BẮT BUỘC là Ăn tối tại nhà hàng/quán ăn đặc sản vùng miền trong pool.
   - Đêm (20:00 - 22:00, tùy nhịp độ): Chợ đêm, phố đi bộ, dạo cảnh đêm.
3. BẢO VỆ CUỘC SỐNG VỀ ĐÊM & ĐỐI TƯỢNG (Nightlife Guardrail):
   - TUYỆT ĐỐI KHÔNG xếp Bar, Pub, Club, Lounge làm điểm ăn tối chính (khung 18:00 - 20:00).
   - Địa điểm giải trí đêm (Bar/Pub/Lounge) CHỈ ĐƯỢC PHÉP xuất hiện sau 20:30 nếu phong cách du lịch phù hợp.
   - TUYỆT ĐỐI CẤM Bar/Pub/Club nếu đối tượng là gia đình có trẻ em hoặc người lớn tuổi.
4. Phân bổ cân bằng thể loại trải nghiệm: Mỗi ngày phải kết hợp hài hòa giữa điểm tham quan/ngắm cảnh/văn hóa, điểm ăn uống ẩm thực địa phương, và không gian check-in/thư giãn.
5. THÍCH ỨNG THỜI TIẾT: Nếu có thông tin thời tiết từng ngày ở trên, ưu tiên điểm trong nhà/có mái che vào ngày mưa cao và sắp xếp điểm ngoài trời vào khung giờ mát mẻ khi nắng gắt/UV cao.
6. MẬT ĐỘ HOẠT ĐỘNG (${paceSpec.value}): ${paceSpec.promptRule}

${candidateSection}

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG bọc trong markdown tick \`\`\`json):
{
  "title": "Tên hành trình hấp dẫn",
  "description": "Mô tả ngắn gọn điểm nhấn của chuyến đi",
  "days": [
    {
      "dayNumber": 1,
      "theme": "Chủ đề của ngày",
      "activities": [
        {
          "placeId": "uuid-chính-xác-từ-pool-của-ngày",
          "placeName": "Tên địa điểm trong pool",
          "startTime": "08:30",
          "endTime": "10:30",
          "durationMinutes": 120,
          "notes": "Gợi ý trải nghiệm cụ thể"
        }
      ]
    }
  ]
}`;
  }

  /**
   * Fallback deterministic plan in case LLM is unreachable (Resilience guarantee).
   * Selects strictly from each day's candidate pool (or global places list), matching meal slots to dining places.
   */
  private buildFallbackPlan(
    params: Pick<
      PlannerParams,
      'destCity' | 'totalDays' | 'places' | 'pace' | 'dayPools'
    >,
  ): PlannerPlan {
    const slots = getTravelPaceSpec(params.pace).fallbackSlots;
    const days: PlannerDay[] = [];
    const usedIds = new Set<string>();
    let globalIdx = 0;

    for (let d = 1; d <= params.totalDays; d++) {
      const dayPool =
        params.dayPools?.find((dp) => dp.dayNumber === d)?.places ??
        params.places;

      const activities: PlannerActivity[] = [];
      for (const slot of slots) {
        const picked = pickFromPoolForSlot(
          dayPool,
          params.places,
          slot.start,
          Boolean(slot.isMeal),
          usedIds,
          () => globalIdx++,
        );
        if (!picked) continue;
        usedIds.add(picked.id);
        activities.push({
          placeId: picked.id,
          placeName: picked.name,
          startTime: slot.start,
          endTime: slot.end,
          durationMinutes: slot.dur,
          notes: slot.note,
        });
      }

      days.push({
        dayNumber: d,
        theme: `Khám phá các điểm nổi bật ${params.destCity} - Ngày ${d}`,
        activities,
      });
    }

    return {
      title: `Hành trình khám phá ${params.destCity} ${params.totalDays} ngày`,
      description: `Lịch trình được tối ưu hóa theo các địa điểm nổi bật tại ${params.destCity}.`,
      days,
    };
  }
}

function getPlaceRole(p: PlannerPlace): ActivityRole {
  if (p.role) return p.role;
  return p.isDining ? 'MAIN_MEAL' : 'ATTRACTION';
}

function pickFromPoolForSlot(
  dayPool: readonly PlannerPlace[],
  globalPool: readonly PlannerPlace[],
  slotStart: string,
  wantDining: boolean,
  usedIds: ReadonlySet<string>,
  nextFallbackIdx: () => number,
): PlannerPlace | null {
  const windowName = resolveDayTimeWindow(slotStart);
  const penalties =
    ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER.SLOT_ROLE_PENALTIES[windowName];
  const mismatchThreshold =
    ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER.PENALTIES.MEAL_MISMATCH_METERS;

  const isRoleCompatible = (p: PlannerPlace, maxPenalty: number) => {
    if (p.role) return penalties[p.role] <= maxPenalty;
    if (p.isDining === undefined) return true;
    return Boolean(p.isDining) === wantDining;
  };

  // 1. Exact role match (penalty === 0) inside dayPool, then mild match (< mismatchThreshold)
  const exactInDay =
    dayPool.find((p) => !usedIds.has(p.id) && isRoleCompatible(p, 0)) ??
    dayPool.find(
      (p) => !usedIds.has(p.id) && isRoleCompatible(p, mismatchThreshold - 1),
    );
  if (exactInDay) return exactInDay;

  // 2. Compatible role in globalPool before taking a mismatched role in dayPool
  const exactInGlobal =
    globalPool.find((p) => !usedIds.has(p.id) && isRoleCompatible(p, 0)) ??
    globalPool.find(
      (p) => !usedIds.has(p.id) && isRoleCompatible(p, mismatchThreshold - 1),
    );
  if (exactInGlobal) return exactInGlobal;

  // 3. Any non-forbidden unused in dayPool or globalPool
  const forbidden =
    ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER.PENALTIES.FORBIDDEN_ROLE_METERS;
  const anySafe =
    dayPool.find(
      (p) => !usedIds.has(p.id) && penalties[getPlaceRole(p)] < forbidden,
    ) ??
    globalPool.find(
      (p) => !usedIds.has(p.id) && penalties[getPlaceRole(p)] < forbidden,
    );
  if (anySafe) return anySafe;

  // 4. Wrap around if total slots exceed pool size (e.g. small test fixtures)
  const source = dayPool.length > 0 ? dayPool : globalPool;
  if (source.length === 0) return null;
  return source[nextFallbackIdx() % source.length];
}
