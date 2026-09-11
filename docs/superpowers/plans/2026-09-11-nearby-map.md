# Nearby Places Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/map` experience where users choose a radius, discover mock places near a current or fallback location, and inspect synchronized VietMap markers, addresses, and result cards.

**Architecture:** Keep `app/map/page.tsx` as a Server Component with a Suspense shell and put browser-only orchestration in a leaf `MapExplorer` Client Component. Treat URL search params as the durable filter source, Zustand as transient marker/card state, `placeService` plus TanStack Query as the data boundary, Turf.js as the pure geographic filter, and a dynamically imported VietMap component as the browser-only renderer.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Tailwind CSS, shadcn/Base UI primitives, TanStack Query 5, Zustand 5, Zod 4, Turf.js 7.4, VietMap GL JS 7.0.0-pre.1, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-11-nearby-map-design.md`

## Global Constraints

- Read `plan.md`, `.agents/skills/travel-frontend/SKILL.md`, `.agents/skills/ui-ux-pro-max/SKILL.md`, and the approved spec before implementation.
- Before editing Next.js code, read `frontend/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`, `frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, and `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`.
- Preserve unrelated dirty-worktree changes; stage only files named by the current task.
- Keep `/map` as a Server Component; use `"use client"` only at interactive leaf boundaries.
- Import VietMap with `next/dynamic` and `ssr: false` from a Client Component wrapper.
- Use the exact radius options `1`, `3`, `5`, `10`, and `20` km; default to `5` km.
- URL owns `latitude`, `longitude`, `maxDistanceKm`, `city`, `category`, and `keyword`; Zustand must not duplicate them.
- The public map key comes only from `NEXT_PUBLIC_VIETMAP_API_KEY`; never hardcode or commit a key.
- Keep route directions, route polylines, clustering, backend persistence, and real geocoding out of scope.
- Preserve the existing TripTailor visual system. Radius and category chips wrap; interactive targets are at least 44 px on mobile.
- Follow TDD: add one failing behavior, observe the intended failure, implement the minimum, and rerun the focused test before moving on.
- Run commands from `frontend` unless a command explicitly targets the repository root `test/` directory.

## File Structure

### Create

```text
frontend/src/app/map/page.tsx
frontend/src/components/map/VietMapLoader.tsx
frontend/src/components/map/VietMap.tsx
frontend/src/components/map/PlaceMarker.ts
frontend/src/components/map/MapPopup.ts
frontend/src/components/map/MapControls.tsx
frontend/src/features/map/MapExplorer.tsx
frontend/src/features/map/MapFilters.tsx
frontend/src/features/map/MapResults.tsx
frontend/src/features/map/MapPlaceCard.tsx
frontend/src/features/map/hooks/use-geolocation.ts
frontend/src/features/map/hooks/use-map-filters.ts
frontend/src/features/map/hooks/use-places.ts
frontend/src/features/map/lib/map-filter.ts
frontend/src/features/map/lib/map-query.ts
frontend/src/features/map/map-config.ts
frontend/src/features/map/types.ts
frontend/src/stores/search-store.ts
test/features/map/lib/map-filter.test.ts
test/features/map/lib/map-query.test.ts
test/features/map/hooks/use-geolocation.test.ts
test/features/map/stores/search-store.test.ts
test/features/map/components/MapFilters.test.tsx
test/features/map/components/MapResults.test.tsx
test/features/map/components/VietMap.test.tsx
test/features/map/components/MapExplorer.test.tsx
test/app/map/page.test.tsx
test/components/common/map-navigation.test.tsx
```

### Modify

```text
frontend/.env.example
frontend/src/app/layout.tsx
frontend/src/components/common/Navbar.tsx
frontend/src/components/common/BottomNav.tsx
```

## Public Interfaces

All tasks use these exact contracts:

```ts
export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const;
export type MapRadiusKm = (typeof MAP_RADIUS_OPTIONS)[number];

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapFilters extends MapCoordinate {
  maxDistanceKm: MapRadiusKm;
  city: string | "all";
  category: PlaceCategory | "all";
  keyword: string;
}

export interface ParsedMapQuery {
  filters: MapFilters;
  hasExplicitCenter: boolean;
}

export interface NearbyPlace {
  place: Place;
  distanceKm: number;
}

export interface MapViewport extends MapCoordinate {
  zoom: number;
}

export interface VietMapProps {
  places: NearbyPlace[];
  center: MapCoordinate;
  radiusKm: MapRadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onRequestCurrentLocation: () => void;
  locating: boolean;
}
```

---

### Task 1: Pure Nearby-Place Domain

**Files:**
- Create: `frontend/src/features/map/types.ts`
- Create: `frontend/src/features/map/map-config.ts`
- Create: `frontend/src/features/map/lib/map-filter.ts`
- Test: `test/features/map/lib/map-filter.test.ts`

**Interfaces:**
- Consumes: `Place` and `PlaceCategory` from `@/types/place`; Turf `point` and `distance`.
- Produces: `MapCoordinate`, `MapRadiusKm`, `MapFilters`, `NearbyPlace`, `MapViewport`, `VietMapProps`, `MAP_RADIUS_OPTIONS`, `DEFAULT_MAP_CENTER`, `CITY_CENTERS`, `filterNearbyPlaces`, and `formatDistanceKm`.

- [x] **Step 1: Write the failing distance/filter tests**

Create `test/features/map/lib/map-filter.test.ts` with local place fixtures so the test does not depend on the large mock-data file:

