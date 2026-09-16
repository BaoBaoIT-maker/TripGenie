import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("useCreateManualPlannerMutation", () => {
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
});
