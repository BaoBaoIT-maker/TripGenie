# Nearby Places Map Design

**Date:** 2026-09-11  
**Status:** Approved  
**Route:** `/map`

## Goal

Add a dedicated nearby-places map where a visitor can choose a search radius, see matching mock places on VietMap, inspect each address, and move naturally between map markers and result cards.

## Scope

This iteration includes:

- a new `/map` page and navigation entry;
- current-location detection with an explicit TP. Ho Chi Minh fallback;
- a selectable radius of 1, 3, 5, 10, or 20 km;
- keyword, city, and category filters;
- client-side geographic distance calculation against mock place coordinates;
- VietMap markers, a selected-place popup, fit bounds, zoom/pan, and a current-location control;
- two-way marker/card selection and hover synchronization;
- responsive result cards beneath the map;
- shareable URL-backed filters and map center;
- loading, empty, location-denied, missing-key, and map-error states.

This iteration does not include route directions, route polylines, turn-by-turn navigation, clustering, drawing an arbitrary radius on the map, real place search/geocoding, or backend persistence.

## Product Decisions

### Search center

On first entry, the page requests browser geolocation. If permission succeeds, the user's coordinate becomes the search center. If permission is unavailable, denied, or times out, the page falls back to central TP. Ho Chi Minh and displays a non-blocking explanation with a retry action.

Selecting a city changes the center to that city's configured mock coordinate. A successful "Vị trí của tôi" action clears the city restriction and writes the new coordinate to the URL.

### Radius

The initial radius is 5 km. The user chooses one of `1`, `3`, `5`, `10`, or `20` km. A place is visible only when its Turf.js distance from the current center is less than or equal to the selected radius and it also satisfies the active keyword, city, and category filters.

### URL ownership

The URL is the source of truth for durable filters:

```text
/map?latitude=10.7769&longitude=106.7009&maxDistanceKm=5&city=TP.%20H%E1%BB%93%20Ch%C3%AD%20Minh&category=all&keyword=
```

`latitude`, `longitude`, `maxDistanceKm`, `city`, `category`, and `keyword` are parsed and normalized through one schema. Invalid values fall back safely. URL updates use `router.replace` for transient filter changes so typing and radius selection do not flood browser history.

Zustand owns only transient interaction state:

- `selectedPlaceId`;
- `hoveredPlaceId`;
- the most recent map viewport.

The same filter value must never be duplicated in URL state and Zustand.

## Information Architecture

`/map` keeps the existing global Navbar, Footer, and BottomNav. The page content is:

1. heading and short radius summary;
2. compact filter toolbar;
3. interactive map;
4. result count and place cards.

The screenshots are layout references only. The implementation keeps TripTailor's existing typography, orange primary color, rounded cards, spacing, and navigation patterns instead of copying a separate product identity.

### Desktop

The content stays inside the current `max-w-7xl` shell. The map is approximately 520 px high. Filters wrap rather than clipping horizontally. Results use a three-column grid and a compact map-specific card so addresses and distances remain prominent.

### Mobile

The map is approximately 430 px high. Controls maintain 44 px touch targets. Radius/category chips can wrap, and results become a horizontal snap list or one-column compact cards without covering map controls or the fixed BottomNav.

## Interaction Model

### Initial load

1. Parse URL filters.
2. If valid coordinates are present, use them without prompting for location.
3. Otherwise request geolocation once.
4. On success, write the coordinate and default radius to the URL.
5. On failure, use the TP. Ho Chi Minh fallback and show the fallback notice.
6. Fetch mock places through `placeService` and calculate distance in a pure helper.

### Marker and card synchronization

- Hovering or focusing a desktop result card sets `hoveredPlaceId` and visually raises the matching marker.
- Clicking a marker sets `selectedPlaceId`, flies the map to it, and opens its popup.
- Clicking the non-link portion of a result card selects the matching marker and flies to it.
- The explicit "Xem chi tiết" link navigates to `/places/[slug]`.
- Closing the popup clears `selectedPlaceId`.
- When filters remove the selected place, selection is cleared.

Selection, hover, and focus must be keyboard-accessible. Marker buttons need a Vietnamese accessible name containing the place name.

### Viewport behavior

- On first usable result set, fit bounds around the search center and visible places.
- Changing radius or city refits bounds.
- Keyword/category changes refit only when the current selection disappears or the visible result set changes materially.
- Selecting a card or marker uses `flyTo` at a detail zoom.
- Ordinary user pan/zoom updates the transient viewport but does not silently change the search center or radius.

## Data and Interfaces

### Filter model