```ts
import { describe, expect, it } from "vitest";
import { filterNearbyPlaces, formatDistanceKm } from "@/features/map/lib/map-filter";
import type { Place } from "@/types/place";

const basePlace: Place = {
  id: "base",
  slug: "base",
  name: "Base Cafe",
  description: "Mock",
  category: "cafe",
  categoryLabel: "Quán Cafe",
  address: "Quận 1, TP. Hồ Chí Minh",
  city: "TP. Hồ Chí Minh",
  latitude: 10.7769,
  longitude: 106.7009,
  rating: 4.5,
  reviewCount: 10,
  priceLevel: 2,
  priceRangeText: "50.000đ",
  images: [],
  coverImage: "https://images.unsplash.com/photo-1",
  tags: ["Chill"],
  suitableFor: ["friends"],
  styles: ["chill"],
};

const places: Place[] = [
  basePlace,
  { ...basePlace, id: "near", slug: "near", name: "Near Museum", category: "culture", categoryLabel: "Văn hóa", latitude: 10.7869 },
  { ...basePlace, id: "far", slug: "far", name: "Far Cafe", latitude: 10.8669 },
];

describe("filterNearbyPlaces", () => {
  it("keeps places inside the radius and sorts nearest first", () => {
    const result = filterNearbyPlaces(places, {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 5,
      city: "all",
      category: "all",
      keyword: "",
    });
    expect(result.map(({ place }) => place.id)).toEqual(["base", "near"]);
    expect(result[1].distanceKm).toBeGreaterThan(1);
  });

  it("composes keyword, city and category filters", () => {
    const result = filterNearbyPlaces(places, {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 20,
      city: "TP. Hồ Chí Minh",
      category: "cafe",
      keyword: "far",
    });
    expect(result.map(({ place }) => place.id)).toEqual(["far"]);
  });

  it("formats sub-kilometer and kilometer distances", () => {
    expect(formatDistanceKm(0.42)).toBe("420 m");
    expect(formatDistanceKm(2.34)).toBe("2,3 km");
  });
});
```

- [x] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
npm test -- ../test/features/map/lib/map-filter.test.ts
```

Expected: FAIL because `@/features/map/lib/map-filter` does not exist.

- [x] **Step 3: Add exact map types and configuration**

Create `frontend/src/features/map/types.ts` using the Public Interfaces block. Create `map-config.ts`:

```ts
import type { MapCoordinate, MapRadiusKm } from "./types";

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const satisfies readonly MapRadiusKm[];
export const DEFAULT_MAP_CENTER: MapCoordinate = { latitude: 10.7769, longitude: 106.7009 };
export const DEFAULT_MAP_ZOOM = 12;

export const CITY_CENTERS: Record<string, MapCoordinate> = {
  "TP. Hồ Chí Minh": DEFAULT_MAP_CENTER,
  "Đà Lạt": { latitude: 11.9404, longitude: 108.4583 },
  "Ninh Bình": { latitude: 20.2506, longitude: 105.9745 },
  "Phú Quốc": { latitude: 10.227, longitude: 103.967 },
};
```

- [x] **Step 4: Implement the pure Turf filter**

Create `frontend/src/features/map/lib/map-filter.ts`:

```ts
import { distance, point } from "@turf/turf";
import type { Place } from "@/types/place";
import type { MapFilters, NearbyPlace } from "../types";

export function filterNearbyPlaces(places: Place[], filters: MapFilters): NearbyPlace[] {
  const origin = point([filters.longitude, filters.latitude]);
  const keyword = filters.keyword.trim().toLocaleLowerCase("vi");

  return places
    .filter((place) => filters.city === "all" || place.city === filters.city)
    .filter((place) => filters.category === "all" || place.category === filters.category)
    .filter((place) => {
      if (!keyword) return true;
      return [place.name, place.address, place.city, ...place.tags]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(keyword);
    })
    .map((place) => ({
      place,
      distanceKm: distance(origin, point([place.longitude, place.latitude]), { units: "kilometers" }),
    }))
    .filter(({ distanceKm }) => distanceKm <= filters.maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.place.name.localeCompare(b.place.name, "vi"));
}

export function formatDistanceKm(value: number): string {
  return value < 1
    ? `${Math.round(value * 1000)} m`
    : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)} km`;
}
```

- [x] **Step 5: Run the focused test**

Run `npm test -- ../test/features/map/lib/map-filter.test.ts`.

Expected: 3 tests PASS.

- [x] **Step 6: Commit the domain layer**

```bash
git add frontend/src/features/map/types.ts frontend/src/features/map/map-config.ts frontend/src/features/map/lib/map-filter.ts test/features/map/lib/map-filter.test.ts
git commit -m "feat(map): add nearby place filtering"
```

---

### Task 2: URL-Backed Map Filters

**Files:**
- Create: `frontend/src/features/map/lib/map-query.ts`
- Create: `frontend/src/features/map/hooks/use-map-filters.ts`
- Test: `test/features/map/lib/map-query.test.ts`

**Interfaces:**
- Consumes: `MapFilters`, `ParsedMapQuery`, `DEFAULT_MAP_CENTER`, `MAP_RADIUS_OPTIONS`, `CITY_CENTERS`.
- Produces: `parseMapSearchParams(searchParams): ParsedMapQuery`, `mergeMapSearchParams(current, filters): string`, and `useMapFilters(): { filters; hasExplicitCenter; replaceFilters }`.

- [x] **Step 1: Write failing URL parsing and merging tests**

Create `test/features/map/lib/map-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeMapSearchParams, parseMapSearchParams } from "@/features/map/lib/map-query";

describe("map query", () => {
  it("uses safe defaults and marks an absent center as implicit", () => {
    const parsed = parseMapSearchParams(new URLSearchParams());
    expect(parsed.hasExplicitCenter).toBe(false);
    expect(parsed.filters.maxDistanceKm).toBe(5);
    expect(parsed.filters.category).toBe("all");
  });

  it("accepts valid coordinates and allowed radius only", () => {
    const parsed = parseMapSearchParams(new URLSearchParams("latitude=11.94&longitude=108.45&maxDistanceKm=10"));
    expect(parsed.hasExplicitCenter).toBe(true);
    expect(parsed.filters).toMatchObject({ latitude: 11.94, longitude: 108.45, maxDistanceKm: 10 });

    const invalid = parseMapSearchParams(new URLSearchParams("latitude=999&longitude=nope&maxDistanceKm=7"));
    expect(invalid.hasExplicitCenter).toBe(false);
    expect(invalid.filters.maxDistanceKm).toBe(5);
  });

  it("keeps unrelated params while replacing the map filter fields", () => {
    const query = mergeMapSearchParams(new URLSearchParams("ref=shared&keyword=old"), {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 3,
      city: "all",
      category: "cafe",
      keyword: "cà phê",
    });
    const params = new URLSearchParams(query);
    expect(params.get("ref")).toBe("shared");
    expect(params.get("maxDistanceKm")).toBe("3");
    expect(params.get("keyword")).toBe("cà phê");
  });
});
```

