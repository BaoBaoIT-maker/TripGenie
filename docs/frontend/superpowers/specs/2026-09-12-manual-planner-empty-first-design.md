# Manual Planner Empty-First Design

**Date:** 2026-09-12  
**Status:** Approved in chat; awaiting written-spec review  
**Affected flow:** `/planner/new?mode=manual` → `/planner/[id]/edit`

## Goal

Correct the manual-planner flow so it creates an empty itinerary instead of reusing AI generation. A user supplies only the trip basics, opens the editor, then deliberately selects existing places and arranges them into the itinerary.

## Current Problem

`frontend/src/app/planner/new/page.tsx` currently builds an `AiPlannerInput` and calls `plannerService.generateAiPlanner()` for both AI and manual modes. The button label changes, but the underlying behavior does not. As a result, a supposedly manual trip arrives in the editor with AI-selected stops.

The manual form also exposes AI-oriented fields—wishlist places, interests, trip style, pace, companion type, transport, and extra prompt notes—which makes the two modes feel like visual variants of the same generator rather than different workflows.

## Product Decisions

### Separate creation semantics

AI and manual modes are distinct flows:

```text
AI mode
→ collect AI prompt/preferences
→ generateAiPlanner(input)
→ createPlanner(generated)
→ open populated editor

Manual mode
→ collect trip basics
→ createManualPlanner(input)
→ persist planner with empty days
→ open empty editor
→ user selects existing places
```

Manual mode must never call `generateAiPlanner()` or derive stops from `MOCK_PLACES` during creation.

### Manual form fields

The manual form contains only:

- trip title;
- optional description;
- destination;
- start and end dates;
- number of travelers;
- budget;
- cover image.

It does not render or submit:

- wishlist places;
- interests;
- trip style preference;
- pace;
- companion category;
- transport preference;
- AI/freeform prompt notes.

The form uses empty title/description defaults, keeps a useful destination placeholder, and derives date defaults from the current local date rather than hardcoding a past or future calendar date. Start date defaults to today and end date defaults to the following day.

### Empty-first editor

The editor still creates one `PlannerDay` for every inclusive date in the trip. Every day starts with `items: []` and `dayTotalCost: 0`. The total estimated cost is `0`, `summaryRoute` is empty, `matchScore` is absent, `style` is `"Tự thiết kế"`, and status is `"draft"`.

The editor retains the existing day tabs, budget panel, companion panel, save/preview actions, place search, item form, and drag-and-drop behavior. The change is an onboarding empty state and clearer add-place language, not a new editor.

## Chosen Approach

Use a dedicated manual form plus a dedicated service mutation. This is preferred over either selecting places on the creation form or introducing a multi-step wizard.

Reasons:

- it gives AI and manual modes truthful, independently testable behavior;
- it reuses the existing `PlaceSearchDialog`, `PlannerItemDialog`, timeline, and save logic;
- it keeps the creation screen short;
- it avoids duplicating place selection in two routes;
- it does not introduce new navigation steps or dependencies.

## Architecture

### Form boundary

Keep the route shell and mode switcher in `frontend/src/app/planner/new/page.tsx`. Extract the manual experience into a focused `ManualPlannerForm` Client Component. The existing AI form and AI submit path retain their behavior.

The manual component owns its React Hook Form state, validates through Zod, and calls `useCreateManualPlannerMutation`. On success it navigates to `/planner/{id}/edit`. On failure it preserves form values and shows a retryable error/toast.

### Domain boundary

Add a pure manual-planner factory responsible for date expansion and empty planner construction. The service supplies the unique ID, current timestamp, current-owner metadata, and persists through the existing repository.

```text
ManualPlannerForm
    ↓ valid ManualPlannerInput
useCreateManualPlannerMutation
    ↓
plannerService.createManualPlanner(input)
    ↓
buildManualPlanner(input, owner, id, now)
    ↓
plannerRepository.create(planner)
```

The UI must not manufacture `PlannerDay[]`, IDs, owner records, timestamps, or cost totals.

### Existing planner editor boundary

`ItineraryEditor` remains responsible for active-day selection, place selection, item editing, delete confirmation, and drag-and-drop. It gains only derived empty-state presentation and clearer CTA labels.