```ts
export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const;
export type MapRadiusKm = (typeof MAP_RADIUS_OPTIONS)[number];

export interface MapFilters {
  latitude: number;
  longitude: number;
  maxDistanceKm: MapRadiusKm;
  city: string | "all";
  category: PlaceCategory | "all";
  keyword: string;
}
```

### Nearby result

Do not add computed distance to the shared `Place` entity. Return a view model:

```ts
export interface NearbyPlace {
  place: Place;
  distanceKm: number;
}
```

The pure filtering helper accepts `Place[]` and `MapFilters`, applies text/category/city filters, calculates Turf distance using `[longitude, latitude]` coordinate order, applies the radius, and sorts nearest-first with stable place-name tie-breaking.

### Map contract

```ts
export interface VietMapProps {
  places: NearbyPlace[];
  center: { latitude: number; longitude: number };
  radiusKm: MapRadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onRequestCurrentLocation: () => void;
}
```

The public VietMap style URL is constructed from `NEXT_PUBLIC_VIETMAP_API_KEY`; the key is never hardcoded or committed. The existing example environment file must use the v6+ style URL shape documented by the installed VietMap package.

## Component Boundaries

```text
app/map/page.tsx                       Server page, metadata and Suspense shell
features/map/MapExplorer.tsx           Client orchestration and query/filter flow
features/map/MapFilters.tsx            Search, city, category and radius controls
features/map/MapResults.tsx            Result count, empty state and compact cards
features/map/MapPlaceCard.tsx          Accessible card/marker synchronization
features/map/hooks/use-map-filters.ts  URL parsing and updates
features/map/hooks/use-geolocation.ts   Permission/request/fallback state machine
features/map/lib/map-filter.ts          Pure Turf distance and filtering logic
features/map/map-config.ts              Radius options and known city centers
stores/search-store.ts                 Transient selection/hover/viewport only
components/map/VietMapLoader.tsx        Client-only dynamic import boundary
components/map/VietMap.tsx              VietMap lifecycle, fit/fly behavior
components/map/PlaceMarker.tsx          Marker DOM and active states
components/map/MapPopup.tsx             Selected-place popup content
components/map/MapControls.tsx          Zoom and current-location actions
```

Shared components remain presentation-focused. Map feature business rules remain under `features/map`.

## Map Lifecycle and Failure Handling

`VietMapLoader` is a Client Component that dynamically imports `VietMap` with `ssr: false`. The server page does not become a Client Component. The map instance is created once, listeners and markers are cleaned up on unmount, and visible marker/popup changes update without recreating the map.

Failure states:

- missing API key: render a stable in-page error panel while keeping the result list usable;
- SDK/style load error: show retry guidance and retain filters/results;
- geolocation pending: show location progress without blocking the page shell;
- geolocation denied/unavailable/timeout: fall back to TP. Ho Chi Minh and expose retry;
- zero nearby places: show an empty state with actions to expand to 10 km and clear filters.

## Navigation

Add `/map` as "Bản đồ" in the desktop Navbar. On mobile, keep five bottom items by replacing the less task-critical saved-items shortcut with Map; saved items remain reachable through desktop navigation and existing pages. The active state follows the current pathname.

## Testing Strategy

### Unit tests

- URL parsing and normalization, including invalid/missing coordinates and radius;
- URL merge behavior without deleting unrelated params;
- Turf distance filtering and nearest-first sorting;
- city/category/keyword composition;
- geolocation success, denial, unavailable API, and timeout fallback;
- Zustand actions and reset behavior.

### Component tests

- filter controls reflect URL state and update query params;
- result cards display address and formatted distance;
- marker/card selection and hover synchronize through the store;
- empty state actions update radius/reset filters;
- missing API key leaves the list usable;
- Navbar and BottomNav expose the `/map` entry.

The SDK itself is replaced with a focused mock in jsdom. Tests verify integration contracts and lifecycle calls, not VietMap's internal rendering.

### Manual acceptance

- grant and deny browser location permission;
- change each radius and verify result count/markers agree;
- refresh and share a filtered URL;
- hover/focus/click cards and markers;
- verify popup address and detail navigation;
- exercise map on desktop and a narrow mobile viewport;
- run lint, unit tests, and production build.

## Definition of Done

- `/map` is reachable from desktop and mobile navigation.
- A user can choose 1/3/5/10/20 km and see only mock places inside that radius.
- Location success and fallback behavior are both understandable and recoverable.
- Marker, popup, card, result count, and URL filters stay consistent.
- Every place card and popup shows its address and computed distance.
- The page remains useful when the map key or geolocation is unavailable.
- No route/directions code or secret key is added to the browser bundle.
- Targeted tests, full tests, lint, and production build pass.
