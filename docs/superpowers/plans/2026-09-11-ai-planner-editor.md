# AI Planner Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an AI-generated planner into a persistent editing workspace with drag-and-drop stops, place editing/search, mock account invitations, and reliable save/preview behavior.

**Architecture:** Keep `/planner/[id]` as the saved preview and add `/planner/[id]/edit` as a thin Server Component that renders an interactive `PlannerEditor`. Put mutable draft operations in pure planner-domain helpers plus a small Zustand store, and put local-storage persistence behind `plannerService` and TanStack Query hooks so a future backend can replace the mock repository without changing UI components.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Tailwind CSS, shadcn/Base UI, Zustand, TanStack Query, React Hook Form, Zod, `@dnd-kit`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-11-ai-planner-editor-design.md`

## Global Constraints

- Read `plan.md`, `.agents/skills/travel-frontend/SKILL.md`, and `.agents/skills/ui-ux-pro-max/SKILL.md` before implementation.
- Before editing Next.js code, read `frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`, and `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`.
- Preserve all existing uncommitted user changes; do not reset, clean, delete, or broadly reformat the repository.
- Work only inside `frontend/` plus the documentation files named by this plan.
- Do not call an AI provider, send invitations, or add realtime collaboration.
- Do not read or write `localStorage` from React page/components; use the repository through `plannerService`.
- Use `@dnd-kit`; do not implement native HTML5 drag-and-drop.
- Keep the route page a Server Component and the interactive editor in focused Client Components.
- Do not introduce another UI framework.
- Validate at 375, 768, 1024, and 1440 px; support keyboard operation and visible focus.

---

## File Map

### Create

- `frontend/vitest.config.ts` — jsdom test configuration and `@/` alias.
- `frontend/src/test/setup.ts` — Testing Library matchers and storage cleanup.
- `frontend/src/features/planner/model/planner-draft.ts` — pure normalization, totals, reorder, cross-day move, and invite validation.
- `frontend/src/features/planner/model/planner-draft.test.ts` — unit tests for draft operations.
- `frontend/src/features/planner/data/planner.repository.ts` — versioned local-storage repository and legacy-key migration.
- `frontend/src/features/planner/data/planner.repository.test.ts` — persistence tests.
- `frontend/src/features/planner/hooks/use-planner.ts` — TanStack Query planner and invitation hooks.
- `frontend/src/features/planner/stores/planner-draft-store.ts` — mutable editor draft and dirty status.
- `frontend/src/features/planner/components/PlannerEditor.tsx` — editor lifecycle, load/save/preview orchestration.
- `frontend/src/features/planner/components/TripDetailsEditor.tsx` — trip metadata form.
- `frontend/src/features/planner/components/ItineraryEditor.tsx` — day tabs and DnD context.
- `frontend/src/features/planner/components/SortablePlannerItem.tsx` — one draggable itinerary card.
- `frontend/src/features/planner/components/PlannerItemDialog.tsx` — add/edit schedule fields.
- `frontend/src/features/planner/components/PlaceSearchDialog.tsx` — mock catalog search and selection.
- `frontend/src/features/planner/components/BudgetSummary.tsx` — derived total display.
- `frontend/src/features/planner/components/CompanionPanel.tsx` — accepted and pending people.
- `frontend/src/features/planner/components/InviteCompanionDialog.tsx` — mock account lookup, permission, and invitation.
- `frontend/src/features/planner/components/PlannerEditor.test.tsx` — editor integration tests.
- `frontend/src/app/planner/[id]/edit/page.tsx` — dedicated edit route boundary.
- `frontend/src/app/planner/new/page.test.tsx` — AI submission and generated-ID navigation test.

### Modify

- `frontend/package.json` and `frontend/package-lock.json` — test dependencies and scripts only.
- `frontend/src/types/planner.ts` — planner status, metadata, member, invitation, and input types.
- `frontend/src/services/planner.service.ts` — repository-backed CRUD, AI generation, account search, and mock invitations.
- `frontend/src/mocks/data/planners.ts` — normalize seeded planner fields.
- `frontend/src/mocks/data/users.ts` — mock account directory.
- `frontend/src/app/planner/new/page.tsx` — call generate/create and route to the generated ID.
- `frontend/src/app/planner/[id]/page.tsx` — render saved preview data and link to edit; remove fake save behavior.
- `frontend/src/app/planner/page.tsx` — load repository-backed planners through a query rather than direct storage access.

---

### Task 1: Test Harness and Planner Domain Model

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Modify: `frontend/src/types/planner.ts`
- Create: `frontend/src/features/planner/model/planner-draft.ts`
- Test: `frontend/src/features/planner/model/planner-draft.test.ts`

**Interfaces:**
- Produces: `normalizePlanner(planner: Planner): Planner`
- Produces: `reorderPlannerItem(planner: Planner, dayNumber: number, activeId: string, overId: string): Planner`
- Produces: `movePlannerItem(planner: Planner, activeId: string, targetDayNumber: number, overId?: string): Planner`
- Produces: `upsertPlannerItem(planner: Planner, dayNumber: number, item: PlannerItem): Planner`
- Produces: `removePlannerItem(planner: Planner, itemId: string): Planner`
- Produces: `getInviteConflict(planner: Planner, currentUserId: string, candidateUserId: string): "self" | "member" | "pending" | null`

- [x] **Step 1: Install and configure the test runner**

Run from `frontend/`:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Configure Vitest with `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, and the existing `@` alias mapped to `frontend/src`.