- [x] **Step 2: Verify the missing-module failure**

Run `npm test -- ../test/features/map/lib/map-query.test.ts`.

Expected: FAIL because `map-query.ts` does not exist.

- [x] **Step 3: Implement schema-backed query parsing**

Create `frontend/src/features/map/lib/map-query.ts`. Use Zod coercion, latitude bounds `-90..90`, longitude bounds `-180..180`, and an enum for allowed radii. Reject missing or blank coordinates before coercion so they cannot become numeric zero. Validate city against `all` plus the four keys in `CITY_CENTERS`, and validate category against the exact `PlaceCategory` union plus `all`. The essential shape is:

```ts
const categorySchema = z.enum(["all", "cafe", "restaurant", "sightseeing", "nature", "entertainment", "culture", "nightlife", "relaxation"]);
const citySchema = z.enum(["all", "TP. Hồ Chí Minh", "Đà Lạt", "Ninh Bình", "Phú Quốc"]);
const radiusSchema = z.coerce.number().pipe(z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10), z.literal(20)]));

function parseCoordinate(raw: string | null, schema: z.ZodType<number>): number | null {
  if (!raw?.trim()) return null;
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseMapSearchParams(params: URLSearchParams): ParsedMapQuery {
  const latitude = parseCoordinate(params.get("latitude"), z.coerce.number().min(-90).max(90));
  const longitude = parseCoordinate(params.get("longitude"), z.coerce.number().min(-180).max(180));
  const hasExplicitCenter = latitude !== null && longitude !== null;
  return {
    hasExplicitCenter,
    filters: {
      latitude: latitude ?? DEFAULT_MAP_CENTER.latitude,
      longitude: longitude ?? DEFAULT_MAP_CENTER.longitude,
      maxDistanceKm: radiusSchema.safeParse(params.get("maxDistanceKm")).data ?? 5,
      city: citySchema.safeParse(params.get("city")).data ?? "all",
      category: categorySchema.safeParse(params.get("category")).data ?? "all",
      keyword: params.get("keyword") ?? "",
    },
  };
}
```

`mergeMapSearchParams` must clone the current params, set all six map fields, serialize coordinates with at most six decimals, and return `params.toString()`.

- [x] **Step 4: Implement the navigation hook**

Create `use-map-filters.ts` as a Client hook:

```ts
"use client";

export function useMapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = useMemo(() => parseMapSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  const replaceFilters = useCallback((next: MapFilters) => {
    const query = mergeMapSearchParams(new URLSearchParams(searchParams.toString()), next);
    router.replace(`${pathname}?${query}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return { ...parsed, replaceFilters };
}
```

- [x] **Step 5: Run focused tests**

Run `npm test -- ../test/features/map/lib/map-query.test.ts`.

Expected: 3 tests PASS.

- [x] **Step 6: Commit URL filters**

```bash
git add frontend/src/features/map/lib/map-query.ts frontend/src/features/map/hooks/use-map-filters.ts test/features/map/lib/map-query.test.ts
git commit -m "feat(map): persist filters in the URL"
```

---

### Task 3: Geolocation and Transient Search State

**Files:**
- Create: `frontend/src/features/map/hooks/use-geolocation.ts`
- Create: `frontend/src/stores/search-store.ts`
- Test: `test/features/map/hooks/use-geolocation.test.ts`
- Test: `test/features/map/stores/search-store.test.ts`

**Interfaces:**
- Consumes: `MapCoordinate`, `MapViewport`, `DEFAULT_MAP_CENTER`.
- Produces: `useGeolocation(): { status; coordinate; message; requestLocation }` and `useSearchStore` actions `selectPlace`, `hoverPlace`, `setViewport`, `resetMapInteraction`.

- [x] **Step 1: Write failing store tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSearchStore } from "@/stores/search-store";

describe("useSearchStore", () => {
  beforeEach(() => useSearchStore.getState().resetMapInteraction());

  it("tracks only transient map interaction", () => {
    useSearchStore.getState().selectPlace("place-1");
    useSearchStore.getState().hoverPlace("place-2");
    useSearchStore.getState().setViewport({ latitude: 10.77, longitude: 106.7, zoom: 14 });
    expect(useSearchStore.getState()).toMatchObject({ selectedPlaceId: "place-1", hoveredPlaceId: "place-2" });
    expect(useSearchStore.getState().mapViewport?.zoom).toBe(14);
  });
});
```

- [x] **Step 2: Write failing geolocation tests**

Use `renderHook`, `act`, and a configurable `navigator.geolocation` mock. Cover success and denial:

```ts
interface GeolocationCallbacks {
  success: PositionCallback;
  error: PositionErrorCallback;
}

function installGeolocationMock(run: (callbacks: GeolocationCallbacks) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) =>
        run({ success, error }),
    },
  });
}

it("returns the browser coordinate on success", async () => {
  installGeolocationMock(({ success }) => success({ coords: { latitude: 10.8, longitude: 106.7 } } as GeolocationPosition));
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.requestLocation());
  await waitFor(() => expect(result.current.status).toBe("success"));
  expect(result.current.coordinate).toEqual({ latitude: 10.8, longitude: 106.7 });
});

it("falls back after permission denial", async () => {
  installGeolocationMock(({ error }) => error({ code: 1, message: "denied" } as GeolocationPositionError));
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.requestLocation());
  await waitFor(() => expect(result.current.status).toBe("fallback"));
  expect(result.current.coordinate).toEqual(DEFAULT_MAP_CENTER);
  expect(result.current.message).toMatch(/TP\. Hồ Chí Minh/i);
});
```

