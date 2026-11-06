# Manual Planner Empty-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manual planner creation produce a persisted trip with empty days, then guide the user to select and arrange existing places in the editor without invoking AI generation.

**Architecture:** Keep the existing AI path unchanged and add a separate `ManualPlannerInput` → pure factory → service mutation path. Extract a focused React Hook Form/Zod manual form from the large creation page, then enhance the existing `ItineraryEditor` with a whole-trip empty onboarding state that reuses `PlaceSearchDialog` and `PlannerItemDialog`.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, React Hook Form 7.85, Zod 4.4, TanStack Query 5.101, Zustand 5, date-fns 4.4, Tailwind CSS, shadcn/Base UI, Lucide React, Vitest 5, Testing Library.

**Spec:** `docs/frontend/superpowers/specs/2026-09-12-manual-planner-empty-first-design.md`

## Global Constraints

- Read `AGENTS.md`, `plan.md`, the approved spec, `.agents/skills/travel-frontend/SKILL.md`, and `.agents/skills/ui-ux-pro-max/SKILL.md` before implementation.
- Before editing Next.js files, read the relevant local guides under `frontend/node_modules/next/dist/docs/`; do not rely on remembered Next.js behavior.
- Preserve all pre-existing working-tree changes. Before each task, inspect `git diff` for every file being modified and integrate with it rather than replacing it.
- Stage new files by exact path. For a previously modified file, stage only this task's hunks with `git add -p`; never commit unrelated existing hunks.
- Manual mode must never call `plannerService.generateAiPlanner()` or select places from `MOCK_PLACES` during creation.
- AI mode and its existing test must continue to work unchanged.
- Do not change the persisted `Planner` shape or local-storage version; no migration is required.
- Manual form fields are exactly title, optional description, destination, start date, end date, people, budget, and cover image.
- Manual planners use `style: "Tự thiết kế"`, `status: "draft"`, `summaryRoute: ""`, zero totals, no `matchScore`, and one empty `PlannerDay` per inclusive date.
- Reuse the existing place search, item dialog, draft store, cost normalization, save/preview, invitations, and drag-and-drop behavior.
- Use existing dependencies only; do not add a wizard, a second place picker, another state library, or another UI framework.
- Use React Hook Form and Zod for the new manual form. Errors must be inline and failed submissions must retain values.
- Use Lucide icons, semantic theme tokens, visible focus states, and at least 44 px interaction targets.
- Verify responsive behavior at 375, 768, 1024, and 1440 px.
- Follow TDD: add one failing behavior, observe the intended failure, implement the minimum, rerun the focused test, then commit the task.
- Run npm commands from `frontend`; test files remain under repository-root `test/frontend/` because `frontend/vitest.config.ts` includes `../test/frontend/frontend/**/*`.

## File Structure

### Create

```text
frontend/src/features/planner/schemas/manual-planner-schema.ts
frontend/src/features/planner/model/manual-planner.ts
frontend/src/features/planner/components/ManualPlannerForm.tsx
test/features/planner/model/manual-planner.test.ts
test/features/planner/components/ManualPlannerForm.test.tsx
test/features/planner/hooks/use-planner.test.tsx
test/services/planner.service.test.ts
```

### Modify

```text
frontend/src/types/planner.ts
frontend/src/services/planner.service.ts
frontend/src/features/planner/hooks/use-planner.ts
frontend/src/app/planner/new/page.tsx
frontend/src/features/planner/components/ItineraryEditor.tsx
test/app/planner/new/page.test.tsx
test/features/planner/components/PlannerEditor.test.tsx
```

## Shared Interfaces

Use these exact names throughout all tasks:

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

export function buildManualPlanner(
  input: ManualPlannerInput,
  owner: PlannerMember,
  id: string,
  now: Date,
): Planner;

plannerService.createManualPlanner(input: ManualPlannerInput): Promise<Planner>

export function useCreateManualPlannerMutation(): UseMutationResult<
  Planner,
  Error,
  ManualPlannerInput
>;
```

---

### Task 1: Manual Input Schema and Empty Planner Factory

**Files:**
- Modify: `frontend/src/types/planner.ts`
- Create: `frontend/src/features/planner/schemas/manual-planner-schema.ts`
- Create: `frontend/src/features/planner/model/manual-planner.ts`
- Test: `test/features/planner/model/manual-planner.test.ts`

**Interfaces:**
- Consumes: existing `Planner`, `PlannerDay`, and `PlannerMember` types; date-fns `parseISO`, `isValid`, `eachDayOfInterval`, and `format`.
- Produces: `ManualPlannerInput`, `manualPlannerSchema`, `getDefaultManualPlannerDates`, and `buildManualPlanner`.

- [ ] **Step 1: Add failing factory tests**

Create `test/features/planner/model/manual-planner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildManualPlanner,
  getDefaultManualPlannerDates,
} from "@/features/planner/model/manual-planner";
import type { ManualPlannerInput, PlannerMember } from "@/types/planner";

const owner: PlannerMember = {
  userId: "owner-1",
  displayName: "Trọng Phúc",
  email: "phuc@example.com",
  role: "owner",
};