- [x] **Step 2: Extend planner types without weakening existing types**

Add these exact domain types and required planner fields:

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
  permission: "editor" | "viewer";
  status: PlannerInvitationStatus;
  createdAt: string;
}

export interface AiPlannerInput {
  title: string;
  description: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  people: number;
  interests: string[];
  wishlistPlaces: string[];
  tripStyle: string;
  pace: string;
  companion: string;
  transport: string;
  extraNotes: string;
  coverImage: string;
}

export type UpdatePlannerInput = Omit<Planner, "id" | "createdAt">;
```

Add `description`, `status`, `members`, `invitations`, `createdAt`, and `updatedAt` to `Planner`. Add an `order` value to every constructed `PlannerItem`; do not suppress type errors with `any`.

- [x] **Step 3: Write failing pure-domain tests**

Test these exact outcomes:

```ts
it("normalizes item order and recomputes day and planner totals", () => {
  const result = normalizePlanner(plannerWithWrongOrdersAndTotals);
  expect(result.days[0].items.map((item) => item.order)).toEqual([1, 2]);
  expect(result.days[0].dayTotalCost).toBe(300_000);
  expect(result.estimatedTotalCost).toBe(300_000);
});

it("reorders two stops within one day", () => {
  const result = reorderPlannerItem(twoStopPlanner, 1, "item-2", "item-1");
  expect(result.days[0].items.map((item) => item.id)).toEqual(["item-2", "item-1"]);
});

it("moves a stop to another day and normalizes both days", () => {
  const result = movePlannerItem(twoDayPlanner, "item-1", 2);
  expect(result.days[0].items).toHaveLength(0);
  expect(result.days[1].items.at(-1)?.id).toBe("item-1");
  expect(result.days[1].items.at(-1)?.order).toBe(result.days[1].items.length);
});

it.each([
  ["owner-id", "self"],
  ["member-id", "member"],
  ["pending-id", "pending"],
])("rejects invalid invitation candidate %s", (candidateId, expected) => {
  expect(getInviteConflict(plannerWithMembers, "owner-id", candidateId)).toBe(expected);
});
```

- [x] **Step 4: Run tests and verify the intended failures**

Run: `npm test -- src/features/planner/model/planner-draft.test.ts`

Expected: FAIL because the domain helper module and extended types are not implemented.

- [x] **Step 5: Implement the pure helpers**

Use immutable array operations. `normalizePlanner` must recalculate `order`, `dayTotalCost`, and `estimatedTotalCost`; every mutating helper must return `normalizePlanner(updatedPlanner)`.

- [x] **Step 6: Run unit tests and quality checks**

Run:

```bash
npm test -- src/features/planner/model/planner-draft.test.ts
npm run lint
```

Expected: planner-domain tests PASS and lint has no new errors.

- [x] **Step 7: Commit the domain foundation**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/types/planner.ts frontend/src/features/planner/model
git commit -m "feat(planner): add editable planner domain model"
```

---

### Task 2: Versioned Mock Repository and Service Contracts

