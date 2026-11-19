import {
  ActivityRole,
  DayTimeWindowName,
  ITINERARY_PLANNING_CONFIG,
} from '../../../../config/itinerary-planning.config';
import { GeoCoord, haversineMeters } from '../../../../common/utils/geo.util';
import { timeToMinutes } from '../../../../common/utils/time-of-day.util';
import { classifyActivityRole } from '../../../../common/utils/brand-key.util';
import { evaluateOpeningStatus } from '../opening-hours.util';

export interface OptimizableActivity {
  placeId: string | null;
  placeName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  visitOrder: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  estimatedCost?: number | null;
  isDining?: boolean;
  isFree?: boolean;
  openingHours?: unknown;
  activityRole?: ActivityRole;
  category?: {
    name?: string | null;
    nameVi?: string | null;
    slug?: string | null;
  } | null;
}

export interface OptimizeDayRouteParams<T extends OptimizableActivity> {
  activities: readonly T[];
  startAnchor?: GeoCoord | null;
  endAnchor?: GeoCoord | null;
  dayDate?: string | Date | null;
}

export function isMealTimeSlot(startTime: string | null | undefined): boolean {
  const min = timeToMinutes(startTime);
  if (min == null) return false;
  return ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER.MEAL_TIME_WINDOWS.some(
    (w) => min >= w.startMin && min <= w.endMin,
  );
}

export function resolveDayTimeWindow(
  startTime: string | null | undefined,
): DayTimeWindowName {
  const min = timeToMinutes(startTime);
  if (min == null) return 'MORNING_ACTIVITY';
  const found = ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER.TIME_WINDOWS.find(
    (w) => min >= w.startMin && min <= w.endMin,
  );
  if (found) return found.name;
  return min < 8 * 60 + 16 ? 'BREAKFAST' : 'NIGHT';
}

export function resolveActivityRole(item: OptimizableActivity): ActivityRole {
  if (item.activityRole) return item.activityRole;
  const classified = classifyActivityRole({
    name: item.placeName,
    category: item.category,
  });
  if (classified !== 'ATTRACTION') return classified;
  return item.isDining ? 'MAIN_MEAL' : 'ATTRACTION';
}

/**
 * Optimizes the visit sequence of a day's selected activities while keeping each slot's
 * scheduled time window fixed. Uses branch-and-bound exhaustive search (for <= 9 stops)
 * anchored at the day's start/end lodging coordinates, guided by the 2D Slot-Role
 * Compatibility Penalty Matrix (OCP) and opening-hours checks.
 *
 * ponytail: Haversine * DETOUR_FACTOR approximates urban road distance without terrain,
 * and penaltyMatrix precomputation is O(n^2) for n <= 9 stops;
 * upgrade path: OSRM /table matrix when self-hosted OSRM is available.
 */