const input: ManualPlannerInput = {
  title: "Cuối tuần ở Sài Gòn",
  description: "Tự chọn các nơi muốn đi",
  destination: "TP. Hồ Chí Minh",
  startDate: "2026-09-12",
  endDate: "2026-09-14",
  people: 2,
  budget: 3_000_000,
  coverImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
};

describe("buildManualPlanner", () => {
  it("creates one empty day per inclusive date", () => {
    const planner = buildManualPlanner(input, owner, "manual-plan-1", new Date("2026-09-12T08:00:00+07:00"));

    expect(planner.id).toBe("manual-plan-1");
    expect(planner.days.map((day) => day.date)).toEqual([
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
    expect(planner.days.every((day) => day.items.length === 0)).toBe(true);
    expect(planner.days.every((day) => day.dayTotalCost === 0)).toBe(true);
  });

  it("sets manual-only metadata without AI output", () => {
    const planner = buildManualPlanner(input, owner, "manual-plan-2", new Date("2026-09-12T08:00:00+07:00"));

    expect(planner).toMatchObject({
      style: "Tự thiết kế",
      status: "draft",
      estimatedTotalCost: 0,
      summaryRoute: "",
      durationDays: 3,
      durationText: "3N2Đ",
      members: [owner],
      invitations: [],
    });
    expect(planner.matchScore).toBeUndefined();
  });

  it("supports a one-day trip", () => {
    const planner = buildManualPlanner(
      { ...input, startDate: "2026-09-12", endDate: "2026-09-12" },
      owner,
      "manual-plan-one-day",
      new Date("2026-09-12T08:00:00+07:00"),
    );
    expect(planner.durationDays).toBe(1);
    expect(planner.durationText).toBe("Trong ngày");
    expect(planner.days).toHaveLength(1);
  });

  it.each([
    [{ ...input, title: "" }, /tên chuyến đi/i],
    [{ ...input, destination: "" }, /điểm đến/i],
    [{ ...input, startDate: "2026-09-14", endDate: "2026-09-12" }, /ngày kết thúc/i],
    [{ ...input, people: 0 }, /số người/i],
    [{ ...input, budget: -1 }, /ngân sách/i],
  ])("rejects invalid manual input", (invalidInput, expectedMessage) => {
    expect(() =>
      buildManualPlanner(invalidInput, owner, "manual-plan-invalid", new Date()),
    ).toThrow(expectedMessage);
  });
});

describe("getDefaultManualPlannerDates", () => {
  it("uses local today and tomorrow instead of hardcoded dates", () => {
    expect(getDefaultManualPlannerDates(new Date(2026, 8, 12, 23, 30))).toEqual({
      startDate: "2026-09-12",
      endDate: "2026-09-13",
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- ../test/frontend/features/planner/model/manual-planner.test.ts
```

Expected: FAIL because `manual-planner.ts` and `ManualPlannerInput` do not exist.

- [ ] **Step 3: Add the manual input type**

Append the exact `ManualPlannerInput` interface from Shared Interfaces to `frontend/src/types/planner.ts`, immediately after `AiPlannerInput`. Do not add AI-only fields to it.

- [ ] **Step 4: Add the Zod schema**

Create `frontend/src/features/planner/schemas/manual-planner-schema.ts`:

```ts
import { z } from "zod";
import { format, isValid, parseISO } from "date-fns";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoDateSchema = z
  .string()
  .regex(isoDate, "Ngày không đúng định dạng")
  .refine((value) => {
    const parsed = parseISO(`${value}T00:00:00`);
    return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
  }, "Ngày không hợp lệ");

export const manualPlannerSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tên chuyến đi").max(100, "Tên chuyến đi tối đa 100 ký tự"),
    description: z.string().trim().max(500, "Mô tả tối đa 500 ký tự").optional(),
    destination: z.string().trim().min(1, "Vui lòng nhập điểm đến").max(120, "Điểm đến tối đa 120 ký tự"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    people: z.number().int("Số người phải là số nguyên").min(1, "Số người ít nhất là 1").max(50, "Số người tối đa là 50"),
    budget: z.number().min(0, "Ngân sách không được âm"),
    coverImage: z.string().url("Ảnh bìa không hợp lệ"),
  })
  .refine(({ startDate, endDate }) => endDate >= startDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
  });
```

Date strings are zero-padded ISO dates, so lexical comparison is valid after the regex check.

- [ ] **Step 5: Implement the pure factory**

Create `frontend/src/features/planner/model/manual-planner.ts`:

```ts
import { addDays, eachDayOfInterval, format, isValid, parseISO } from "date-fns";
import type { ManualPlannerInput, Planner, PlannerMember } from "@/types/planner";
import { manualPlannerSchema } from "../schemas/manual-planner-schema";

const toLocalDate = (value: string) => parseISO(`${value}T00:00:00`);

export function getDefaultManualPlannerDates(now: Date) {
  return {
    startDate: format(now, "yyyy-MM-dd"),
    endDate: format(addDays(now, 1), "yyyy-MM-dd"),
  };
}

export function buildManualPlanner(
  rawInput: ManualPlannerInput,
  owner: PlannerMember,
  id: string,
  now: Date,
): Planner {
  const parsed = manualPlannerSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Thông tin chuyến đi không hợp lệ");
  }
  const input = parsed.data;
  const start = toLocalDate(input.startDate);
  const end = toLocalDate(input.endDate);
  if (!isValid(start) || !isValid(end) || end < start) {
    throw new Error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
  }
  const dates = eachDayOfInterval({ start, end }).map((date) => format(date, "yyyy-MM-dd"));
  const durationDays = dates.length;
  const timestamp = now.toISOString();

  return {
    id,
    title: input.title,
    description: input.description ?? "",
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays,
    durationText: durationDays === 1 ? "Trong ngày" : `${durationDays}N${durationDays - 1}Đ`,
    budget: input.budget,
    estimatedTotalCost: 0,
    people: input.people,
    style: "Tự thiết kế",
    coverImage: input.coverImage,
    status: "draft",
    members: [{ ...owner, role: "owner" }],
    invitations: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    authorName: owner.displayName,
    authorAvatar: owner.avatarUrl,
    days: dates.map((date, index) => ({
      day: index + 1,
      date,
      title: `Ngày ${index + 1}: Tự do khám phá ${input.destination}`,
      items: [],
      dayTotalCost: 0,
    })),
    summaryRoute: "",
  };
}
```

- [ ] **Step 6: Run the factory tests**

Run `npm test -- ../test/frontend/features/planner/model/manual-planner.test.ts`.

Expected: all factory/default-date tests PASS.

- [ ] **Step 7: Commit the domain layer**

Stage the three new files directly. Stage only the new interface hunk from the already-modified type file:

```bash
git add frontend/src/features/planner/schemas/manual-planner-schema.ts frontend/src/features/planner/model/manual-planner.ts test/features/planner/model/manual-planner.test.ts
git add -p frontend/src/types/planner.ts
git commit -m "feat(planner): build empty manual planner drafts"
```

---

### Task 2: Manual Planner Service and Mutation

**Files:**
- Modify: `frontend/src/services/planner.service.ts`
- Modify: `frontend/src/features/planner/hooks/use-planner.ts`
- Test: `test/services/planner.service.test.ts`
- Test: `test/features/planner/hooks/use-planner.test.tsx`

**Interfaces:**
- Consumes: `ManualPlannerInput`, `buildManualPlanner`, `CURRENT_USER`, `plannerRepository.create`, `plannerKeys`.
- Produces: `plannerService.createManualPlanner(input)` and `useCreateManualPlannerMutation()`.

- [ ] **Step 1: Write the failing service test**

Create `test/services/planner.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { plannerService } from "@/services/planner.service";
import { plannerRepository } from "@/features/planner/data/planner.repository";
import type { ManualPlannerInput } from "@/types/planner";

const input: ManualPlannerInput = {
  title: "Chuyến đi tự chọn",
  description: "Không dùng AI",
  destination: "Đà Lạt",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  people: 2,
  budget: 2_000_000,
  coverImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
};

describe("plannerService.createManualPlanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("persists an empty manual planner without calling AI generation", async () => {
    const create = vi.spyOn(plannerRepository, "create").mockImplementation(async (planner) => planner);
    const generateAi = vi.spyOn(plannerService, "generateAiPlanner");

    const created = await plannerService.createManualPlanner(input);

    expect(generateAi).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
    expect(created.id).toMatch(/^manual-plan-/);
    expect(created.days).toHaveLength(2);
    expect(created.days.every((day) => day.items.length === 0)).toBe(true);
    expect(created.estimatedTotalCost).toBe(0);
  });

  it("can reload the persisted empty planner", async () => {
    const created = await plannerService.createManualPlanner(input);
    const reloaded = await plannerService.getPlannerById(created.id);

    expect(reloaded).toMatchObject({
      id: created.id,
      style: "Tự thiết kế",
      estimatedTotalCost: 0,
    });
    expect(reloaded?.days.every((day) => day.items.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Write the failing mutation-cache test**

Create `test/features/planner/hooks/use-planner.test.tsx` with a fresh QueryClient wrapper:

```tsx
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { plannerService } from "@/services/planner.service";
import { plannerKeys, useCreateManualPlannerMutation } from "@/features/planner/hooks/use-planner";
import type { ManualPlannerInput, Planner } from "@/types/planner";

vi.mock("@/services/planner.service", () => ({
  plannerService: { createManualPlanner: vi.fn() },
}));

const manualInputFixture: ManualPlannerInput = {
  title: "Chuyến đi tự chọn",
  description: "Không dùng AI",
  destination: "Đà Lạt",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  people: 2,
  budget: 2_000_000,
  coverImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
};

const emptyPlannerFixture: Planner = {
  id: "manual-plan-hook",
  title: manualInputFixture.title,
  description: manualInputFixture.description,
  destination: manualInputFixture.destination,
  startDate: manualInputFixture.startDate,
  endDate: manualInputFixture.endDate,
  durationDays: 2,
  durationText: "2N1Đ",
  budget: manualInputFixture.budget,
  estimatedTotalCost: 0,
  people: manualInputFixture.people,
  style: "Tự thiết kế",
  coverImage: manualInputFixture.coverImage,
  status: "draft",
  days: [
    { day: 1, date: "2026-10-01", items: [], dayTotalCost: 0 },
    { day: 2, date: "2026-10-02", items: [], dayTotalCost: 0 },
  ],
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

it("stores the created detail and invalidates planner lists", async () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const input = manualInputFixture;
  const created = emptyPlannerFixture;
  vi.mocked(plannerService.createManualPlanner).mockResolvedValue(created);
  const { result } = renderHook(() => useCreateManualPlannerMutation(), {
    wrapper: createWrapper(queryClient),
  });

  await act(async () => result.current.mutateAsync(input));

  await waitFor(() => expect(queryClient.getQueryData(plannerKeys.detail(created.id))).toEqual(created));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: plannerKeys.lists() });
});
```

- [ ] **Step 3: Run both tests and verify failure**

```bash
npm test -- ../test/frontend/services/planner.service.test.ts ../test/frontend/features/planner/hooks/use-planner.test.tsx
```

Expected: FAIL because `createManualPlanner` and `useCreateManualPlannerMutation` do not exist.

- [ ] **Step 4: Implement the service method**

Add imports for `ManualPlannerInput` and `buildManualPlanner`. Add this method next to `createPlanner`:

```ts
async createManualPlanner(input: ManualPlannerInput): Promise<Planner> {
  const now = new Date();
  const id = `manual-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = {
    userId: CURRENT_USER.id,
    displayName: CURRENT_USER.displayName,
    email: CURRENT_USER.email,
    avatarUrl: CURRENT_USER.avatarUrl,
    role: "owner" as const,
  };
  const planner = buildManualPlanner(input, owner, id, now);
  return plannerRepository.create(planner);
},
```

Do not call or share implementation with `generateAiPlanner`.

- [ ] **Step 5: Implement the mutation hook**

Import `ManualPlannerInput` and add:

```ts
export function useCreateManualPlannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualPlannerInput) => plannerService.createManualPlanner(input),
    onSuccess: (created) => {
      queryClient.setQueryData(plannerKeys.detail(created.id), created);
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
    },
  });
}
```

- [ ] **Step 6: Run service and hook tests**

Run the command from Step 3.

Expected: both test files PASS.

- [ ] **Step 7: Commit the service boundary**

Both implementation files already have pre-existing changes, so stage only the new imports/method/hook hunks:

```bash
git add test/services/planner.service.test.ts test/features/planner/hooks/use-planner.test.tsx
git add -p frontend/src/services/planner.service.ts
git add -p frontend/src/features/planner/hooks/use-planner.ts
git commit -m "feat(planner): persist manual planner drafts"
```

---

### Task 3: Focused Manual Planner Form

**Files:**
- Create: `frontend/src/features/planner/components/ManualPlannerForm.tsx`
- Test: `test/features/planner/components/ManualPlannerForm.test.tsx`

**Interfaces:**
- Consumes: `manualPlannerSchema`, `getDefaultManualPlannerDates`, `useCreateManualPlannerMutation`, existing `Input`, `Button`, toast, router, and the existing four cover URLs passed as props.
- Produces: `ManualPlannerForm({ coverOptions }: { coverOptions: string[] })`.

- [ ] **Step 1: Write failing form rendering and exclusion tests**

Create `test/features/planner/components/ManualPlannerForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManualPlannerForm } from "@/features/planner/components/ManualPlannerForm";
import { useCreateManualPlannerMutation } from "@/features/planner/hooks/use-planner";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/planner/hooks/use-planner", () => ({
  useCreateManualPlannerMutation: vi.fn(),
}));