**Files:**
- Create: `frontend/src/features/planner/data/planner.repository.ts`
- Test: `frontend/src/features/planner/data/planner.repository.test.ts`
- Create: `frontend/src/mocks/data/users.ts`
- Modify: `frontend/src/mocks/data/planners.ts`
- Modify: `frontend/src/services/planner.service.ts`
- Create: `frontend/src/features/planner/hooks/use-planner.ts`

**Interfaces:**
- Consumes: `normalizePlanner`, `Planner`, `AiPlannerInput`, `UpdatePlannerInput`, `PlannerInvitation`
- Produces: `plannerRepository.list/get/create/update`
- Produces: `plannerService.generateAiPlanner/createPlanner/getPlanners/getPlannerById/updatePlanner/searchInviteCandidates/createPlannerInvitation/updateMockInvitationStatus`
- Produces: `usePlannersQuery`, `usePlannerQuery`, `useCreatePlannerMutation`, `useUpdatePlannerMutation`, `useCreatePlannerInvitationMutation`, `useUpdateMockInvitationStatusMutation`

- [x] **Step 1: Write failing repository tests**

Use the storage key `triptailor:planners:v1` and cover:

```ts
it("creates and reads a planner by the generated id", async () => {
  await plannerRepository.create(generatedPlanner);
  await expect(plannerRepository.get(generatedPlanner.id)).resolves.toMatchObject({ id: generatedPlanner.id });
});

it("updates a planner without dropping other planners", async () => {
  await plannerRepository.create(firstPlanner);
  await plannerRepository.create(secondPlanner);
  await plannerRepository.update(firstPlanner.id, { ...firstPlanner, title: "Đã đổi" });
  await expect(plannerRepository.list()).resolves.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: firstPlanner.id, title: "Đã đổi" }), expect.objectContaining({ id: secondPlanner.id })]),
  );
});

it("falls back to seeded planners when stored JSON is invalid", async () => {
  localStorage.setItem("triptailor:planners:v1", "not-json");
  await expect(plannerRepository.list()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "planner-saigon-foodie" })]));
});
```

- [x] **Step 2: Verify repository tests fail**

Run: `npm test -- src/features/planner/data/planner.repository.test.ts`

Expected: FAIL because `plannerRepository` does not exist.

- [x] **Step 3: Implement repository merge and migration rules**

Store `{ version: 1, planners: Planner[] }`. On first read, merge seeded planners and legacy `triptailor_user_planners` entries by ID, preferring user entries. Do not clear either key automatically. Return cloned normalized records so consumers cannot mutate repository state by reference.

- [x] **Step 4: Add mock account records**

Create at least six `InviteCandidate` records with stable IDs, Vietnamese display names, non-sensitive example-domain emails such as `lan@example.com`, avatars, and online/offline status. Mark the current mock user as `user-current` so self-invite validation is deterministic.

- [x] **Step 5: Implement service methods and query hooks**

`generateAiPlanner(input)` must create a populated planner with a unique ID, one `PlannerDay` per inclusive date, and two or more `MOCK_PLACES` distributed across days. It returns the planner but does not navigate. `createPlanner` and `updatePlanner` own persistence. Search matches normalized display name or email and returns an empty array for queries shorter than two trimmed characters.

Mutation success handlers must invalidate `['planners']` and `['planner', plannerId]` as appropriate.

- [x] **Step 6: Run repository and domain tests**

Run: `npm test -- src/features/planner`

Expected: all planner tests PASS.

- [x] **Step 7: Commit repository and services**

```bash
git add frontend/src/features/planner/data frontend/src/features/planner/hooks frontend/src/mocks/data/users.ts frontend/src/mocks/data/planners.ts frontend/src/services/planner.service.ts
git commit -m "feat(planner): persist mock planner drafts"
```

---

### Task 3: Fix AI Generation and Generated-ID Navigation

**Files:**
- Modify: `frontend/src/app/planner/new/page.tsx`
- Test: `frontend/src/app/planner/new/page.test.tsx`

**Interfaces:**
- Consumes: `AiPlannerInput`, `plannerService.generateAiPlanner`, `plannerService.createPlanner`
- Produces: navigation to `/planner/${created.id}/edit`

- [x] **Step 1: Write the failing AI submission test**