export function optimizeDayRoute<T extends OptimizableActivity>(
  params: OptimizeDayRouteParams<T>,
): T[] {
  const { activities, startAnchor, endAnchor, dayDate } = params;
  const n = activities.length;
  if (n <= 1) {
    return activities.map((act, idx) => ({ ...act, visitOrder: idx + 1 }));
  }

  const cfg = ITINERARY_PLANNING_CONFIG.ROUTE_OPTIMIZER;
  const detour = cfg.DETOUR_FACTOR;

  // Extract coordinates for each candidate activity
  const coords: Array<GeoCoord | null> = activities.map((a) =>
    a.latitude != null &&
    a.longitude != null &&
    Number.isFinite(Number(a.latitude)) &&
    Number.isFinite(Number(a.longitude))
      ? { lat: Number(a.latitude), lng: Number(a.longitude) }
      : null,
  );

  // Precompute pairwise road-approximated distances in meters
  const distMatrix: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c1 = coords[i];
      const c2 = coords[j];
      const d = c1 && c2 ? haversineMeters(c1, c2) * detour : 0;
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }
  }

  const startDist: number[] = coords.map((c) =>
    startAnchor && c ? haversineMeters(startAnchor, c) * detour : 0,
  );
  const endDist: number[] = coords.map((c) =>
    endAnchor && c ? haversineMeters(c, endAnchor) * detour : 0,
  );

  const slotWindows: DayTimeWindowName[] = activities.map((act) =>
    resolveDayTimeWindow(act.startTime),
  );
  const itemRoles: ActivityRole[] = activities.map((act) =>
    resolveActivityRole(act),
  );

  // Precompute slot-assignment penalty matrix via 2D table lookup: penaltyMatrix[slotIdx][itemIdx]
  const penaltyMatrix: number[][] = Array.from({ length: n }, (_, slotIdx) => {
    const slotTime = activities[slotIdx].startTime;
    const windowName = slotWindows[slotIdx];
    const rolePenalties = cfg.SLOT_ROLE_PENALTIES[windowName];

    return activities.map((item, itemIdx) => {
      let penalty = rolePenalties[itemRoles[itemIdx]];

      if (item.openingHours) {
        const status = evaluateOpeningStatus(
          item.openingHours,
          dayDate,
          slotTime,
        );
        if (status.state === 'CLOSED') {
          penalty += cfg.PENALTIES.CLOSED_AT_SLOT_METERS;
        }
      }
      return penalty;
    });
  });

  // Fallback for manual days exceeding MAX_EXHAUSTIVE_STOPS
  if (n > cfg.MAX_EXHAUSTIVE_STOPS) {
    const greedyIndices = runGreedySlotOrder(
      n,
      startDist,
      distMatrix,
      penaltyMatrix,
    );
    return applyPermutation(activities, greedyIndices);
  }

  // Seed bestCost with the original order (0, 1, ..., n-1) so pruning starts tight
  let bestPerm = Array.from({ length: n }, (_, i) => i);
  let bestCost = evaluateFullOrderCost(
    bestPerm,
    startDist,
    endDist,
    distMatrix,
    penaltyMatrix,
  );

  const used = new Array<boolean>(n).fill(false);
  const currentPerm = new Array<number>(n).fill(0);

  function dfs(slotIdx: number, partialCost: number, prevItemIdx: number): void {
    if (partialCost >= bestCost) return;

    if (slotIdx === n) {
      const totalCost = partialCost + endDist[prevItemIdx];
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestPerm = [...currentPerm];
      }
      return;
    }

    for (let itemIdx = 0; itemIdx < n; itemIdx++) {
      if (used[itemIdx]) continue;

      const stepDist =
        slotIdx === 0
          ? startDist[itemIdx]
          : distMatrix[prevItemIdx][itemIdx];
      const nextCost =
        partialCost + stepDist + penaltyMatrix[slotIdx][itemIdx];

      if (nextCost >= bestCost) continue;

      used[itemIdx] = true;
      currentPerm[slotIdx] = itemIdx;
      dfs(slotIdx + 1, nextCost, itemIdx);
      used[itemIdx] = false;
    }
  }

  dfs(0, 0, -1);

  return applyPermutation(activities, bestPerm);
}

function evaluateFullOrderCost(
  perm: readonly number[],
  startDist: readonly number[],
  endDist: readonly number[],
  distMatrix: readonly (readonly number[])[],
  penaltyMatrix: readonly (readonly number[])[],
): number {
  const n = perm.length;
  if (n === 0) return 0;
  let cost = startDist[perm[0]] + penaltyMatrix[0][perm[0]];
  for (let s = 1; s < n; s++) {
    cost +=
      distMatrix[perm[s - 1]][perm[s]] + penaltyMatrix[s][perm[s]];
  }
  cost += endDist[perm[n - 1]];
  return cost;
}

function runGreedySlotOrder(
  n: number,
  startDist: readonly number[],
  distMatrix: readonly (readonly number[])[],
  penaltyMatrix: readonly (readonly number[])[],
): number[] {
  const used = new Array<boolean>(n).fill(false);
  const perm: number[] = [];

  for (let s = 0; s < n; s++) {
    let bestIdx = -1;
    let bestStepCost = Infinity;

    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const dist = s === 0 ? startDist[i] : distMatrix[perm[s - 1]][i];
      const stepCost = dist + penaltyMatrix[s][i];
      if (stepCost < bestStepCost) {
        bestStepCost = stepCost;
        bestIdx = i;
      }
    }

    used[bestIdx] = true;
    perm.push(bestIdx);
  }

  return perm;
}

function applyPermutation<T extends OptimizableActivity>(
  activities: readonly T[],
  perm: readonly number[],
): T[] {
  return perm.map((itemIdx, slotIdx) => {
    const slotTemplate = activities[slotIdx];
    const chosenPlace = activities[itemIdx];
    return {
      ...chosenPlace,
      startTime: slotTemplate.startTime,
      endTime: slotTemplate.endTime,
      durationMinutes: slotTemplate.durationMinutes,
      visitOrder: slotIdx + 1,
    };
  });
}