Also test `navigator.geolocation` missing. Use the browser API's `timeout: 8000`; do not create a second custom timer.

- [x] **Step 3: Verify both test files fail**

Run:

```bash
npm test -- ../test/features/map/hooks/use-geolocation.test.ts ../test/features/map/stores/search-store.test.ts
```

Expected: FAIL because both modules are missing.

- [x] **Step 4: Implement the Zustand store**

```ts
import { create } from "zustand";
import type { MapViewport } from "@/features/map/types";

interface SearchState {
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  mapViewport: MapViewport | null;
  selectPlace: (placeId: string | null) => void;
  hoverPlace: (placeId: string | null) => void;
  setViewport: (viewport: MapViewport) => void;
  resetMapInteraction: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  selectedPlaceId: null,
  hoveredPlaceId: null,
  mapViewport: null,
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  hoverPlace: (hoveredPlaceId) => set({ hoveredPlaceId }),
  setViewport: (mapViewport) => set({ mapViewport }),
  resetMapInteraction: () => set({ selectedPlaceId: null, hoveredPlaceId: null, mapViewport: null }),
}));
```

- [x] **Step 5: Implement the geolocation state machine**

Use the exact statuses `"idle" | "pending" | "success" | "fallback"`. `requestLocation` sets pending, calls `getCurrentPosition`, maps success to the browser coordinate, and maps missing API or error to `DEFAULT_MAP_CENTER`. Use `{ enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }`. Supply Vietnamese messages and keep the callback stable with `useCallback`.

```ts
const fallback = (reason: string) => {
  setState({
    status: "fallback",
    coordinate: DEFAULT_MAP_CENTER,
    message: `${reason} Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.`,
  });
};
```

- [x] **Step 6: Run the focused tests**

Run the command from Step 3.

Expected: all geolocation and store tests PASS.

- [x] **Step 7: Commit location/state support**

```bash
git add frontend/src/features/map/hooks/use-geolocation.ts frontend/src/stores/search-store.ts test/features/map/hooks/use-geolocation.test.ts test/features/map/stores/search-store.test.ts
git commit -m "feat(map): add location fallback and map state"
```

---

### Task 4: Place Query Boundary

**Files:**
- Create: `frontend/src/features/map/hooks/use-places.ts`
- Test: `test/features/map/hooks/use-places.test.tsx`

**Interfaces:**
- Consumes: `placeService.getPlaces()` and the existing `Place` model.
- Produces: `placeKeys.all`, `placeKeys.list()`, and `usePlacesQuery()`.

- [ ] **Step 1: Write the failing query-hook test**

Wrap `renderHook` with a fresh `QueryClientProvider`, mock `placeService.getPlaces`, and assert the hook returns the service result:

```tsx
function createQueryWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

vi.mock("@/services/place.service", () => ({ placeService: { getPlaces: vi.fn() } }));

it("loads places through placeService", async () => {
  vi.mocked(placeService.getPlaces).mockResolvedValue([MOCK_PLACES[0]]);
  const { result } = renderHook(() => usePlacesQuery(), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([MOCK_PLACES[0]]);
  expect(placeService.getPlaces).toHaveBeenCalledWith();
});
```

- [ ] **Step 2: Verify the missing-hook failure**

Run `npm test -- ../test/features/map/hooks/use-places.test.tsx`.

Expected: FAIL because `use-places.ts` does not exist.

- [ ] **Step 3: Add the shared query hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { placeService } from "@/services/place.service";

export const placeKeys = {
  all: ["places"] as const,
  list: () => [...placeKeys.all, "list"] as const,
};

export function usePlacesQuery() {
  return useQuery({ queryKey: placeKeys.list(), queryFn: () => placeService.getPlaces() });
}
```

- [ ] **Step 4: Verify the existing service boundary stays stable**

Inspect `frontend/src/services/place.service.ts` and confirm its no-argument `getPlaces()` returns all existing mock places. Do not modify the service or mock records in this task; URL filters and geographic derivation remain in the map feature. Preserve this existing behavior:

```ts
if (!params) return places;
```

- [ ] **Step 5: Run focused and domain tests**

```bash
npm test -- ../test/features/map/hooks/use-places.test.tsx ../test/features/map/lib/map-filter.test.ts
```

Expected: PASS, and existing `Place` types compile.

- [ ] **Step 6: Commit the query hook**

```bash
git add frontend/src/features/map/hooks/use-places.ts test/features/map/hooks/use-places.test.tsx
git commit -m "feat(map): query places for nearby map"
```

---

### Task 5: VietMap Renderer, Markers, Popup, and Controls

**Files:**
- Create: `frontend/src/components/map/VietMapLoader.tsx`
- Create: `frontend/src/components/map/VietMap.tsx`
- Create: `frontend/src/components/map/PlaceMarker.ts`
- Create: `frontend/src/components/map/MapPopup.ts`
- Create: `frontend/src/components/map/MapControls.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/.env.example`
- Test: `test/features/map/components/VietMap.test.tsx`

**Interfaces:**
- Consumes: `NearbyPlace`, `MapCoordinate`, `MapRadiusKm`, `MapViewport`, selection callbacks.
- Produces: default-exported `VietMap`, named `VietMapLoader`, DOM factories `createPlaceMarkerElement`/`createMapPopupElement`, and `MapControls`.

- [ ] **Step 1: Write failing DOM-factory and missing-key tests**

The test must assert behavior visible to the app, not VietMap internals:

```ts
const nearbyPlace: NearbyPlace = { place: MOCK_PLACES[0], distanceKm: 1.2 };
const props: VietMapProps = {
  places: [nearbyPlace],
  center: { latitude: 11.9404, longitude: 108.4583 },
  radiusKm: 5,
  selectedPlaceId: null,
  hoveredPlaceId: null,
  onSelectPlace: vi.fn(),
  onViewportChange: vi.fn(),
  onRequestCurrentLocation: vi.fn(),
  locating: false,
};