Mock `generateAiPlanner` to return `{ id: "planner-generated-1", ... }`, mock `createPlanner` to return the same record, submit the form, and assert:

```ts
expect(plannerService.generateAiPlanner).toHaveBeenCalledWith(expect.objectContaining({
  title: "Du lịch Sài Gòn",
  destination: "Thành phố Hồ Chí Minh",
}));
expect(plannerService.createPlanner).toHaveBeenCalledWith(expect.objectContaining({ id: "planner-generated-1" }));
expect(push).toHaveBeenCalledWith("/planner/planner-generated-1/edit");
```

- [x] **Step 2: Verify the test fails for the hard-coded route**

Run: `npm test -- src/app/planner/new/page.test.tsx -t "generated id"`

Expected: FAIL because the page currently routes to `/planner/planner-saigon-foodie`.

- [x] **Step 3: Replace direct storage and hard-coded navigation**

Build one `AiPlannerInput` from the validated form, await generation and creation, then call `router.push(`/planner/${created.id}/edit`)`. Preserve entered values on failure and show an error toast. Keep the submit button disabled and labelled “Đang tạo lịch trình...” while pending.

- [x] **Step 4: Run the focused test and lint**

Run:

```bash
npm test -- src/app/planner/new/page.test.tsx -t "generated id"
npm run lint
```

Expected: PASS and no new lint errors.

- [x] **Step 5: Commit generation flow**

```bash
git add frontend/src/app/planner/new/page.tsx frontend/src/app/planner/new/page.test.tsx
git commit -m "fix(planner): open generated planner editor"
```

---

### Task 4: Editor Route, Draft Store, Metadata, Save, and Preview

**Files:**
- Create: `frontend/src/app/planner/[id]/edit/page.tsx`
- Create: `frontend/src/features/planner/stores/planner-draft-store.ts`
- Create: `frontend/src/features/planner/components/PlannerEditor.tsx`
- Create: `frontend/src/features/planner/components/TripDetailsEditor.tsx`
- Create: `frontend/src/features/planner/components/BudgetSummary.tsx`
- Test: `frontend/src/features/planner/components/PlannerEditor.test.tsx`

**Interfaces:**
- Consumes: `usePlannerQuery`, `useUpdatePlannerMutation`, `normalizePlanner`
- Produces: `usePlannerDraftStore` with `draft`, `isDirty`, `load`, `patch`, `replace`, `markSaved`, `reset`

- [x] **Step 1: Write failing editor lifecycle tests**

Cover loading, not found, error/retry, metadata dirty state, save failure retaining the draft, save success clearing dirty state, and preview navigation. Assert the save button is disabled while clean or invalid.

- [x] **Step 2: Verify lifecycle tests fail**

Run: `npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "editor lifecycle"`

Expected: FAIL because the editor route and components do not exist.

- [x] **Step 3: Add the Server Component route boundary**

Implement the Next.js 16 dynamic route pattern:

```tsx
import { Suspense } from "react";
import { PlannerEditor } from "@/features/planner/components/PlannerEditor";
import { LoadingState } from "@/components/common/LoadingState";

export default async function PlannerEditPage({ params }: PageProps<"/planner/[id]/edit">) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState message="Đang mở trình chỉnh sửa..." />}>
      <PlannerEditor plannerId={id} />
    </Suspense>
  );
}
```

- [x] **Step 4: Implement draft lifecycle and responsive shell**

Load query data once per planner ID into the draft store. Render header actions, trip form, itinerary slot, sticky desktop sidebar, budget, and companion slot. Use a two-column `lg:grid-cols-12` layout and stack at smaller sizes.

Use React Hook Form plus Zod for metadata validation: trimmed non-empty title/destination, `people >= 1`, `budget >= 0`, and `endDate >= startDate`. Form changes call `patch` and mark dirty.

- [x] **Step 5: Implement honest save and preview behavior**

Save calls `updatePlanner(planner.id, normalizePlanner(draft))`. Show saving state, clear dirty only with the returned saved planner, and keep the draft on failure. Preview routes to `/planner/${id}` only when clean; when dirty, open a dialog with “Tiếp tục chỉnh sửa”, “Bỏ thay đổi”, and “Lưu rồi xem trước”.

- [x] **Step 6: Run lifecycle tests and lint**

