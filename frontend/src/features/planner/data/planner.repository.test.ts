import { describe, it, expect, beforeEach } from "vitest";
import { plannerRepository } from "./planner.repository";
import { Planner } from "@/types/planner";

const generatedPlanner: Planner = {
  id: "planner-gen-123",
  title: "Chuyến đi mới tạo",
  description: "Mô tả",
  destination: "Đà Lạt",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  durationDays: 2,
  durationText: "2N1Đ",
  budget: 2000000,
  estimatedTotalCost: 0,
  people: 2,
  style: "Khám phá",
  coverImage: "https://example.com/cover.jpg",
  days: [
    {
      day: 1,
      date: "2026-10-01",
      items: [],
    },
    {
      day: 2,
      date: "2026-10-02",
      items: [],
    },
  ],
};

const firstPlanner: Planner = {
  ...generatedPlanner,
  id: "planner-first",
  title: "Chuyến 1",
};

const secondPlanner: Planner = {
  ...generatedPlanner,
  id: "planner-second",
  title: "Chuyến 2",
};

describe("plannerRepository", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and reads a planner by the generated id", async () => {
    await plannerRepository.create(generatedPlanner);
    await expect(plannerRepository.get(generatedPlanner.id)).resolves.toMatchObject({
      id: generatedPlanner.id,
      title: "Chuyến đi mới tạo",
    });
  });

  it("updates a planner without dropping other planners", async () => {
    await plannerRepository.create(firstPlanner);
    await plannerRepository.create(secondPlanner);
    await plannerRepository.update(firstPlanner.id, {
      ...firstPlanner,
      title: "Đã đổi",
    });
    await expect(plannerRepository.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstPlanner.id, title: "Đã đổi" }),
        expect.objectContaining({ id: secondPlanner.id }),
      ])
    );
  });

  it("falls back to seeded planners when stored JSON is invalid", async () => {
    localStorage.setItem("triptailor:planners:v1", "not-json");
    await expect(plannerRepository.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "planner-saigon-foodie" }),
      ])
    );
  });

  it("merges legacy triptailor_user_planners on initial read", async () => {
    const legacyPlanner: Planner = {
      ...generatedPlanner,
      id: "legacy-plan-1",
      title: "Legacy Planner Title",
    };
    localStorage.setItem(
      "triptailor_user_planners",
      JSON.stringify([legacyPlanner])
    );

    const list = await plannerRepository.list();
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-plan-1", title: "Legacy Planner Title" }),
        expect.objectContaining({ id: "planner-saigon-foodie" }),
      ])
    );
  });

  it("returns cloned records preventing reference mutation", async () => {
    await plannerRepository.create(generatedPlanner);
    const fetched = await plannerRepository.get(generatedPlanner.id);
    expect(fetched).not.toBeNull();
    fetched!.title = "Mutated Title Directly";

    const fetchedAgain = await plannerRepository.get(generatedPlanner.id);
    expect(fetchedAgain?.title).toBe("Chuyến đi mới tạo");
  });
});
