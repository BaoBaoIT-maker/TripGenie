import { ITINERARY_PLANNING_CONFIG } from '../../../../config/itinerary-planning.config';
import { GeoCoord, computeCentroid } from '../../../../common/utils/geo.util';
import { classifyActivityRole } from '../../../../common/utils/brand-key.util';

export interface ClusterablePlace {
  id: string;
  name: string;
  latitude: unknown;
  longitude: unknown;
  ratingAvg?: unknown;
  category?: {
    name?: string | null;
    nameVi?: string | null;
    slug?: string | null;
  } | null;
}

export interface DayCluster<T extends ClusterablePlace> {
  dayNumber: number;
  centroid: GeoCoord;
  places: T[];
}

interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Returns true strictly when a candidate place has the MAIN_MEAL temporal role
 * (restaurants, local specialty eateries, street food — excluding cafes and nightlife bars).
 */
export function isDiningCandidate(place: ClusterablePlace): boolean {
  return classifyActivityRole(place) === 'MAIN_MEAL';
}

function sqDist(a: ProjectedPoint, b: ProjectedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function rebalanceRoleMinimum(
  buckets: number[][],
  roleFlags: readonly boolean[],
  minRequired: number,
  projected: readonly ProjectedPoint[],
  centroids: readonly ProjectedPoint[],
): void {
  if (minRequired <= 0) return;
  const k = buckets.length;

  for (let c = 0; c < k; c++) {
    let roleCount = buckets[c].filter((idx) => roleFlags[idx]).length;
    while (roleCount < minRequired) {
      let bestDonor = -1;
      let bestItemPos = -1;
      let bestDist = Infinity;

      for (let d = 0; d < k; d++) {
        if (d === c) continue;
        const donorCount = buckets[d].filter((idx) => roleFlags[idx]).length;
        if (donorCount <= minRequired) continue;

        for (let pos = 0; pos < buckets[d].length; pos++) {
          const idx = buckets[d][pos];
          if (!roleFlags[idx]) continue;
          const dist = sqDist(projected[idx], centroids[c]);
          if (dist < bestDist) {
            bestDist = dist;
            bestDonor = d;
            bestItemPos = pos;
          }
        }
      }

      if (bestDonor === -1) break;
      const [movedIdx] = buckets[bestDonor].splice(bestItemPos, 1);
      buckets[c].push(movedIdx);
      roleCount++;
    }
  }
}

/**
 * Deterministic geographic clustering of candidate places into K daily pools.
 * Uses farthest-first initialization + Lloyd's K-Means + post-hoc capacity & role balancing,
 * then orders clusters into a continuous day sequence starting near anchorCoord.
 *
 * ponytail: Lloyd K-Means finds a local minimum with heuristic post-balancing;
 * upgrade path: size-constrained K-Means / min-cost flow if cluster sizes skew on multi-hub areas.
 */
export function clusterPlacesByDay<T extends ClusterablePlace>(params: {
  places: readonly T[];
  totalDays: number;
  maxStopsPerDay: number;
  fallbackCoord: GeoCoord;
  anchorCoord?: GeoCoord | null;
}): DayCluster<T>[] {
  const { places, totalDays, maxStopsPerDay, fallbackCoord, anchorCoord } =
    params;
  const k = Math.max(1, Math.trunc(totalDays));

  if (places.length === 0) {
    return Array.from({ length: k }, (_, i) => ({
      dayNumber: i + 1,
      centroid: anchorCoord ?? fallbackCoord,
      places: [],
    }));
  }

  if (k === 1) {
    const coords = places.map((p) => toCoord(p, fallbackCoord));
    return [
      {
        dayNumber: 1,
        centroid: computeCentroid(coords) ?? fallbackCoord,
        places: [...places],
      },
    ];
  }

  // 1. Project coordinates to flat plane (lng * cos(meanLat))
  const rawCoords = places.map((p) => toCoord(p, fallbackCoord));
  const meanLat =
    rawCoords.reduce((sum, c) => sum + c.lat, 0) / rawCoords.length;
  const cosLat = Math.cos(
    meanLat * ITINERARY_PLANNING_CONFIG.CLUSTERING.DEG_TO_RAD,
  );
  const projected: ProjectedPoint[] = rawCoords.map((c) => ({
    x: c.lng * cosLat,
    y: c.lat,
  }));

  const effectiveK = Math.min(k, places.length);

  // 2. Deterministic farthest-first centroid initialization (seed 0 = highest-ranked place at index 0)
  const centroids: ProjectedPoint[] = [{ ...projected[0] }];
  const chosenIndices = new Set<number>([0]);

  while (centroids.length < effectiveK) {
    let bestIdx = -1;
    let bestMinDist = -1;
    for (let i = 0; i < projected.length; i++) {
      if (chosenIndices.has(i)) continue;
      let minDist = Infinity;
      for (const c of centroids) {
        const d = sqDist(projected[i], c);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    chosenIndices.add(bestIdx);
    centroids.push({ ...projected[bestIdx] });
  }

  // 3. Lloyd's K-Means iterations
  const assignments = new Array<number>(places.length).fill(0);
  const maxIter = ITINERARY_PLANNING_CONFIG.CLUSTERING.MAX_ITERATIONS;

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < projected.length; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = sqDist(projected[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;

    for (let c = 0; c < centroids.length; c++) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let i = 0; i < projected.length; i++) {
        if (assignments[i] === c) {
          sumX += projected[i].x;
          sumY += projected[i].y;
          count++;
        }
      }
      if (count > 0) {
        centroids[c] = { x: sumX / count, y: sumY / count };
      }
    }
  }

  // Build mutable index buckets per cluster (1..k)
  const buckets: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < places.length; i++) {
    buckets[assignments[i]].push(i);
  }
  while (centroids.length < k) {
    centroids.push({
      x: fallbackCoord.lng * cosLat,
      y: fallbackCoord.lat,
    });
  }

  // 4. Post-balance: MAIN_MEAL minimum, ATTRACTION minimum, & total size minimum
  const roles = places.map((p) => classifyActivityRole(p));
  const diningFlags = roles.map((r) => r === 'MAIN_MEAL');
  const attractionFlags = roles.map(
    (r) => r === 'ATTRACTION' || r === 'SHOPPING',
  );

  const minDining = Math.min(
    Math.floor(diningFlags.filter(Boolean).length / k),
    ITINERARY_PLANNING_CONFIG.CLUSTERING.MIN_DINING_PER_DAY,
  );
  const minAttraction = Math.min(
    Math.floor(attractionFlags.filter(Boolean).length / k),
    ITINERARY_PLANNING_CONFIG.CLUSTERING.MIN_ATTRACTION_PER_DAY,
  );
  const minTargetSize = Math.min(
    Math.floor(places.length / k),
    Math.ceil(
      maxStopsPerDay *
        ITINERARY_PLANNING_CONFIG.CLUSTERING.MIN_CLUSTER_BUFFER_RATIO,
    ),
  );

  rebalanceRoleMinimum(buckets, diningFlags, minDining, projected, centroids);
  rebalanceRoleMinimum(
    buckets,
    attractionFlags,
    minAttraction,
    projected,
    centroids,
  );

  // 4b. Balance total cluster sizes without violating role minimums
  for (let c = 0; c < k; c++) {
    while (buckets[c].length < minTargetSize) {
      let largestDonor = -1;
      let maxLen = minTargetSize;
      for (let d = 0; d < k; d++) {
        if (d !== c && buckets[d].length > maxLen) {
          maxLen = buckets[d].length;
          largestDonor = d;
        }
      }
      if (largestDonor === -1) break;

      const donorDiningCount = buckets[largestDonor].filter(
        (idx) => diningFlags[idx],
      ).length;
      const donorAttractionCount = buckets[largestDonor].filter(
        (idx) => attractionFlags[idx],
      ).length;
      let bestPos = -1;
      let bestDist = Infinity;

      for (let pos = 0; pos < buckets[largestDonor].length; pos++) {
        const idx = buckets[largestDonor][pos];
        if (diningFlags[idx] && donorDiningCount <= minDining) continue;
        if (attractionFlags[idx] && donorAttractionCount <= minAttraction)
          continue;
        const dist = sqDist(projected[idx], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestPos = pos;
        }
      }
      if (bestPos === -1) bestPos = buckets[largestDonor].length - 1;

      const [movedIdx] = buckets[largestDonor].splice(bestPos, 1);
      buckets[c].push(movedIdx);
    }
  }

  // 5. Recompute geographic centroids and order clusters greedily into Day 1..K
  const rawClusters = buckets.map((indices) => {
    // Keep original popularity sort order inside each day's pool
    indices.sort((a, b) => a - b);
    const clusterCoords = indices.map((i) => rawCoords[i]);
    return {
      centroid: computeCentroid(clusterCoords) ?? fallbackCoord,
      places: indices.map((i) => places[i]),
    };
  });

  const startRef = anchorCoord ?? rawClusters[0].centroid;
  const visited = new Array<boolean>(k).fill(false);
  const ordered: DayCluster<T>[] = [];

  let currentRef: ProjectedPoint = {
    x: startRef.lng * cosLat,
    y: startRef.lat,
  };

  for (let step = 0; step < k; step++) {
    let bestCluster = -1;
    let bestDist = Infinity;
    for (let c = 0; c < k; c++) {
      if (visited[c]) continue;
      const projC: ProjectedPoint = {
        x: rawClusters[c].centroid.lng * cosLat,
        y: rawClusters[c].centroid.lat,
      };
      const d = sqDist(currentRef, projC);
      if (d < bestDist) {
        bestDist = d;
        bestCluster = c;
      }
    }
    if (bestCluster === -1) break;
    visited[bestCluster] = true;
    const chosen = rawClusters[bestCluster];
    ordered.push({
      dayNumber: step + 1,
      centroid: chosen.centroid,
      places: chosen.places,
    });
    currentRef = {
      x: chosen.centroid.lng * cosLat,
      y: chosen.centroid.lat,
    };
  }

  return ordered;
}

export function toCoord(
  place: Pick<ClusterablePlace, 'latitude' | 'longitude'>,
  fallback: GeoCoord,
): GeoCoord {
  const lat = place.latitude != null ? Number(place.latitude) : NaN;
  const lng = place.longitude != null ? Number(place.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return fallback;
}