Run:

```bash
npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "editor lifecycle"
npm run lint
```

Expected: PASS.

- [x] **Step 7: Commit the editor shell**

```bash
git add frontend/src/app/planner/[id]/edit frontend/src/features/planner/stores frontend/src/features/planner/components/PlannerEditor.tsx frontend/src/features/planner/components/TripDetailsEditor.tsx frontend/src/features/planner/components/BudgetSummary.tsx frontend/src/features/planner/components/PlannerEditor.test.tsx
git commit -m "feat(planner): add persistent editor workspace"
```

---

### Task 5: Drag-and-Drop, Stop Editing, and Place Search

**Files:**
- Create: `frontend/src/features/planner/components/ItineraryEditor.tsx`
- Create: `frontend/src/features/planner/components/SortablePlannerItem.tsx`
- Create: `frontend/src/features/planner/components/PlannerItemDialog.tsx`
- Create: `frontend/src/features/planner/components/PlaceSearchDialog.tsx`
- Modify: `frontend/src/features/planner/components/PlannerEditor.tsx`
- Test: `frontend/src/features/planner/components/PlannerEditor.test.tsx`

**Interfaces:**
- Consumes: pure draft helpers from Task 1 and `placeService.getPlaces`
- Produces: accessible within-day reorder, cross-day move, add/edit/delete stop actions

- [x] **Step 1: Write failing itinerary interaction tests**

Cover reorder, moving an item to another day, editing time/cost/note, deletion confirmation, empty day state, and adding a searched place. Assert recalculated orders and totals rather than only checking toast text.

- [x] **Step 2: Verify interaction tests fail**

Run: `npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "itinerary"`

Expected: FAIL because itinerary editor components are absent.

- [x] **Step 3: Implement accessible DnD**

Use `DndContext`, `PointerSensor`, `KeyboardSensor`, `useSensors`, `closestCenter`, `SortableContext`, `verticalListSortingStrategy`, and `sortableKeyboardCoordinates`. Put drag listeners only on a labelled drag handle. Encode the source day and item ID in draggable data; encode the target day in day containers so `onDragEnd` can call the correct pure helper.

- [x] **Step 4: Implement itinerary card and edit dialog**

Render image, place details, day, times, duration, cost, note, edit, and delete. The Zod schema requires `endTime > startTime`, `durationMinutes >= 0`, `estimatedCost >= 0`, and a valid day number. Confirm before deletion.

- [x] **Step 5: Implement the end-of-day place search action**

Place a dashed full-width “Tìm địa điểm mới” button after every day list, including empty days. Debounce queries by 250–350 ms. Render skeleton, retryable error, “Không tìm thấy địa điểm phù hợp”, and result rows. After selection, open `PlannerItemDialog` prefilled with that place and the active day; add only after schedule validation succeeds.

- [x] **Step 6: Run interaction tests and lint**

Run:

```bash
npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "itinerary"
npm run lint
```

Expected: PASS.

- [x] **Step 7: Commit itinerary editing**

```bash
git add frontend/src/features/planner/components/ItineraryEditor.tsx frontend/src/features/planner/components/SortablePlannerItem.tsx frontend/src/features/planner/components/PlannerItemDialog.tsx frontend/src/features/planner/components/PlaceSearchDialog.tsx frontend/src/features/planner/components/PlannerEditor.tsx frontend/src/features/planner/components/PlannerEditor.test.tsx
git commit -m "feat(planner): edit and reorder itinerary stops"
```

---

### Task 6: Mock Real-Account Invitation Flow

**Files:**
- Create: `frontend/src/features/planner/components/CompanionPanel.tsx`
- Create: `frontend/src/features/planner/components/InviteCompanionDialog.tsx`
- Modify: `frontend/src/features/planner/components/PlannerEditor.tsx`
- Test: `frontend/src/features/planner/components/PlannerEditor.test.tsx`

**Interfaces:**
- Consumes: `searchInviteCandidates`, `createPlannerInvitation`, `updateMockInvitationStatus`, `getInviteConflict`
- Produces: searchable mock-account invitation UI with `viewer` and `editor` permissions

- [x] **Step 1: Write failing invitation tests**

Test query shorter than two characters, matching name/email, viewer/editor selection, pending result display, duplicate/self/member rejection, accepted transition moving a person into members, declined transition removing the active pending state, and mutation error recovery.