## Data Contracts

### Manual input

```ts
export interface ManualPlannerInput {
  title: string;
  description?: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  people: number;
  coverImage: string;
}
```

This type is deliberately separate from `AiPlannerInput`; no AI-only field is optionalized or reused for manual creation.

### Factory contract

```ts
export function buildManualPlanner(
  input: ManualPlannerInput,
  owner: PlannerMember,
  id: string,
  now: Date,
): Planner;
```

Factory invariants:

- uses the service-supplied unique `manual-plan-*` ID without regenerating it;
- expands dates inclusively in local-date-safe `YYYY-MM-DD` form;
- rejects an empty title or destination;
- rejects invalid dates and `endDate < startDate`;
- requires `people >= 1` and `budget >= 0`;
- returns exactly one day per inclusive date;
- returns no `PlannerItem` records;
- sets each `dayTotalCost` and the planner's `estimatedTotalCost` to `0`;
- creates the owner as the only initial member;
- creates an empty invitation array;
- sets `style: "Tự thiết kế"`, `status: "draft"`, and an empty `summaryRoute`;
- does not set `matchScore`.

### Service contract

```ts
createManualPlanner(input: ManualPlannerInput): Promise<Planner>
```

The service creates the unique `manual-plan-*` ID, captures one `Date`, builds the planner using `CURRENT_USER`, persists it through `plannerRepository.create`, and returns the stored normalized result. `generateAiPlanner` remains unchanged and is not called by this method.

## Manual Creation UI

### Header and mode context

When `mode=manual`:

- heading: **Tạo chuyến đi thủ công**;
- supporting copy: **Khởi tạo chuyến đi trước, sau đó tự thêm và sắp xếp địa điểm theo ý bạn.**;
- mode switcher continues to expose **Tạo bằng AI** and **Tự thiết kế**;
- switching modes changes the URL and renders the correct mode-specific form without leaking values from hidden AI fields into the manual payload.

### Form layout

Desktop uses the current two-column visual language:

```text
Left: cover image + trip title + description
Right: destination + dates + people + budget + next-step explanation
```

Mobile stacks into one column in the same semantic order. Fields use visible labels and inline validation. Buttons and selectable cover images have at least a 44 px interaction target and visible keyboard focus.

### Progressive explanation

Show a compact, non-interactive three-step guide near the submit action:

```text
1. Tạo chuyến đi
2. Chọn địa điểm
3. Sắp xếp lịch trình
```

Use Lucide icons from the project's existing icon family; do not use emoji as structural icons.

### Submit behavior

The primary CTA is **Tạo chuyến đi trống**. While pending it reads **Đang tạo chuyến đi…** and is disabled. Successful creation shows a concise toast and navigates directly to the editor. Failure keeps every form value and enables retry.

## Empty Editor Experience

### Whole-itinerary onboarding

If every day has zero items, render one onboarding panel above the day tabs:

- title: **Lịch trình của bạn đang trống**;
- description: **Chọn địa điểm có sẵn để bắt đầu xây dựng chuyến đi theo cách của bạn.**;
- primary CTA: **Chọn địa điểm đầu tiên**;
- CTA opens the existing place search for the currently active day.

This panel is removed immediately after the first item is added. It must not return when another day remains empty but the trip already contains at least one stop.

### Per-day empty state

An empty active day continues to show a dashed empty card, with copy identifying that day. The end-of-day action reads **Thêm địa điểm vào ngày này**. For nonempty days it reads **Thêm địa điểm**.

Both the global CTA and per-day CTA use the same path:

```text
open PlaceSearchDialog
→ choose an existing Place
→ open PlannerItemDialog for active day
→ validate time/duration/cost/note
→ upsert PlannerItem into active day
→ mark draft dirty
```

Closing either dialog without completing the action does not create a stop.

### After the first place

The existing timeline card, cost recalculation, save state, preview behavior, editing, delete, and drag-and-drop continue unchanged. Adding a stop updates the draft only; the user explicitly saves using the existing **Lưu chuyến đi** action.

## Validation and Error Handling