const coverOptions = ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb"];
const mutateAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCreateManualPlannerMutation).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateManualPlannerMutation>);
});

it("renders only approved manual fields and the three-step guide", () => {
  render(<ManualPlannerForm coverOptions={coverOptions} />);
  expect(screen.getByLabelText(/Tên chuyến đi/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Mô tả/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Điểm đến/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Ngày bắt đầu/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Ngày kết thúc/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Số người/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Ngân sách/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Chọn ảnh bìa/i })).toBeInTheDocument();
  expect(screen.getByText("1. Tạo chuyến đi")).toBeInTheDocument();
  expect(screen.getByText("2. Chọn địa điểm")).toBeInTheDocument();
  expect(screen.getByText("3. Sắp xếp lịch trình")).toBeInTheDocument();
  expect(screen.queryByText(/Điểm muốn ghé|Sở thích|Nhịp độ|Phương tiện|Yêu cầu thêm/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add failing validation and success tests**

```tsx
it("shows inline validation and does not submit invalid dates", async () => {
  const user = userEvent.setup();
  render(<ManualPlannerForm coverOptions={coverOptions} />);
  await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Chuyến đi của tui");
  await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
  await user.clear(screen.getByLabelText(/Ngày bắt đầu/i));
  await user.type(screen.getByLabelText(/Ngày bắt đầu/i), "2026-10-03");
  await user.clear(screen.getByLabelText(/Ngày kết thúc/i));
  await user.type(screen.getByLabelText(/Ngày kết thúc/i), "2026-10-01");
  await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));
  expect(await screen.findByText(/Ngày kết thúc phải sau/i)).toBeInTheDocument();
  expect(mutateAsync).not.toHaveBeenCalled();
});

it("creates a manual planner and opens its editor", async () => {
  mutateAsync.mockResolvedValue({ id: "manual-plan-created" });
  const user = userEvent.setup();
  render(<ManualPlannerForm coverOptions={coverOptions} />);
  await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Chuyến đi của tui");
  await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
  await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    title: "Chuyến đi của tui",
    destination: "Đà Lạt",
  })));
  expect(push).toHaveBeenCalledWith("/planner/manual-plan-created/edit");
});
```

Add a failure test: reject `mutateAsync`, verify the typed title/destination remain, the button is enabled again after the rejected promise settles, and no navigation occurs.

```tsx
it("retains values and allows retry when creation fails", async () => {
  mutateAsync.mockRejectedValueOnce(new Error("storage unavailable"));
  const user = userEvent.setup();
  render(<ManualPlannerForm coverOptions={coverOptions} />);
  await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Vẫn giữ tên này");
  await user.type(screen.getByLabelText(/Điểm đến/i), "Ninh Bình");
  await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
  expect(screen.getByLabelText(/Tên chuyến đi/i)).toHaveValue("Vẫn giữ tên này");
  expect(screen.getByLabelText(/Điểm đến/i)).toHaveValue("Ninh Bình");
  expect(screen.getByRole("button", { name: /Tạo chuyến đi trống/i })).toBeEnabled();
  expect(push).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the form test and verify failure**

Run `npm test -- ../test/frontend/features/planner/components/ManualPlannerForm.test.tsx`.

Expected: FAIL because `ManualPlannerForm` does not exist.

- [ ] **Step 4: Implement the form skeleton and defaults**

Create the Client Component. Use `useForm<ManualPlannerInput>` and `zodResolver(manualPlannerSchema)`. Compute date defaults once:

```tsx
"use client";

export function ManualPlannerForm({ coverOptions }: { coverOptions: string[] }) {
  const router = useRouter();
  const createManual = useCreateManualPlannerMutation();
  const defaultDates = useMemo(() => getDefaultManualPlannerDates(new Date()), []);
  const form = useForm<ManualPlannerInput>({
    resolver: zodResolver(manualPlannerSchema),
    defaultValues: {
      title: "",
      description: "",
      destination: "",
      ...defaultDates,
      people: 2,
      budget: 3_000_000,
      coverImage: coverOptions[0],
    },
  });

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      const created = await createManual.mutateAsync(input);
      toast.success("Đã tạo chuyến đi trống. Hãy chọn địa điểm đầu tiên!");
      router.push(`/planner/${created.id}/edit`);
    } catch {
      toast.error("Không thể tạo chuyến đi. Vui lòng thử lại!");
    }
  });
```

Do not call `form.reset` on failure.

- [ ] **Step 5: Implement the approved UI**

Use a responsive `lg:grid-cols-12` form. Left column (`lg:col-span-7`) contains the selected cover, cover choices, title, and description textarea. Right column (`lg:col-span-5`) contains destination, paired dates, paired people/budget, ordered three-step guide, and submit button.

Every field must use `htmlFor`/`id`, `aria-invalid`, and `aria-describedby`. Render errors in a stable helper element:

```tsx
<p id="manual-title-error" className="min-h-5 text-xs text-destructive">
  {form.formState.errors.title?.message}
</p>
```

Number inputs use `register("people", { valueAsNumber: true })` and `register("budget", { valueAsNumber: true })`. Cover options are real buttons with `aria-label="Chọn ảnh bìa N"` and `aria-pressed`. The ordered guide uses `<ol>` and Lucide `FilePlus2`, `MapPinPlus`, and `ListOrdered` icons marked `aria-hidden="true"`.

Submit button:

```tsx
<Button type="submit" disabled={createManual.isPending} className="h-12 w-full rounded-xl">
  {createManual.isPending ? "Đang tạo chuyến đi…" : "Tạo chuyến đi trống"}
</Button>
```

- [ ] **Step 6: Run the focused form test**

Run `npm test -- ../test/frontend/features/planner/components/ManualPlannerForm.test.tsx`.

Expected: approved fields, exclusions, validation, success navigation, and failure retention PASS.

- [ ] **Step 7: Commit the manual form**

```bash
git add frontend/src/features/planner/components/ManualPlannerForm.tsx test/features/planner/components/ManualPlannerForm.test.tsx
git commit -m "feat(planner): add focused manual trip form"
```

---

### Task 4: Route the Manual Mode Through Its Own Form

**Files:**
- Modify: `frontend/src/app/planner/new/page.tsx`
- Modify: `test/app/planner/new/page.test.tsx`

**Interfaces:**
- Consumes: `ManualPlannerForm`, current `mode` search param, existing AI form and AI service calls.
- Produces: truthful mode-specific UI at `/planner/new?mode=manual` and unchanged AI behavior at `mode=ai`.

- [ ] **Step 1: Refactor the navigation mock so tests can choose a mode**

At test module scope:

```ts
let currentMode = "ai";
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(`mode=${currentMode}`),
}));
```

Reset `currentMode = "ai"` in `beforeEach` so the existing AI test remains isolated.

- [ ] **Step 2: Add the failing manual-mode page test**

Mock `useCreateManualPlannerMutation` rather than adding `createManualPlanner` to the existing service mock:

```tsx
vi.mock("@/features/planner/hooks/use-planner", () => ({
  useCreateManualPlannerMutation: vi.fn(),
}));