- [x] **Step 2: Verify invitation tests fail**

Run: `npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "invitation"`

Expected: FAIL because invitation components are absent.

- [x] **Step 3: Implement companion panel**

Show owner and accepted members as avatars with visible role labels. Show pending invitations with name, email, permission, and status text. The primary action opens the invite dialog. Keep “Chấp nhận giả lập” and “Từ chối giả lập” visibly labelled as mock-test controls.

- [x] **Step 4: Implement invitation dialog**

Use a labelled search field, 300 ms debounce, result radio selection, and a permission select with `Có thể xem` and `Có thể chỉnh sửa`. Before mutation, call `getInviteConflict`; show specific inline Vietnamese messages for self, existing member, and pending invitation. Disable submit until one valid account and permission are selected.

- [x] **Step 5: Run invitation tests and lint**

Run:

```bash
npm test -- src/features/planner/components/PlannerEditor.test.tsx -t "invitation"
npm run lint
```

Expected: PASS.

- [x] **Step 6: Commit invitation flow**

```bash
git add frontend/src/features/planner/components/CompanionPanel.tsx frontend/src/features/planner/components/InviteCompanionDialog.tsx frontend/src/features/planner/components/PlannerEditor.tsx frontend/src/features/planner/components/PlannerEditor.test.tsx
git commit -m "feat(planner): add mock account invitations"
```

---

### Task 7: Preview/List Integration and End-to-End Verification

**Files:**
- Modify: `frontend/src/app/planner/[id]/page.tsx`
- Modify: `frontend/src/app/planner/page.tsx`
- Modify: any planner files above only when verification exposes a scoped defect

**Interfaces:**
- Consumes: repository-backed query hooks and saved planner records
- Produces: consistent list, preview, edit, reload, and generated-planner behavior

- [x] **Step 1: Replace direct planner-list storage access**

Use `usePlannersQuery`; render loading, error/retry, empty, and success states. User-created planners and seed planners must remain addressable by ID. Link owned planner cards to preview and expose an edit action to `/planner/${id}/edit`.

- [x] **Step 2: Make detail route a saved-data preview**

Load by route ID through the query/service boundary. Remove the fake save button and local-only editor actions from the preview. Add “Chỉnh sửa chuyến đi” linking to `/planner/${id}/edit`. Keep sharing as a separate preview action.

- [x] **Step 3: Run all automated checks**

Run from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests PASS, lint exits 0, and Next.js production build completes successfully.

- [x] **Step 4: Verify the AI-to-editor flow in the browser**

At `http://localhost:3000/planner/new?mode=ai`, submit a valid trip and verify the URL becomes `/planner/{new-id}/edit`, the same title/dates appear, and populated itinerary cards render. Confirm there are no new console errors.

- [x] **Step 5: Verify editing and persistence**

At desktop width, reorder within one day, move a stop to another day, edit its time/cost/note, add a searched mock place, invite a mock account as editor, simulate acceptance, and save. Reload and verify all changes persist. Open preview and verify it displays saved data without editor controls.

- [x] **Step 6: Verify responsive and accessible behavior**

Repeat core checks at 375, 768, 1024, and 1440 px. Verify no horizontal overflow, sticky sidebar only where appropriate, dialogs fit the viewport, day tabs scroll, keyboard focus is visible, drag handles are keyboard-operable, and invitation/save state is conveyed with text as well as color.

- [x] **Step 7: Review the final diff for scope and user changes**

Run:

```bash
git status --short
git diff --check
git diff -- frontend
```

Confirm no pre-existing user changes were deleted or overwritten and no unrelated files changed.

- [x] **Step 8: Commit integration fixes**

```bash
git add frontend/src/app/planner frontend/src/features/planner frontend/src/services/planner.service.ts frontend/src/types/planner.ts frontend/src/mocks/data frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts
git commit -m "feat(planner): complete AI trip editing flow"
```

---

## Completion Report

When all tasks pass, report:

- commits created;
- files added and modified;
- automated test, lint, and build results;
- browser routes and viewport sizes verified;
- any intentionally deferred backend, realtime, routing, or AI-provider work;
- any pre-existing dirty-worktree files left untouched.
