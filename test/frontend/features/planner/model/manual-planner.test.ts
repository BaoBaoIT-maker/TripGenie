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