it("renders the reduced manual flow and never invokes AI generation", async () => {
  currentMode = "manual";
  const mutateAsync = vi.fn().mockResolvedValue({ id: "manual-plan-page" });
  vi.mocked(useCreateManualPlannerMutation).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateManualPlannerMutation>);
  const user = userEvent.setup();
  render(<NewPlannerPage />);

  expect(screen.getByRole("heading", { name: /Tạo chuyến đi thủ công/i })).toBeInTheDocument();
  expect(screen.getByText(/Khởi tạo chuyến đi trước/i)).toBeInTheDocument();
  expect(screen.queryByText(/Điểm muốn ghé|Sở thích|Nhịp độ|Phương tiện|Yêu cầu thêm/i)).not.toBeInTheDocument();

  await user.type(screen.getByLabelText(/Tên chuyến đi/i), "Tự đi Đà Lạt");
  await user.type(screen.getByLabelText(/Điểm đến/i), "Đà Lạt");
  await user.click(screen.getByRole("button", { name: /Tạo chuyến đi trống/i }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
  expect(plannerService.generateAiPlanner).not.toHaveBeenCalled();
  expect(plannerService.createPlanner).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledWith("/planner/manual-plan-page/edit");
});
```

- [ ] **Step 3: Run page tests and observe failure**

Run `npm test -- ../test/frontend/app/planner/new/page.test.tsx`.

Expected: manual test FAIL because the page still renders shared AI fields/calls; existing AI test remains PASS.

- [ ] **Step 4: Isolate mode-specific rendering**

In `NewPlannerContent`, keep the breadcrumb and mode switcher shared. Render the approved heading/copy based on mode. Wrap the current AI `<form>` without changing its body:

```tsx
{isAiMode && (
  <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
```

Keep every existing form child between those tags, then change the current closing tag and add the manual branch:

```tsx
  </form>
)}
{!isAiMode && <ManualPlannerForm coverOptions={SAMPLE_COVERS} />}
```

Do not introduce an `AiCreationFormContent` abstraction in this task. The non-negotiable result is that the existing AI form and its AI-only fields are mounted/submitted only in the AI branch.

Do not reset the manual form by mutating AI state in `switchMode`. Mode changes should update the URL via the existing mechanism and remount the correct branch. Add `aria-pressed` to both mode buttons.

- [ ] **Step 5: Use the approved manual header text**

Render these exact strings when manual mode is active:

```tsx
<h1>Tạo chuyến đi thủ công</h1>
<p>Khởi tạo chuyến đi trước, sau đó tự thêm và sắp xếp địa điểm theo ý bạn.</p>
```

AI mode keeps its existing heading, helper copy, CTA, generation, persistence, and navigation.

- [ ] **Step 6: Run page and form regression tests**

```bash
npm test -- ../test/frontend/app/planner/new/page.test.tsx ../test/frontend/features/planner/components/ManualPlannerForm.test.tsx
```

Expected: manual and AI creation tests PASS. Manual submit causes no AI calls.

- [ ] **Step 7: Commit the route integration**

The page and page test both have prior content; inspect their diffs and stage only the manual-routing/test hunks:

```bash
git add -p frontend/src/app/planner/new/page.tsx
git add -p test/app/planner/new/page.test.tsx
git commit -m "fix(planner): separate manual creation from AI"
```

---

### Task 5: Empty-First Itinerary Onboarding

**Files:**
- Modify: `frontend/src/features/planner/components/ItineraryEditor.tsx`
- Modify: `test/features/planner/components/PlannerEditor.test.tsx`

**Interfaces:**
- Consumes: existing `Planner`, `PlaceSearchDialog`, `PlannerItemDialog`, `upsertPlannerItem`, and `onUpdateDraft`.
- Produces: whole-trip empty onboarding plus context-aware add-place labels, with no new place-selection path.

- [ ] **Step 1: Add an all-empty planner fixture and failing onboarding test**

In `PlannerEditor.test.tsx`, derive from the existing `mockPlanner`:

```ts
const emptyManualPlanner: Planner = {
  ...mockPlanner,
  id: "manual-plan-empty",
  style: "Tự thiết kế",
  estimatedTotalCost: 0,
  days: [
    { day: 1, date: "2026-10-01", items: [], dayTotalCost: 0 },
    { day: 2, date: "2026-10-02", items: [], dayTotalCost: 0 },
  ],
};

function prepareEmptyManualPlanner(planner: Planner = emptyManualPlanner) {
  vi.clearAllMocks();
  usePlannerDraftStore.getState().reset();
  vi.mocked(useUpdatePlannerMutation).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdatePlannerMutation>);
  vi.mocked(usePlannerQuery).mockReturnValue({
    data: planner,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePlannerQuery>);
}

it("empty manual itinerary guides the user to the first place", async () => {
  prepareEmptyManualPlanner();
  render(<PlannerEditor plannerId="manual-plan-empty" />);

  expect(screen.getByText("Lịch trình của bạn đang trống")).toBeInTheDocument();
  expect(screen.getByText(/Chọn địa điểm có sẵn/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chọn địa điểm đầu tiên" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thêm địa điểm vào ngày này" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add failing interaction/removal tests**

```ts
it("empty manual itinerary opens existing place search from the first-place CTA", async () => {
  prepareEmptyManualPlanner();
  const user = userEvent.setup();
  render(<PlannerEditor plannerId="manual-plan-empty" />);
  await user.click(screen.getByRole("button", { name: "Chọn địa điểm đầu tiên" }));
  expect(screen.getByRole("dialog", { name: /Tìm kiếm địa điểm/i })).toBeInTheDocument();
});

it("empty manual itinerary adds the selected existing place to the active day", async () => {
  prepareEmptyManualPlanner();
  const user = userEvent.setup();
  render(<PlannerEditor plannerId="manual-plan-empty" />);

  await user.click(screen.getByRole("tab", { name: /Ngày 2/i }));
  await user.click(screen.getByRole("button", { name: "Chọn địa điểm đầu tiên" }));
  await user.click(await screen.findByText(MOCK_PLACES[0].name));
  await user.click(screen.getByRole("button", { name: "Thêm vào lịch trình" }));

  await waitFor(() => {
    const draft = usePlannerDraftStore.getState().draft;
    expect(draft?.days[0].items).toHaveLength(0);
    expect(draft?.days[1].items).toHaveLength(1);
    expect(draft?.days[1].items[0].placeId).toBe(MOCK_PLACES[0].id);
  });
  expect(screen.queryByText("Lịch trình của bạn đang trống")).not.toBeInTheDocument();
});

it("empty manual itinerary creates no item when search is canceled", async () => {
  prepareEmptyManualPlanner();
  const user = userEvent.setup();
  render(<PlannerEditor plannerId="manual-plan-empty" />);
  await user.click(screen.getByRole("button", { name: "Chọn địa điểm đầu tiên" }));
  await user.keyboard("{Escape}");

  expect(usePlannerDraftStore.getState().draft?.days.every((day) => day.items.length === 0)).toBe(true);
});

it("empty manual onboarding stays hidden once any day has a stop", () => {
  prepareEmptyManualPlanner(plannerWithItems);
  render(<PlannerEditor plannerId="planner-test-1" />);
  expect(screen.queryByText("Lịch trình của bạn đang trống")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thêm địa điểm" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the itinerary tests and verify failure**

```bash
npm test -- ../test/frontend/features/planner/components/PlannerEditor.test.tsx -t "empty manual"
```

The new test names contain `empty manual`, so this filter runs only the new tests. Expected: FAIL because the global CTA/copy and context-aware labels are absent.

- [ ] **Step 4: Derive whole-trip emptiness once**

In `ItineraryEditor` add:

```ts
const isPlannerEmpty = days.every((day) => (day.items?.length ?? 0) === 0);
```

Do not store this boolean in React state; it must update immediately from the draft.

- [ ] **Step 5: Render the onboarding panel above day tabs**

```tsx
{isPlannerEmpty && (
  <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6" aria-labelledby="empty-planner-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 id="empty-planner-title" className="text-lg font-bold">Lịch trình của bạn đang trống</h2>
        <p className="text-sm text-muted-foreground">
          Chọn địa điểm có sẵn để bắt đầu xây dựng chuyến đi theo cách của bạn.
        </p>
      </div>
      <Button type="button" onClick={handleOpenSearch} className="min-h-11 shrink-0 gap-2 rounded-xl">
        <MapPinPlus aria-hidden="true" className="size-4" />
        Chọn địa điểm đầu tiên
      </Button>
    </div>
  </section>
)}
```

Import `MapPinPlus` from Lucide. The CTA must call the same `handleOpenSearch` used by the per-day button.

- [ ] **Step 6: Update empty and nonempty day copy**

Keep the current dashed card and change only its helper copy to identify the active day:

```tsx
<p className="text-sm font-semibold">Ngày {activeDayNumber} chưa có địa điểm</p>
<p className="text-xs text-muted-foreground">
  Chọn một địa điểm có sẵn rồi bổ sung thời gian, chi phí và ghi chú.
</p>
```

Change the end-of-day button text:

```tsx
<span>{items.length === 0 ? "Thêm địa điểm vào ngày này" : "Thêm địa điểm"}</span>
```

Update the existing empty-day test to assert the new approved copy:

```ts
expect(screen.getByText(/Ngày 2 chưa có địa điểm/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Thêm địa điểm vào ngày này/i })).toBeInTheDocument();
```

Do not alter `handleSelectPlaceFromSearch`, `handleSaveItem`, `upsertPlannerItem`, or dialog closing behavior.

- [ ] **Step 7: Run new and existing itinerary tests**

```bash
npm test -- ../test/frontend/features/planner/components/PlannerEditor.test.tsx -t "empty manual|itinerary"
```

Expected: onboarding, first-place dialog, existing item rendering/edit/delete, cost recalculation, and empty-day switching tests PASS.

- [ ] **Step 8: Commit the editor onboarding**

Both files have pre-existing changes, so stage only onboarding/copy/test hunks:

```bash
git add -p frontend/src/features/planner/components/ItineraryEditor.tsx
git add -p test/features/planner/components/PlannerEditor.test.tsx
git commit -m "feat(planner): guide empty manual itineraries"
```

---

### Task 6: Regression and Browser Verification

**Files:**
- Modify only Task 1–5 files if verification reveals a defect.

**Interfaces:**
- Consumes: completed manual creation and existing AI/editor flows.
- Produces: verified empty-first manual workflow with preserved AI behavior.

- [ ] **Step 1: Run all targeted manual-planner tests**

```bash
npm test -- ../test/frontend/features/planner/model/manual-planner.test.ts ../test/frontend/services/planner.service.test.ts ../test/frontend/features/planner/hooks/use-planner.test.tsx ../test/frontend/features/planner/components/ManualPlannerForm.test.tsx ../test/frontend/app/planner/new/page.test.tsx ../test/frontend/features/planner/components/PlannerEditor.test.tsx
```

Expected: all manual domain, service, mutation, form, route, and editor tests PASS.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: all existing planner, map, route, repository, and UI tests PASS.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit code 0 with no new errors or warnings in files touched by this feature.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: exit code 0; `/planner/new` and `/planner/[id]/edit` build without missing Suspense, Client Component, hydration, or type errors.

- [ ] **Step 5: Verify manual creation in the browser**

Start the existing development server or run `npm run dev`, then open:

```text
http://localhost:3000/planner/new?mode=manual
```

Verify at 375 px and desktop width:

```text
- Only the approved basic fields and three-step guide are visible.
- AI-only wishlist/preferences/pace/transport/notes are absent.
- Reversed dates show an inline error without losing values.
- The pending button is disabled and reads “Đang tạo chuyến đi…”.
- Successful submit navigates to /planner/manual-plan-*/edit.
- Every day initially shows 0 points and the budget total is 0 đ.
- “Chọn địa điểm đầu tiên” opens the existing searchable place catalog.
- Closing search/item dialogs creates no stop.
- Selecting a place, filling item details, and confirming adds it to the active day.
- The whole-trip onboarding disappears after the first item.
- Saving and refreshing preserves the manually added item.
```

- [ ] **Step 6: Verify AI regression**

Open:

```text
http://localhost:3000/planner/new?mode=ai
```

Submit the existing AI form and verify it still calls the AI mock path, persists the generated planner, navigates to the editor, and shows populated stops. Switching between tabs must show the correct mode-specific fields and must not submit hidden manual/AI fields across modes.

- [ ] **Step 7: Inspect scoped diff and commits**

```bash
git diff --check
git status --short
git diff -- frontend/src/types/planner.ts frontend/src/services/planner.service.ts frontend/src/features/planner/hooks/use-planner.ts frontend/src/features/planner/schemas/manual-planner-schema.ts frontend/src/features/planner/model/manual-planner.ts frontend/src/features/planner/components/ManualPlannerForm.tsx frontend/src/app/planner/new/page.tsx frontend/src/features/planner/components/ItineraryEditor.tsx test/features/planner/model/manual-planner.test.ts test/features/planner/components/ManualPlannerForm.test.tsx test/features/planner/hooks/use-planner.test.tsx test/services/planner.service.test.ts test/app/planner/new/page.test.tsx test/features/planner/components/PlannerEditor.test.tsx
```

Expected: no whitespace errors, no changes outside the approved scope, no generated stops in manual creation, and no accidental staging of pre-existing hunks.

If verification required corrections, stage only the correction hunks in existing files and the exact corrected new files, then commit:

```bash
git add -p frontend/src/types/planner.ts frontend/src/services/planner.service.ts frontend/src/features/planner/hooks/use-planner.ts frontend/src/app/planner/new/page.tsx frontend/src/features/planner/components/ItineraryEditor.tsx test/app/planner/new/page.test.tsx test/features/planner/components/PlannerEditor.test.tsx
git add frontend/src/features/planner/schemas/manual-planner-schema.ts frontend/src/features/planner/model/manual-planner.ts frontend/src/features/planner/components/ManualPlannerForm.tsx test/features/planner/model/manual-planner.test.ts test/features/planner/components/ManualPlannerForm.test.tsx test/features/planner/hooks/use-planner.test.tsx test/services/planner.service.test.ts
git commit -m "fix(planner): resolve manual flow verification issues"
```

Do not create an empty verification commit.

## Final Acceptance Checklist

- [ ] Manual mode renders only title, description, destination, dates, people, budget, and cover image.
- [ ] Manual submit uses `useCreateManualPlannerMutation` and never invokes `generateAiPlanner`.
- [ ] The saved manual planner contains one empty day per inclusive date, zero totals, manual style, empty route, and no match score.
- [ ] AI creation remains behaviorally unchanged.
- [ ] Empty manual editor shows one whole-trip onboarding panel and per-day empty guidance.
- [ ] Global and per-day CTAs reuse the same existing place search and item dialog.
- [ ] Adding the first place targets the active day, marks the draft dirty, and removes whole-trip onboarding.
- [ ] Canceling dialogs creates no item; save/reload preserves confirmed items.
- [ ] Existing edit/delete/reorder/cost/preview/invitation behavior still passes.
- [ ] Form errors are inline, failed submits retain values, and controls are keyboard accessible.
- [ ] Targeted tests, full tests, lint, production build, and mobile/desktop manual checks pass.
