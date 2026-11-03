# Map Discovery UI-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read this entire plan before editing. Check `git status` first and preserve all unrelated or concurrent working-tree changes.

**Goal:** Redesign `/map` to match the layout and interactions in `D:\TIM_KIEM_DIA_DIEM.md`, using mock data so the user can test the interface now; backend integration is explicitly postponed.

**Architecture:** Keep `frontend/src/app/map/page.tsx` as a Server Component and the existing VietMap client loader. `MapExplorer` composes a split result/map view, URL-backed filters, and TanStack Query hooks. Place/category/area/detail data comes from one mock service layer, not directly from components; a future backend service can implement the same UI-facing interface without rewriting the page. Zustand only keeps temporary selected/hovered/viewport state.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript, Tailwind, existing shadcn/Base UI primitives, Lucide, VietMap GL JS, TanStack Query, Zustand, Turf.js, Vitest/Testing Library.

**Spec:** User-provided `D:\TIM_KIEM_DIA_DIEM.md`, with the user's clarification on 2026-09-20: **UI and frontend mock behavior only; the user will handle backend later.**

## Global Constraints

- Do **not** call `/api/v1/places/*`, implement a backend endpoint, change backend code, change `.env.example` for API integration, or require a running backend/DB. Do not integrate or stage any concurrently created `frontend/src/features/map/api/*` files during this UI-only task.
- Read `plan.md`, `.agents/skills/travel-frontend/SKILL.md`, `.agents/skills/ui-ux-pro-max/SKILL.md`, and the relevant `frontend/node_modules/next/dist/docs/` guides before editing Next.js code. Use existing site tokens and navigation; do not rebrand the whole app.
- Keep VietMap GL JS. Do not install Leaflet, another map SDK, or a new UI framework. Retain the missing-map-key and SDK-error list fallback.
- Default a fresh `/map` visit to Đà Nẵng (`lat 16.0544`, `lng 108.2022`, zoom about 13). Do not request GPS until “Tìm quanh đây” is clicked. Preserve valid coordinates already present in a shared URL, including the old TP.HCM URL.
- Use clearly labelled **dữ liệu mẫu / bản demo** for mock result counts, AI relevance, favorites, and planner actions. Never claim a real account save, actual AI semantic search, or 2,100 live backend places.
- Keep mock fixtures in `frontend/src/mocks/` and mock retrieval/filtering in a service or pure helper; do not hardcode business data inside `page.tsx` or card components. This phase needs no backend DTO/response-envelope adapter.
- Preserve all unrelated pre-existing or concurrent work, currently including profile, navbar, avatar/user-data, planner, and potentially map files being edited by another agent. If another agent is actively modifying the same map files, stop overlapping edits and coordinate with the user rather than overwriting them.

## Review Focus

1. Empty/invalid search: show a useful zero-results message and reset actions, not a blank map or a fabricated match.
2. Location denied/unavailable: retain the selected area and results with a clear explanation and retry action.
3. Search/filter changes: list, marker set, result count, and URL must represent the same mock result set; reset page to 1.
4. Missing mock image/phone/hours: show placeholders or omit actions, never broken images or invented contact details.
5. Mobile/keyboard: list-map toggle, filters, marker controls, and detail dialog remain usable at 375 px and by keyboard.

---

### Task 1: Mock Discovery Data and Service Contract

**Files:**
- Create `frontend/src/mocks/data/map-discovery.ts` with demo places, areas, categories, and detail information.
- Create `frontend/src/features/map/services/map-discovery.service.ts` with pure filtering/sorting/pagination and Promise-returning service methods.
- Modify `frontend/src/features/map/types.ts` only as required for the UI-facing types.
- Test `test/frontend/features/map/services/map-discovery.service.test.ts`.

**Interfaces:**