Manual form schema:

- title: trimmed, 1–100 characters;
- description: trimmed, maximum 500 characters;
- destination: trimmed, 1–120 characters;
- start date: required valid `YYYY-MM-DD`;
- end date: required valid `YYYY-MM-DD` and not earlier than start date;
- people: integer from 1 to 50;
- budget: numeric, minimum `0`;
- cover image: required valid URL chosen from the existing cover set.

Errors appear beside the relevant fields. On unexpected service failure, show a toast/error message while retaining values. Repository normalization remains a final safety boundary, not a substitute for form/domain validation.

## Component and File Responsibilities

```text
app/planner/new/page.tsx
  Route shell, Suspense, mode switcher, unchanged AI flow, manual component selection

features/planner/components/ManualPlannerForm.tsx
  Manual-only fields, three-step guide, validation display, submit/navigation

features/planner/schemas/manual-planner-schema.ts
  Zod schema and form value normalization

features/planner/model/manual-planner.ts
  Pure date expansion and empty Planner construction

services/planner.service.ts
  createManualPlanner orchestration and persistence

features/planner/hooks/use-planner.ts
  create-manual mutation and planner cache updates

features/planner/components/ItineraryEditor.tsx
  Whole-trip empty onboarding, active-day CTA wording, existing add-place flow
```

Do not add another state library, UI library, wizard route, or second place-search implementation.

## Accessibility and Responsive Requirements

- Every field has a programmatic label and linked error message.
- Mode tabs expose selected state.
- The three-step guide is an ordered list, not three clickable fake buttons.
- Empty-state actions are real buttons with visible focus.
- Place selection remains keyboard accessible through the existing dialog.
- Drag-and-drop retains its keyboard sensor after this change.
- Validate at 375, 768, 1024, and 1440 px.
- No content is hidden behind the mobile bottom navigation.
- Motion is limited to existing subtle transitions and respects reduced-motion behavior.

## Testing Strategy

### Domain tests

- inclusive one-day and multi-day expansion;
- invalid/reversed dates;
- empty item arrays for every day;
- zero totals, empty route, absent match score, manual style/status;
- owner membership and stable input copying.

### Service and hook tests

- `createManualPlanner` persists the empty planner;
- it never invokes `generateAiPlanner`;
- successful mutation seeds the created planner detail and invalidates the planner-list query cache;
- persistence survives repository reload/local-storage access.

### Page and form tests

- `mode=manual` renders only the seven approved fields and the three-step guide;
- AI-only fields are absent in manual mode;
- invalid fields block submission and show inline errors;
- manual submit calls only the manual mutation and navigates to `/planner/[id]/edit`;
- service failure retains field values and allows retry;
- `mode=ai` retains its existing generation test.

### Editor tests

- an all-empty planner renders the whole-itinerary onboarding panel;
- **Chọn địa điểm đầu tiên** opens `PlaceSearchDialog` for the active day;
- an empty day reads **Thêm địa điểm vào ngày này**;
- selecting and confirming a place adds exactly one item to the chosen day;
- the onboarding panel disappears after the first item;
- cost and dirty-state behavior still work;
- closing dialogs creates no item.

### Verification

- targeted tests for manual domain/form/editor;
- complete Vitest suite;
- ESLint;
- production build;
- manual browser check for both `mode=manual` and `mode=ai` at desktop and mobile widths.

## Migration and Compatibility

Existing AI planners, saved manual planners, repository storage version, planner preview, invitations, and item editing remain compatible. No stored-data migration is required because the `Planner` shape is unchanged; only a new input type and creation path are introduced.

Existing user-created planners that already contain stops are not emptied or rewritten.

## Definition of Done

- Manual creation never calls AI generation.
- The manual form contains only the approved basic fields.
- A manual planner opens with the correct number of days and zero places.
- The editor clearly guides the user to select the first existing place.
- Adding a place uses the current search/item dialogs and targets the active day.
- AI creation behavior remains unchanged.
- Failed submissions retain user input.
- Existing save, preview, cost, companion, edit, delete, and drag-and-drop behavior remains intact.
- Targeted tests, full tests, lint, and production build pass.
