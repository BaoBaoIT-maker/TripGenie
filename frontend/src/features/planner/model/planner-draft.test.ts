import { describe, it, expect } from "vitest";
import {
  normalizePlanner,
  reorderPlannerItem,
  movePlannerItem,
  upsertPlannerItem,
  removePlannerItem,
  getInviteConflict,
} from "./planner-draft";
import { Planner, PlannerItem } from "@/types/planner";
import { MOCK_PLACES } from "@/mocks/data/places";

const mockPlace = MOCK_PLACES[0];

const plannerWithWrongOrdersAndTotals: Planner = {
  id: "p-1",
  title: "Trip 1",
  destination: "Đà Lạt",
  startDate: "2026-10-01",
  endDate: "2026-10-01",
  durationDays: 1,
  durationText: "1N",
  budget: 1000000,
  estimatedTotalCost: 0,
  people: 2,
  style: "Relax",
  coverImage: "",
  days: [
    {
      day: 1,
      date: "2026-10-01",
      dayTotalCost: 0,
      items: [
        {
          id: "item-1",
          placeId: "place-1",
          place: mockPlace,
          startTime: "09:00",
          durationMinutes: 60,
          estimatedCost: 100000,
          order: 5,
        },
        {
          id: "item-2",
          placeId: "place-2",
          place: mockPlace,
          startTime: "11:00",
          durationMinutes: 90,
          estimatedCost: 200000,
          order: 9,
        },
      ],
    },
  ],
};

const twoStopPlanner: Planner = {
  ...plannerWithWrongOrdersAndTotals,
  days: [
    {
      day: 1,
      date: "2026-10-01",
      items: [
        {
          id: "item-1",
          placeId: "place-1",
          place: mockPlace,
          startTime: "09:00",
          durationMinutes: 60,
          estimatedCost: 100000,
          order: 1,
        },
        {
          id: "item-2",
          placeId: "place-2",
          place: mockPlace,
          startTime: "11:00",
          durationMinutes: 90,
          estimatedCost: 200000,
          order: 2,
        },
      ],
    },
  ],
};

const twoDayPlanner: Planner = {
  ...plannerWithWrongOrdersAndTotals,
  days: [
    {
      day: 1,
      date: "2026-10-01",
      items: [
        {
          id: "item-1",
          placeId: "place-1",
          place: mockPlace,
          startTime: "09:00",
          durationMinutes: 60,
          estimatedCost: 100000,
          order: 1,
        },
      ],
    },
    {
      day: 2,
      date: "2026-10-02",
      items: [
        {
          id: "item-2",
          placeId: "place-2",
          place: mockPlace,
          startTime: "11:00",
          durationMinutes: 90,
          estimatedCost: 200000,
          order: 1,
        },
      ],
    },
  ],
};

const plannerWithMembers: Planner = {
  ...twoStopPlanner,
  members: [
    {
      userId: "owner-id",
      displayName: "Owner",
      email: "owner@example.com",
      role: "owner",
    },
    {
      userId: "member-id",
      displayName: "Member",
      email: "member@example.com",
      role: "editor",
    },
  ],
  invitations: [
    {
      id: "inv-1",
      plannerId: "p-1",
      invitee: {
        userId: "pending-id",
        displayName: "Pending User",
        email: "pending@example.com",
        role: "viewer",
      },
      permission: "viewer",
      status: "pending",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ],
};

describe("planner-draft pure domain model", () => {
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

  it("allows valid invitation candidate", () => {
    expect(getInviteConflict(plannerWithMembers, "owner-id", "new-user-id")).toBeNull();
  });

  it("upserts a new planner item into a day and normalizes order", () => {
    const newItem: PlannerItem = {
      id: "item-new",
      placeId: "place-3",
      place: mockPlace,
      startTime: "14:00",
      durationMinutes: 45,
      estimatedCost: 50000,
      order: 99,
    };
    const result = upsertPlannerItem(twoStopPlanner, 1, newItem);
    expect(result.days[0].items).toHaveLength(3);
    expect(result.days[0].items.map((it) => it.order)).toEqual([1, 2, 3]);
    expect(result.days[0].dayTotalCost).toBe(350000);
    expect(result.estimatedTotalCost).toBe(350000);
  });

  it("updates an existing planner item in place", () => {
    const updatedItem: PlannerItem = {
      ...twoStopPlanner.days[0].items[0],
      estimatedCost: 250000,
      note: "Updated note",
    };
    const result = upsertPlannerItem(twoStopPlanner, 1, updatedItem);
    expect(result.days[0].items).toHaveLength(2);
    expect(result.days[0].items[0].estimatedCost).toBe(250000);
    expect(result.days[0].items[0].note).toBe("Updated note");
    expect(result.days[0].dayTotalCost).toBe(450000);
  });

  it("removes a planner item by id and normalizes the affected day", () => {
    const result = removePlannerItem(twoStopPlanner, "item-1");
    expect(result.days[0].items).toHaveLength(1);
    expect(result.days[0].items[0].id).toBe("item-2");
    expect(result.days[0].items[0].order).toBe(1);
    expect(result.days[0].dayTotalCost).toBe(200000);
    expect(result.estimatedTotalCost).toBe(200000);
  });
});