```ts
type SearchMode = "keyword" | "ai";
type SortKey = "rating" | "reviews" | "distance";
type RadiusKm = 1 | 3 | 5 | 10 | 20;

interface DiscoveryFilters {
  mode: SearchMode;
  areaSlug: string;
  keyword: string;
  categorySlug: string; // "all" means no category restriction
  radiusKm: RadiusKm;
  latitude: number;
  longitude: number;
  openNow: boolean;
  priceLevels: number[]; // existing Place.priceLevel values 1–4
  minRating: number | null;
  sortBy: SortKey;
  page: number;
}

interface DiscoveryPage {
  items: DiscoveryPlace[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

- [ ] Write failing tests for keyword by name/address/tags, category, area, 1/3/5 km radius with Turf distance, open-now, price, minimum rating, three sort choices, deterministic AI-demo matching, and pagination. Include a no-result case. Run `npm test -- ../test/frontend/features/map/services/map-discovery.service.test.ts` from `frontend/` and confirm failure.
- [ ] Add a small but varied fixture set with real-looking, explicitly **mock** Đà Nẵng places across the document's main categories, plus a few TP.HCM places to preserve old shared URLs. Use image URLs/assets already allowed by Next image configuration or category placeholders. Include null image/phone/hours cases and sample sources; do not invent a large result count.
- [ ] Implement `getAreas()`, `getCategories()`, `searchPlaces(filters): Promise<DiscoveryPage>`, and `getPlaceById(id)` in the mock service. Category counts are derived from fixtures, not hardcoded. AI mode may compute a deterministic local demo score from the same fixture fields; expose it as `demoSimilarityScore` and label it as simulated in UI.
- [ ] Rerun the focused tests. Commit only this task's files as `feat(map): add mock discovery service` if no concurrent agent owns them.

### Task 2: URL State, Area/Radii, and GPS Demo Flow

**Files:**
- Modify `frontend/src/features/map/map-config.ts`, `lib/map-query.ts`, `hooks/use-map-filters.ts`, `hooks/use-geolocation.ts`, and `hooks/use-places.ts`.
- Test `test/frontend/features/map/lib/map-query.test.ts`, `test/frontend/features/map/hooks/use-geolocation.test.ts`, and `test/frontend/features/map/hooks/use-places.test.tsx`.

**Interfaces:** `useMapFilters()` returns `{ filters: DiscoveryFilters, replaceFilters(next: DiscoveryFilters): void }`; `usePlacesQuery(filters)` returns the mock `DiscoveryPage` through TanStack Query. Existing `useSearchStore` remains interaction-only.

- [ ] Write failing URL tests for default Đà Nẵng, valid explicit coordinates, malformed radius/page fallback, filter changes resetting page, and refresh/back preservation. Write geolocation tests asserting permission is requested only after click and denial does not overwrite current area. Run the three focused test files and confirm failure.
- [ ] Update the default center and city/area options. Parse/serialize every visible filter in the URL; keep transient mobile tab/dialog/hover state out of it. `router.replace` may be used for typing and `router.push` for committed page/area changes so Back remains sensible.
- [ ] When GPS succeeds, set center from browser coordinates, switch area to “Quanh tôi”, and filter the mock fixture by the selected radius. On denial/timeout, leave the previous results in place and show a retry message. No network request to the backend occurs.
- [ ] Rerun focused tests. Commit as `feat(map): support demo area and nearby filters` if no concurrent agent owns these files.

### Task 3: Split-Screen Search/Filter UI

**Files:**
- Modify `frontend/src/app/map/page.tsx`, `frontend/src/features/map/MapExplorer.tsx`, and `MapFilters.tsx`.
- Create or reuse focused components under `frontend/src/features/map/components/`: `MapSearchTabs.tsx`, `MapQuickCategories.tsx`, `MapAdvancedFilters.tsx`, `MapMobileViewToggle.tsx`.
- Test `test/frontend/features/map/components/MapFilters.test.tsx`, `MapExplorer.test.tsx`, and `test/frontend/app/map/page.test.tsx`.

- [ ] Write failing component tests for keyword/AI tabs, area dropdown, horizontally scrollable category chips and fixture counts, 1/3/5 km radius, open-now/price/rating/sort controls, clear/reset, GPS click, and mobile list/map toggle. Test the visible `AI mô phỏng` disclosure. Run focused tests and confirm failure.
- [ ] Build the document's desktop layout: search/tabs and quick filters across the top, then a 45–50% results pane beside a 50–55% sticky map. Use one-column result cards in the narrow pane. On mobile show only one pane at a time with a floating “Xem bản đồ” / “Xem danh sách” control that clears the app's bottom navigation.
- [ ] Render areas/categories/counts from `mapDiscoveryService` through hooks; do not place fixture arrays in components. Show AI as an **interactive demo mode** with natural-language input and labelled simulated relevance, not a disabled tab and not a claimed backend/LLM result.
- [ ] Use the existing design tokens and Lucide/category icons; avoid emoji as structural controls. Keep loading skeleton, error/retry demonstration, and empty state available through the mock service/test fixtures.
- [ ] Rerun tests. Commit as `feat(map): build split-view discovery UI` if no concurrent agent owns these files.

### Task 4: Cards, Markers, Pagination, and Map Sync

**Files:**
- Modify `frontend/src/features/map/MapResults.tsx`, `MapPlaceCard.tsx`, `frontend/src/components/map/VietMap.tsx`, `PlaceMarker.ts`, and `MapPopup.ts`.
- Test `test/frontend/features/map/components/MapResults.test.tsx`, `VietMap.test.tsx`, and `MapExplorer.test.tsx`.

- [ ] Write failing tests for mock photo/placeholder, category, rating/review count, open/closed/unknown state, address, distance, AI-demo score only in AI mode, hover/focus-highlighted marker, marker popup, and page controls. Assert the card IDs and marker IDs are identical for the visible page.
- [ ] Run focused tests and confirm failure. Render only the current page's markers; card hover/focus highlights its marker, marker click selects the card and opens a compact popup. Fit bounds when result set/area changes, not on every hover.
- [ ] Keep result count honest: derive it from mock fixtures and show a “Dữ liệu mẫu” label. Pagination or “Xem thêm” must update list and map together. Preserve the current map error/missing-key fallback so cards remain usable.
- [ ] Rerun tests. Commit as `feat(map): sync demo cards and map` if no concurrent agent owns these files.

### Task 5: Mock Place Detail Dialog and Secondary UI

**Files:**
- Create `frontend/src/features/map/MapPlaceDetailDialog.tsx` (or a focused component under `features/map/components/`).
- Modify `MapExplorer.tsx`, `MapPlaceCard.tsx`, and `MapPopup.ts` to open detail by mock ID.
- Test `test/frontend/features/map/components/MapPlaceDetailDialog.test.tsx` and `MapExplorer.test.tsx`.

- [ ] Write failing tests for opening the dialog from card/popup, image gallery/placeholder, contact link only when present, website, mock seven-day hours, source badges derived from fixture data, close/Escape/focus restore, and the planner/favorite preview actions. Run focused tests and confirm failure.
- [ ] Implement with existing `frontend/src/components/ui/dialog.tsx` and `mapDiscoveryService.getPlaceById`. Use a clear “Thông tin mẫu” label. The favorite heart can toggle demo state in the current session (or local storage if already used by the project), but must not claim account persistence.
- [ ] Show the “Thêm vào lịch trình” CTA and its UI preview/next-step dialog, but do not mutate a saved trip or claim it was added. If the existing planner can accept a mock place through a documented, tested interface, that integration is a separate task requiring review, not an implicit part of this map redesign.
- [ ] Rerun tests. Commit as `feat(map): add mock place detail preview` if no concurrent agent owns these files.

### Task 6: Visual and Regression Verification

**Files:** Modify only task-scope frontend/test files if a concrete verification failure requires it.

- [ ] From `frontend/`, run `npm test`, `npm run lint`, and `npm run build`; report exact outputs. Run `git diff --check` and confirm unrelated changes remain untouched.
- [ ] Open `/map` and test at 375, 768, 1024, and 1440 px: both search tabs, all filters, radius, GPS allowed/denied, list/map toggle, marker/card sync, pagination, detail dialog, keyboard focus, URL refresh/back, empty/loading/error states, and missing VietMap key.
- [ ] Confirm no `/api/v1/places` fetch, backend file change, new map library, real account-save claim, or real-AI claim. List all UI changes and explicitly say what remains for the later backend integration. Do not push unless the user separately asks.

## Acceptance Criteria

- The `/map` interface follows the supplied split-screen layout on desktop and has an intentional list/map switch on mobile.
- Fresh visits default to Đà Nẵng; “Tìm quanh đây” requests GPS only after a click, and existing valid shared coordinates still render.
- Keyword, AI-demo, area, category, radius, price, rating, open-now, sort, and pagination work against the same mock service without a backend.
- Cards, map markers, popups, and the mock detail dialog stay synchronized and remain usable if VietMap fails.
- Mock counts, AI relevance, favorite state, and planner CTA are visibly marked as demo/preview where appropriate; no actual backend result is implied.
- Focused/full tests, lint, build, and responsive/keyboard checks pass; unrelated in-progress work is preserved.
