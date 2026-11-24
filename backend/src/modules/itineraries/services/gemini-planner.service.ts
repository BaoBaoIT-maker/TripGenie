import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { AppLocale, DEFAULT_LOCALE } from '../../../common/i18n/locale.util';
import { t } from '../../../common/i18n/t.util';
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
  locale?: AppLocale;
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
    const locale = params.locale ?? DEFAULT_LOCALE;
    const weatherGuidance = buildWeatherGuidance(params.dailyWeather, locale);
    const paceSpec = getTravelPaceSpec(params.pace);
    const { candidateLimit } = computeCandidateLimit(
      params.totalDays,
      paceSpec.maxStopsPerDay,
    );

    const hasDayPools = Boolean(
      params.dayPools && params.dayPools.length > 0,
    );
    const candidateSection = hasDayPools
      ? `GEOGRAPHICALLY CLUSTERED CANDIDATE POOLS PER DAY (each day MUST ONLY pick from its own day pool):\n${JSON.stringify(
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
      : `CANDIDATE_PLACES:\n${JSON.stringify(
          params.places.slice(0, candidateLimit).map((p) => ({
            id: p.id,
            name: p.name,
            cat: p.cat,
            role: p.role,
            rating: p.rating,
          })),
        )}`;

    const outputLanguageRule =
      locale === 'en'
        ? `7. OUTPUT LANGUAGE & TONE (English): Write "title", "description", each day's "theme", and every activity's "notes" in natural, concise English (local Vietnam travel expert tone). Keep exact "placeId" and "placeName" values from the candidate pool.`
        : `7. OUTPUT LANGUAGE & TONE (Vietnamese): Write "title", "description", each day's "theme", and every activity's "notes" in warm, natural, concise Vietnamese (local travel companion tone; avoid stiff translated phrasing). Keep exact "placeId" and "placeName" values from the candidate pool.`;

    return `You are TripGenie — an expert AI travel itinerary designer for Vietnam.
Task: Plan a ${params.totalDays}-day itinerary in ${params.destCity}, departing from ${params.originCity}.
Party size: ${params.partySize || 1} traveler(s) | Travel styles: ${params.travelStyles.join(', ')} | Pace: ${paceSpec.value} (${paceSpec.minStopsPerDay}-${paceSpec.maxStopsPerDay} stops/day) | Budget: ${params.budgetLevel}.
${params.lodgingName ? `Central accommodation anchor: ${params.lodgingName} (depart each morning and return each evening here).` : ''}
${params.dietaryRestrictions && params.dietaryRestrictions.length > 0 ? `Dietary restrictions: ${params.dietaryRestrictions.join(', ')} (MUST strictly respect these when choosing dining stops).` : ''}
${params.preferredCategories && params.preferredCategories.length > 0 ? `Preferred place categories: ${params.preferredCategories.join(', ')}.` : ''}
${params.customPrompt ? `Traveler's custom request: ${params.customPrompt}` : ''}
${weatherGuidance ? `\n${weatherGuidance}\n` : ''}
Mandatory Rules:
1. STRICT POOL GROUNDING (ZERO FABRICATION): Every activity MUST use an exact "id" from that day's candidate pool. NEVER return placeId: null or invent places outside the pool. NEVER repeat the same placeId across the trip.
2. Respect daily rhythm & main meals:
   - Breakfast (07:15 - 08:30): Local specialty breakfast or morning cafe.
   - Morning (08:30 - 11:30): Sightseeing, outdoor landmarks, historic sites, or museums.
   - Lunch (11:30 - 13:15): MUST be a restaurant/dining venue from the pool.
   - Afternoon (13:45 - 17:45): Cultural experience, photo spot, nature, or scenic cafe break.
   - Dinner (18:00 - 20:00): MUST be a local specialty restaurant/dining venue from the pool.
   - Night (20:00 - 22:00, pace permitting): Night market, walking street, or evening stroll.
3. NIGHTLIFE GUARDRAIL:
   - NEVER schedule a Bar, Pub, Club, or Lounge as the main dinner stop (18:00 - 20:00).
   - Nightlife venues (Bar/Pub/Lounge) are ONLY allowed after 20:30 when travel style fits.
   - STRICTLY FORBID Bar/Pub/Club for families with children or seniors.
4. Balanced experience mix: Each day should blend sightseeing/culture, authentic local food, and relaxing/scenic stops.
5. WEATHER ADAPTATION: If daily weather guidance is provided above, prioritize indoor/covered venues on high-rain days and shift outdoor stops to cooler windows on high-heat/UV days.
6. ACTIVITY DENSITY (${paceSpec.value}): ${paceSpec.promptRule}
${outputLanguageRule}

${candidateSection}

RETURN STRICT JSON ONLY (NO markdown code fences \`\`\`json):
{
  "title": "Engaging trip title",
  "description": "Concise trip highlight summary",
  "days": [
    {
      "dayNumber": 1,
      "theme": "Day theme",
      "activities": [
        {
          "placeId": "exact-uuid-from-day-pool",
          "placeName": "Exact place name from pool",
          "startTime": "08:30",
          "endTime": "10:30",
          "durationMinutes": 120,
          "notes": "Actionable local tip for this stop"
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
      'destCity' | 'totalDays' | 'places' | 'pace' | 'dayPools' | 'locale'
    >,
  ): PlannerPlan {
    const locale = params.locale ?? DEFAULT_LOCALE;
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
          notes:
            locale === 'vi'
              ? slot.note
              : t(locale, 'planner.fallback.activityNote', {
                  placeName: picked.name,
                }),
        });
      }

      days.push({
        dayNumber: d,
        theme: t(locale, 'planner.fallback.dayTheme', {
          dest: params.destCity,
          day: d,
        }),
        activities,
      });
    }

    return {
      title: t(locale, 'planner.fallback.title', {
        dest: params.destCity,
        days: params.totalDays,
      }),
      description: t(locale, 'planner.fallback.description', {
        dest: params.destCity,
        days: params.totalDays,
      }),
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