it("creates an accessible active marker", () => {
  const onSelect = vi.fn();
  const element = createPlaceMarkerElement(nearbyPlace, { selected: true, hovered: false, onSelect });
  expect(element).toHaveAttribute("aria-label", `Xem ${nearbyPlace.place.name} trên bản đồ`);
  expect(element.dataset.active).toBe("true");
  element.click();
  expect(onSelect).toHaveBeenCalledWith(nearbyPlace.place.id);
});

it("creates popup content with address, distance and detail link", () => {
  const popup = createMapPopupElement(nearbyPlace);
  expect(popup).toHaveTextContent(nearbyPlace.place.address);
  expect(popup).toHaveTextContent(/km|m/);
  expect(popup.querySelector("a")).toHaveAttribute("href", `/places/${nearbyPlace.place.slug}`);
});

it("keeps a result-compatible fallback when the key is missing", () => {
  vi.stubEnv("NEXT_PUBLIC_VIETMAP_API_KEY", "");
  render(<VietMapLoader {...props} />);
  expect(screen.getByText(/chưa cấu hình khóa VietMap/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify missing modules**

Run `npm test -- ../test/features/map/components/VietMap.test.tsx`.

Expected: FAIL because map component modules do not exist.

- [ ] **Step 3: Implement safe marker and popup DOM factories**

`PlaceMarker.ts` creates a `<button type="button">`, uses `textContent` only, sets `data-active`, applies TripTailor orange/white marker classes, and calls `onSelect(place.id)`. Never insert place data with `innerHTML`.

`MapPopup.ts` creates DOM nodes with `document.createElement`, sets text using `textContent`, and uses an anchor whose `href` is `/places/${slug}`. Include name, address, category, rating, and `formatDistanceKm(distanceKm)`.

- [ ] **Step 4: Implement the control overlay**

`MapControls` renders three icon buttons with tooltips/accessibility labels: `Phóng to`, `Thu nhỏ`, and `Vị trí của tôi`. Use `Button` with `size="icon"`, a minimum `size-11`, and props:

```ts
interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRequestCurrentLocation: () => void;
  locating: boolean;
}
```

- [ ] **Step 5: Implement the browser-only VietMap lifecycle**

In `VietMap.tsx`, add `"use client"`, import VietMap classes, create the map once in an effect, and clean up every marker, popup, listener, and the map on unmount. Use the installed v6+ style URL:

```ts
const style = `https://maps.vietmap.vn/maps/styles/lm/style.json?apikey=${encodeURIComponent(apiKey)}`;
const map = new vietmapgl.Map({
  container: containerRef.current,
  style,
  center: [center.longitude, center.latitude],
  zoom: DEFAULT_MAP_ZOOM,
});
```

Keep mutable `Map`, `Marker[]`, and `Popup` instances in refs. A second effect replaces marker DOM when `places`, `selectedPlaceId`, or `hoveredPlaceId` changes. A third effect uses `LngLatBounds`, starting with `[center.longitude, center.latitude]`, extends over visible places, and calls `fitBounds({ padding: 72, maxZoom: 15, duration: 500 })` when center/radius/result IDs change. When selection changes, call `flyTo({ center: [lng, lat], zoom: 15 })` and open exactly one popup. On `moveend`, emit:

```ts
onViewportChange({
  latitude: map.getCenter().lat,
  longitude: map.getCenter().lng,
  zoom: map.getZoom(),
});
```

Render the map container, `MapControls`, and an `aria-live="polite"` map status. Capture SDK/style errors and show an overlay reading `Không thể tải bản đồ. Danh sách địa điểm vẫn có thể sử dụng.`.

- [ ] **Step 6: Add the dynamic loader boundary**

```tsx
"use client";

const DynamicVietMap = dynamic(() => import("./VietMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[430px] w-full md:h-[520px]" aria-label="Đang tải bản đồ" />,
});

export function VietMapLoader(props: VietMapProps) {
  if (!process.env.NEXT_PUBLIC_VIETMAP_API_KEY) {
    return (
      <div role="status" className="flex h-[430px] items-center justify-center rounded-2xl border bg-muted/30 p-6 text-center md:h-[520px]">
        Chưa cấu hình khóa VietMap. Danh sách địa điểm vẫn có thể sử dụng.
      </div>
    );
  }
  return <DynamicVietMap {...props} />;
}
```

Import `VietMapProps` from `@/features/map/types` in both files; do not redeclare it inside a component.

- [ ] **Step 7: Import SDK CSS globally and correct environment guidance**

Add this global stylesheet import to `frontend/src/app/layout.tsx` directly after `./globals.css`:

```ts
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
```

Change `frontend/.env.example` to document only:

```dotenv
NEXT_PUBLIC_VIETMAP_API_KEY=your_domain_restricted_vietmap_key_here
```

Remove the stale `NEXT_PUBLIC_VIETMAP_STYLE_URL=https://maps.vietmap.vn/api/maps/light/styles.json` line because the installed package documents the v6+ `/maps/styles/lm/style.json?apikey=...` URL.

- [ ] **Step 8: Run map component tests**

Run `npm test -- ../test/features/map/components/VietMap.test.tsx`.

Expected: DOM factory, missing-key, and control tests PASS. If the test imports `VietMap.tsx`, mock `@vietmap/vietmap-gl-js` before the import; jsdom must not instantiate WebGL.

- [ ] **Step 9: Commit the renderer**

```bash
git add frontend/src/components/map/VietMapLoader.tsx frontend/src/components/map/VietMap.tsx frontend/src/components/map/PlaceMarker.ts frontend/src/components/map/MapPopup.ts frontend/src/components/map/MapControls.tsx frontend/src/app/layout.tsx frontend/.env.example test/features/map/components/VietMap.test.tsx
git commit -m "feat(map): render VietMap places and controls"
```

---

### Task 6: Filters, Cards, Results, and Map Orchestration

**Files:**
- Create: `frontend/src/features/map/MapFilters.tsx`
- Create: `frontend/src/features/map/MapPlaceCard.tsx`
- Create: `frontend/src/features/map/MapResults.tsx`
- Create: `frontend/src/features/map/MapExplorer.tsx`
- Test: `test/features/map/components/MapFilters.test.tsx`
- Test: `test/features/map/components/MapResults.test.tsx`
- Test: `test/features/map/components/MapExplorer.test.tsx`

**Interfaces:**
- Consumes: all Tasks 1–5 public interfaces, `usePlacesQuery`, `useMapFilters`, `useGeolocation`, and `useSearchStore`.
- Produces: client UI composed by `/map`.

- [ ] **Step 1: Write failing filter-control tests**

Render `MapFilters` with controlled `filters` and `onChange`. Assert the radius controls are accessible and emit complete next filter values:

```ts
const filters: MapFilters = {
  latitude: 10.7769,
  longitude: 106.7009,
  maxDistanceKm: 5,
  city: "all",
  category: "all",
  keyword: "",
};

it("changes the radius without losing other filters", async () => {
  const onChange = vi.fn();
  render(<MapFilters filters={filters} onChange={onChange} onUseCurrentLocation={vi.fn()} locating={false} />);
  await userEvent.click(screen.getByRole("button", { name: "Trong bán kính 10 km" }));
  expect(onChange).toHaveBeenCalledWith({ ...filters, maxDistanceKm: 10 });
});

it("moves the center when a city is selected", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<MapFilters filters={filters} onChange={onChange} onUseCurrentLocation={vi.fn()} locating={false} />);
  await user.click(screen.getByRole("combobox", { name: /Thành phố/i }));
  await user.click(screen.getByRole("option", { name: "TP. Hồ Chí Minh" }));
  expect(onChange).toHaveBeenCalledWith({ ...filters, ...CITY_CENTERS["TP. Hồ Chí Minh"], city: "TP. Hồ Chí Minh" });
});
```

Also assert category chips wrap (`flex-wrap`) and keyword input is labelled `Tìm địa điểm`.

- [ ] **Step 2: Write failing result interaction tests**

```ts
const nearbyPlace: NearbyPlace = {
  place: MOCK_PLACES[0],
  distanceKm: 1.2,
};

it("shows addresses and computed distances", () => {
  render(<MapResults places={[nearbyPlace]} radiusKm={5} selectedPlaceId={null} hoveredPlaceId={null} onSelectPlace={vi.fn()} onHoverPlace={vi.fn()} onExpandRadius={vi.fn()} onClearFilters={vi.fn()} />);
  expect(screen.getByText(nearbyPlace.place.address)).toBeInTheDocument();
  expect(screen.getByText(formatDistanceKm(nearbyPlace.distanceKm))).toBeInTheDocument();
});

it("synchronizes focus and click without hijacking the detail link", async () => {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  render(<MapPlaceCard nearbyPlace={nearbyPlace} selected={false} hovered={false} onSelect={onSelect} onHover={onHover} />);
  const card = screen.getByRole("button", { name: new RegExp(`Chọn ${nearbyPlace.place.name}`) });
  card.focus();
  expect(onHover).toHaveBeenCalledWith(nearbyPlace.place.id);
  await userEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith(nearbyPlace.place.id);
  expect(screen.getByRole("link", { name: /Xem chi tiết/i })).toHaveAttribute("href", `/places/${nearbyPlace.place.slug}`);
});
```

For zero results, assert buttons `Mở rộng đến 10 km` and `Xóa bộ lọc` call their callbacks.

- [ ] **Step 3: Write the failing orchestration test**

Mock `VietMapLoader`, hooks, and the store. Verify filtered data is passed to both map and results, a stale selected ID is cleared, location success updates URL filters, and map absence does not hide results. The key assertion is:

```ts
vi.mock("@/components/map/VietMapLoader", () => ({
  VietMapLoader: ({ places }: VietMapProps) => (
    <div data-testid="map-probe" data-place-count={places.length} />
  ),
}));
vi.mock("@/features/map/hooks/use-places", () => ({ usePlacesQuery: vi.fn() }));
vi.mock("@/features/map/hooks/use-map-filters", () => ({ useMapFilters: vi.fn() }));
vi.mock("@/features/map/hooks/use-geolocation", () => ({ useGeolocation: vi.fn() }));

it("passes the same nearby set to the map and result list", () => {
  vi.mocked(usePlacesQuery).mockReturnValue({ data: MOCK_PLACES, isLoading: false, isError: false } as ReturnType<typeof usePlacesQuery>);
  vi.mocked(useMapFilters).mockReturnValue({
    filters: { latitude: 10.7769, longitude: 106.7009, maxDistanceKm: 10, city: "TP. Hồ Chí Minh", category: "all", keyword: "" },
    hasExplicitCenter: true,
    replaceFilters: vi.fn(),
  });
  vi.mocked(useGeolocation).mockReturnValue({ status: "idle", coordinate: null, message: null, requestLocation: vi.fn() });
  render(<MapExplorer />);

  expect(screen.getAllByText(/Thảo Cầm Viên/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Tràng An/)).not.toBeInTheDocument();
  expect(screen.getByTestId("map-probe")).toHaveAttribute("data-place-count", "2");
});
```

- [ ] **Step 4: Run all three tests and observe failure**

```bash
npm test -- ../test/features/map/components/MapFilters.test.tsx ../test/features/map/components/MapResults.test.tsx ../test/features/map/components/MapExplorer.test.tsx
```

Expected: FAIL because the feature components do not exist.

- [ ] **Step 5: Implement the filter toolbar**

`MapFilters` is controlled and never stores a second filter copy. Props:

```ts
interface MapFiltersProps {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
}
```

Use `Input` for keyword, `Select` for city, and wraparound buttons for category/radius. Selecting a known city applies `CITY_CENTERS[city]`. Emit keyword, city, category, and radius changes immediately; `router.replace` prevents these edits from adding browser-history entries, and this avoids maintaining a second local filter copy. Radius button labels follow `Trong bán kính ${radius} km`.

- [ ] **Step 6: Implement compact map result cards**

`MapPlaceCard` renders image, name, address, category, rating, formatted distance, and the detail link. Use this exact prop contract:

```ts
interface MapPlaceCardProps {
  nearbyPlace: NearbyPlace;
  selected: boolean;
  hovered: boolean;
  onSelect: (placeId: string) => void;
  onHover: (placeId: string | null) => void;
}
```

Make the selectable card surface a real `<button type="button">` separate from the detail `<Link>` to avoid nesting interactive elements. Use `onPointerEnter`, `onPointerLeave`, `onFocus`, and `onBlur` for hover/focus state. Apply `ring-2 ring-primary` when selected and a lighter elevated style when hovered.

`MapResults` uses this exact prop contract:

```ts
interface MapResultsProps {
  places: NearbyPlace[];
  radiusKm: MapRadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onHoverPlace: (placeId: string | null) => void;
  onExpandRadius: () => void;
  onClearFilters: () => void;
}
```

Render a result summary `N địa điểm trong bán kính X km`, a responsive three-column grid on desktop, and horizontal snap cards on small screens. The empty state exposes the two exact actions tested above.

- [ ] **Step 7: Implement `MapExplorer` orchestration**

Add `"use client"`. Read URL filters through `useMapFilters`, data through `usePlacesQuery`, location through `useGeolocation`, and selection/hover/viewport through `useSearchStore`. The core data flow is:

```ts
const nearbyPlaces = useMemo(
  () => filterNearbyPlaces(placesQuery.data ?? [], filters),
  [filters, placesQuery.data]
);

useEffect(() => {
  if (!hasExplicitCenter && geolocation.status === "idle") requestLocation();
}, [geolocation.status, hasExplicitCenter, requestLocation]);

useEffect(() => {
  if (!geolocation.coordinate) return;
  const locationKey = `${geolocation.status}:${geolocation.coordinate.latitude}:${geolocation.coordinate.longitude}`;
  if (appliedLocationRef.current === locationKey) return;
  if (geolocation.coordinate && (geolocation.status === "success" || geolocation.status === "fallback")) {
    appliedLocationRef.current = locationKey;
    replaceFilters({ ...filters, ...geolocation.coordinate, city: geolocation.status === "success" ? "all" : "TP. Hồ Chí Minh" });
  }
}, [filters, geolocation.coordinate, geolocation.status, replaceFilters]);

useEffect(() => {
  if (selectedPlaceId && !nearbyPlaces.some(({ place }) => place.id === selectedPlaceId)) selectPlace(null);
}, [nearbyPlaces, selectPlace, selectedPlaceId]);
```

Declare `const appliedLocationRef = useRef<string | null>(null)` before the effects. The guard shown above prevents replacement of the same location indefinitely. Manual `Vị trí của tôi` resets this ref to `null` before calling `requestLocation` again.

Render query loading/error states, geolocation fallback notice with retry, `MapFilters`, `VietMapLoader`, and `MapResults`. On `Mở rộng đến 10 km`, set radius to 10 while preserving other filters. On `Xóa bộ lọc`, preserve the current center, set radius 5, and clear city/category/keyword.

- [ ] **Step 8: Run component tests**

Run the command from Step 4.

Expected: filter, result, empty-state, location, and synchronization tests PASS without loading the real SDK.

- [ ] **Step 9: Commit the feature UI**

```bash
git add frontend/src/features/map/MapFilters.tsx frontend/src/features/map/MapPlaceCard.tsx frontend/src/features/map/MapResults.tsx frontend/src/features/map/MapExplorer.tsx test/features/map/components/MapFilters.test.tsx test/features/map/components/MapResults.test.tsx test/features/map/components/MapExplorer.test.tsx
git commit -m "feat(map): add nearby map explorer interface"
```

---

### Task 7: Route and Navigation

**Files:**
- Create: `frontend/src/app/map/page.tsx`
- Modify: `frontend/src/components/common/Navbar.tsx`
- Modify: `frontend/src/components/common/BottomNav.tsx`
- Test: `test/app/map/page.test.tsx`
- Test: `test/components/common/map-navigation.test.tsx`

**Interfaces:**
- Consumes: `MapExplorer`.
- Produces: public `/map` route and desktop/mobile entry points.

- [ ] **Step 1: Write failing route test**

Mock `MapExplorer` so the Server Component is tested without browser APIs:

```ts
vi.mock("@/features/map/MapExplorer", () => ({ MapExplorer: () => <div>Map explorer probe</div> }));

it("renders the nearby map route shell", () => {
  render(<MapPage />);
  expect(screen.getByRole("heading", { name: /Bản đồ địa điểm/i })).toBeInTheDocument();
  expect(screen.getByText("Map explorer probe")).toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing navigation tests**

Mock `usePathname` to return `/map`. Assert desktop and mobile navigation each expose a link named `Bản đồ` with `href="/map"`, and that it receives the active style. The mobile test must also assert there are still exactly five primary items.

```tsx
vi.mock("next/navigation", () => ({ usePathname: () => "/map" }));

it("links to the active map route from the desktop navigation", () => {
  render(<Navbar />);
  const link = screen.getByRole("link", { name: /Bản đồ/i });
  expect(link).toHaveAttribute("href", "/map");
  expect(link).toHaveClass("bg-secondary");
});

it("keeps five mobile items and replaces saved items with map", () => {
  render(<BottomNav />);
  expect(screen.getAllByRole("link")).toHaveLength(5);
  expect(screen.getByRole("link", { name: /Bản đồ/i })).toHaveAttribute("href", "/map");
  expect(screen.queryByRole("link", { name: /Đã lưu/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests and verify failure**

```bash
npm test -- ../test/app/map/page.test.tsx ../test/components/common/map-navigation.test.tsx
```

Expected: FAIL because the route and links are absent.

- [ ] **Step 4: Create the Server Component route**

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { MapExplorer } from "@/features/map/MapExplorer";

export const metadata: Metadata = {
  title: "Bản đồ địa điểm gần bạn | TripTailor",
  description: "Khám phá địa điểm theo vị trí và bán kính trên bản đồ TripTailor.",
};

export default function MapPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Bản đồ địa điểm</h1>
        <p className="text-sm text-muted-foreground">Chọn bán kính để khám phá địa điểm và địa chỉ phù hợp quanh bạn.</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-2xl" aria-label="Đang chuẩn bị bản đồ" />}>
        <MapExplorer />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Add desktop and mobile navigation**

In `Navbar.tsx`, import `Map` from Lucide and insert `{ href: "/map", label: "Bản đồ", icon: Map }` after Explore.

In `BottomNav.tsx`, import `Map`, replace the existing `/collections` item with `{ href: "/map", label: "Bản đồ", icon: Map }`, and leave Home, Explore, Planner, and Profile unchanged. Do not remove the collections page or desktop bookmark shortcut.

- [ ] **Step 6: Run route/navigation tests**

Run the command from Step 3.

Expected: all tests PASS and the route page itself contains no `"use client"` directive.

- [ ] **Step 7: Commit the entry points**

```bash
git add frontend/src/app/map/page.tsx frontend/src/components/common/Navbar.tsx frontend/src/components/common/BottomNav.tsx test/app/map/page.test.tsx test/components/common/map-navigation.test.tsx
git commit -m "feat(map): expose nearby map route"
```

---

### Task 8: Regression, Build, and Manual Acceptance

**Files:**
- Modify only files from Tasks 1–7 if verification exposes a defect.

**Interfaces:**
- Consumes: complete `/map` feature.
- Produces: verified production-ready mock map UI.

- [ ] **Step 1: Run all map tests together**

```bash
npm test -- ../test/features/map ../test/app/map/page.test.tsx ../test/components/common/map-navigation.test.tsx
```

Expected: all map, route, and navigation tests PASS.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: all existing planner tests and all new map tests PASS.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit code 0 with no new warnings in map files.

- [ ] **Step 4: Run a production build**

```bash
npm run build
```

Expected: exit code 0; `/map` is listed successfully and there is no missing Suspense boundary, `window is not defined`, hydration, or CSS import error.

- [ ] **Step 5: Test the missing-key fallback**

Temporarily run without `NEXT_PUBLIC_VIETMAP_API_KEY`, open `/map`, and verify:

```text
- the map error panel is visible;
- filter controls and result cards remain usable;
- no API key appears in committed files.
```

Do not commit a real key.

- [ ] **Step 6: Test geolocation outcomes and responsive behavior**

With `npm run dev`, use browser permission controls to test both Allow and Block. Verify:

```text
- Allow writes latitude/longitude/maxDistanceKm to the URL and selects nearby places.
- Block uses central TP. Hồ Chí Minh, explains the fallback, and offers retry.
- 1/3/5/10/20 km changes both marker count and result count consistently.
- city, category, and keyword compose with the radius.
- marker click opens one popup; card click flies to the same place.
- card focus and marker controls are keyboard usable.
- popup and card show the same address and distance.
- refresh preserves URL filters.
- mobile controls do not overlap the fixed BottomNav.
```

- [ ] **Step 7: Inspect the final diff and commit verification fixes only if needed**

```bash
git status --short
git diff --check
git diff -- frontend/src/app/map frontend/src/components/map frontend/src/features/map frontend/src/stores/search-store.ts frontend/src/components/common/Navbar.tsx frontend/src/components/common/BottomNav.tsx frontend/.env.example test/features/map test/app/map test/components/common/map-navigation.test.tsx
```

Expected: no whitespace errors, no real API key, no route code, and no unrelated files staged. If verification required fixes, commit exactly those files:

Stage the map scope; already committed unchanged files are ignored by Git:

```bash
git add frontend/src/app/map frontend/src/components/map frontend/src/features/map frontend/src/stores/search-store.ts frontend/src/components/common/Navbar.tsx frontend/src/components/common/BottomNav.tsx frontend/.env.example test/features/map test/app/map test/components/common/map-navigation.test.tsx
git commit -m "fix(map): resolve nearby map verification issues"
```

If no fixes were required, do not create an empty commit.

## Final Acceptance Checklist

- [ ] `/map` is a Server Component route with a Suspense boundary.
- [ ] VietMap is loaded through a Client Component dynamic import with `ssr: false`.
- [ ] Radius options are exactly 1/3/5/10/20 km and default to 5 km.
- [ ] Current location succeeds or falls back clearly to TP. Hồ Chí Minh.
- [ ] URL is the only durable filter source; Zustand contains only transient interaction state.
- [ ] Marker, popup, card, address, distance, and result count stay synchronized.
- [ ] Empty, loading, query-error, location-error, missing-key, and SDK-error states are usable.
- [ ] Desktop and mobile navigation expose `/map` without exceeding five mobile items.
- [ ] No routing, clustering, geocoding, backend work, or real key entered the change.
- [ ] Focused tests, full tests, lint, and production build pass.
