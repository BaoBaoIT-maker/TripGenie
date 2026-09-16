# AI Planner Editor Design

**Date:** 2026-09-11

**Status:** Approved in chat; awaiting written-spec review

## Objective

After a user submits the AI planner form, create a real editable planner draft and navigate to a dedicated editing workspace. The workspace must let the user reorder and move itinerary stops, add or edit places, preview costs, invite mock user accounts, and persist changes locally so the complete interface can be tested before a backend exists.

## Scope

This iteration includes:

- generating an editable planner draft from the existing AI form;
- navigating to `/planner/[id]/edit` with the generated planner ID;
- editing trip metadata and itinerary stops;
- reordering stops within a day and moving stops between days;
- searching mock places and adding a stop to a selected day;
- inviting mock user accounts with view or edit permission;
- showing invitation states and current companions;
- saving and reloading planner data through the existing service boundary;
- responsive, accessible loading, empty, error, dirty, saving, and saved states.

This iteration does not include:

- real email delivery;
- real user authentication or a real user directory;
- realtime collaboration, presence, voting, or WebSockets;
- a production AI provider call;
- a production routing API.

## Chosen Architecture

Use a dedicated `/planner/[id]/edit` route for editing and retain `/planner/[id]` as the read-only preview/detail route. This matches `plan.md`, keeps view and edit responsibilities separate, and avoids growing the existing detail page into a mixed-mode component.

The page remains a Server Component boundary where practical and renders an interactive client editor child. Editing state belongs in a planner draft store because it is temporary, mutable client state. Persisted planner data is accessed through TanStack Query hooks and `plannerService`; UI components must not read or write `localStorage` directly.

The mock implementation uses a local-storage-backed repository behind `plannerService`. Its method signatures and payloads mirror the future REST API so the storage implementation can later be replaced without rewriting the editor UI.

## User Flow

### AI generation

1. The user completes `/planner/new?mode=ai` and selects “Tạo lịch trình với AI”.
2. The form validates required fields and date order.
3. `plannerService.generateAiPlanner(input)` creates a generated planner containing populated days and stops.
4. `plannerService.createPlanner(generatedPlanner)` persists that exact planner.
5. The application navigates to `/planner/{generatedPlanner.id}/edit`.
6. Generation failures keep the form values and show a retryable error.

The application must never route to a hard-coded mock planner ID after generation.

### Editing

1. The editor loads the planner by route ID.
2. The user can edit title, description, cover image, destination, dates, people, budget, and style.
3. The user can switch between itinerary days.
4. The user can reorder stops within one day or move a stop to another day.
5. The user can add, edit, or remove stops.
6. Changes mark the draft as dirty but are not claimed as saved until persistence succeeds.
7. “Xem trước” opens `/planner/[id]` using the latest successfully saved data. If unsaved changes exist, the UI asks the user to save or discard them before leaving.
8. “Lưu chuyến đi” persists the full normalized planner and clears the dirty state after success.

### Inviting companions

1. The user selects “Mời bạn cùng đi”.
2. An invite dialog searches a mock account directory by display name or email.
3. The user selects exactly one account and chooses `viewer` or `editor` permission.
4. Submitting creates a mock invitation with `pending` status.
5. The companion panel shows accepted members separately from pending invitations.
6. Duplicate invites, inviting the current user, and inviting an existing member are rejected with inline feedback.
7. For UI testing, pending invitations may expose a clearly labelled mock action that changes the status to `accepted` or `declined`.

The interface and service contract must be ready for real accounts later, but no message or email is sent in this iteration.

## Editor Layout

### Desktop

Use a two-column layout inspired by the supplied references:

- Left, approximately two thirds: trip information followed by the detailed day itinerary.
- Right, approximately one third: sticky budget summary and companion/invitation panel.
- Header actions: back, preview, save, and visible dirty/saving/saved status.

### Mobile and tablet

- Stack trip information, itinerary, budget, and companions vertically.
- Keep day selection horizontally scrollable.
- Use dialogs or bottom sheets for place search, stop editing, and invitations.
- Drag handles must remain usable with touch and keyboard controls.

## Itinerary Interactions

Use `@dnd-kit` and stable `PlannerItem.id` values.

After a drag operation:

1. update the draft day arrays;
2. normalize every affected item’s `order` field to a one-based sequence;
3. recalculate affected day totals and the planner total;
4. mark the draft dirty;
5. leave route recalculation behind an explicit service/hook boundary so a future routing API can replace the current mock calculation.

Each itinerary card includes:

- drag handle and ordinal number;
- place image, name, and address;
- day, start time, end time, and duration;
- estimated cost and note;
- edit and delete actions.

The edit dialog validates that end time is after start time, duration and cost are non-negative, and the target day exists. Deletion requires a confirmation dialog because it discards user-entered itinerary data.

At the end of each day list, show a prominent dashed “Tìm địa điểm mới” button. It opens a searchable mock catalog with loading, empty, and error states. Selecting a result opens or advances to stop details so the user can choose day, time, duration, cost, and note before adding it.

## Data Model

Extend the planner domain with draft-safe metadata and collaboration types:

```ts
export type PlannerStatus = "draft" | "saved";
export type PlannerMemberRole = "owner" | "editor" | "viewer";
export type PlannerInvitationStatus = "pending" | "accepted" | "declined";

export interface PlannerMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: PlannerMemberRole;
}

export interface PlannerInvitation {
  id: string;
  plannerId: string;
  invitee: PlannerMember;
  permission: Exclude<PlannerMemberRole, "owner">;
  status: PlannerInvitationStatus;
  createdAt: string;
}
```

`Planner` gains `description`, `status`, `members`, `invitations`, `createdAt`, and `updatedAt`. Persisted payloads contain `placeId` plus schedule fields; hydrated `place` data remains available for rendering in the mock response.

## Service Contracts

The frontend uses these service-level operations:

```ts
generateAiPlanner(input: AiPlannerInput): Promise<Planner>
createPlanner(planner: Planner): Promise<Planner>
getPlannerById(id: string): Promise<Planner | null>
updatePlanner(id: string, input: UpdatePlannerInput): Promise<Planner>
searchInviteCandidates(query: string): Promise<InviteCandidate[]>
createPlannerInvitation(
  plannerId: string,
  input: { userId: string; permission: "viewer" | "editor" }
): Promise<PlannerInvitation>
updateMockInvitationStatus(
  plannerId: string,
  invitationId: string,
  status: "accepted" | "declined"
): Promise<Planner>
```

These correspond to the intended future REST surface:

```text
POST  /planners/ai-generate
POST  /planners
GET   /planners/:id
PATCH /planners/:id
GET   /users/search?query=...
GET   /planners/:id/invitations
POST  /planners/:id/invitations
PATCH /planners/:id/invitations/:invitationId
```

## Persistence Rules

- Use one versioned local storage document owned by the mock repository.
- Merge seeded planners with user-created planners by ID instead of replacing seed data wholesale.
- Read the route ID from storage first, then fall back to a matching seed planner.
- Writes update both the selected planner detail and planner-list results.
- Failed parsing falls back safely and surfaces a recoverable warning instead of silently destroying data.
- Save operations update `updatedAt`; first persistence sets `createdAt`.
- The editor must never show a success toast if persistence fails.

## Component Boundaries

Keep components focused by responsibility:

- `PlannerEditor`: coordinates loading, draft lifecycle, save, and navigation.
- `TripDetailsEditor`: edits planner-level metadata.
- `ItineraryEditor`: owns day selection and drag/drop context.
- `SortablePlannerItem`: renders one draggable stop.
- `PlannerItemDialog`: adds or edits schedule details.
- `PlaceSearchDialog`: searches and selects a place.
- `BudgetSummary`: derives planner and per-day totals.
- `CompanionPanel`: displays members and pending invitations.
- `InviteCompanionDialog`: searches accounts and creates invitations.
- planner draft store: immutable draft updates and dirty-state tracking.
- query/mutation hooks: server-state loading and persistence orchestration.

Existing components should be reused where responsibilities already match. The implementation must not perform an unrelated global refactor.

## Error and State Handling

- Planner load: skeleton, loaded editor, not-found state, and retryable error.
- AI generation: idle, generating, success, and failure.
- Save: disabled when clean or invalid; saving indicator; success state; retryable failure while preserving the draft.
- Place search and user search: debounced query, loading, empty, error, and results.
- Invite mutation: submitting state, duplicate/self/existing-member validation, and error feedback.
- Drag/drop: retain the previous valid order if a state update cannot be completed.
- Unsaved navigation: confirm before discarding a dirty draft.

## Accessibility

- All dialogs and sheets use accessible shadcn/Radix primitives.
- Dragging supports a visible handle, keyboard sensors, and screen-reader announcements.
- Buttons have text or accessible names; clickable behavior is not attached to plain `div` elements.
- Focus returns to the trigger after dialogs close.
- Validation errors are associated with their fields.
- Color is not the only indication of invitation or save status.

## Testing and Verification

Unit tests cover:

- planner normalization and total recalculation;
- reorder within a day;
- move between days;
- local repository create/read/update behavior;
- invitation duplicate/self/member guards;
- invitation status transitions.

Component or integration tests cover:

- AI submission persists the generated ID and navigates to its edit route;
- editing a card updates the draft;
- adding a searched place appends and normalizes order;
- saving persists changes across reload;
- inviting a mock account renders a pending invitation;
- accepted mock invitations move into the member list;
- loading, empty, error, dirty, saving, and saved states.

Manual browser verification covers widths `375`, `768`, `1024`, and `1440` pixels, keyboard drag controls, mouse/touch-style drag behavior, dialogs, save/reload persistence, preview navigation, and console errors.

Run the project’s focused tests, lint, and production build. Before changing Next.js code, read the relevant installed documentation under `frontend/node_modules/next/dist/docs/` as required by the repository’s `AGENTS.md`.

## Acceptance Criteria

- AI generation opens `/planner/{new-id}/edit` for the same planner that was created.
- The generated planner contains editable itinerary days and stops.
- Stops can be reordered within a day and moved between days.
- Adding, editing, and deleting a stop updates totals and dirty state.
- “Tìm địa điểm mới” appears at the end of each day and adds a selected mock place.
- The invite flow searches mock accounts, selects a permission, rejects invalid duplicates, and displays invitation/member states.
- Saving persists the full planner; refreshing and reopening show the saved result.
- The detail route previews saved data without exposing editor controls.
- All requested states and responsive breakpoints are verifiably usable.
- No real invitation, realtime transport, AI provider secret, or backend dependency is introduced.
