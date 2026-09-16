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
