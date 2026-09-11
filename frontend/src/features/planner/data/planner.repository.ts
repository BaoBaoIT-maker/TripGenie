import { Planner, UpdatePlannerInput } from "@/types/planner";
import { normalizePlanner } from "../model/planner-draft";
import { MOCK_PLANNERS } from "@/mocks/data/planners";

const STORAGE_KEY = "triptailor:planners:v1";
const LEGACY_STORAGE_KEY = "triptailor_user_planners";

interface StoredData {
  version: 1;
  planners: Planner[];
}

function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return null;
}

function loadFromStorage(): Planner[] {
  const storage = getStorage();
  if (!storage) {
    return MOCK_PLANNERS.map(normalizePlanner);
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: StoredData = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.planners)) {
        return parsed.planners.map(normalizePlanner);
      }
    } catch {
      // Invalid JSON, fall back to seeded + legacy
    }
  }

  // First time or invalid data: merge seeded with legacy
  const map = new Map<string, Planner>();
  for (const seed of MOCK_PLANNERS) {
    map.set(seed.id, normalizePlanner(seed));
  }

  const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacyRaw) {
    try {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        for (const item of legacyParsed) {
          if (item && item.id) {
            map.set(item.id, normalizePlanner(item));
          }
        }
      }
    } catch {
      // Ignore legacy parse errors
    }
  }

  const merged = Array.from(map.values());
  saveToStorage(merged);
  return merged;
}

function saveToStorage(planners: Planner[]): void {
  const storage = getStorage();
  if (!storage) return;

  const data: StoredData = {
    version: 1,
    planners: planners.map(normalizePlanner),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const plannerRepository = {
  async list(): Promise<Planner[]> {
    const list = loadFromStorage();
    return deepClone(list).map(normalizePlanner);
  },

  async get(id: string): Promise<Planner | null> {
    const list = loadFromStorage();
    const found = list.find((p) => p.id === id);
    if (!found) {
      return null;
    }
    return deepClone(normalizePlanner(found));
  },

  async create(planner: Planner): Promise<Planner> {
    const list = loadFromStorage();
    const normalized = normalizePlanner({
      ...planner,
      status: planner.status ?? "draft",
      createdAt: planner.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const existingIndex = list.findIndex((p) => p.id === planner.id);
    let updatedList: Planner[];
    if (existingIndex !== -1) {
      updatedList = [...list];
      updatedList[existingIndex] = normalized;
    } else {
      updatedList = [normalized, ...list];
    }

    saveToStorage(updatedList);
    return deepClone(normalized);
  },

  async update(id: string, input: UpdatePlannerInput | Planner): Promise<Planner> {
    const list = loadFromStorage();
    const existing = list.find((p) => p.id === id);
    if (!existing) {
      throw new Error(`Planner not found: ${id}`);
    }

    const updated: Planner = normalizePlanner({
      ...existing,
      ...input,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    const updatedList = list.map((p) => (p.id === id ? updated : p));
    saveToStorage(updatedList);
    return deepClone(updated);
  },
};
