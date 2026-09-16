import { Planner, PlannerItem } from "@/types/planner";

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}

export function normalizePlanner(planner: Planner): Planner {
  let estimatedTotalCost = 0;

  const days = (planner.days || []).map((day) => {
    let dayTotalCost = 0;
    const items = (day.items || []).map((item, index) => {
      const cost = Number(item.estimatedCost) || 0;
      dayTotalCost += cost;
      return {
        ...item,
        order: index + 1,
      };
    });
    estimatedTotalCost += dayTotalCost;

    return {
      ...day,
      dayTotalCost,
      items,
    };
  });

  return {
    ...planner,
    status: planner.status ?? "saved",
    description: planner.description ?? "",
    members: planner.members ? [...planner.members] : [],
    invitations: planner.invitations ? [...planner.invitations] : [],
    createdAt: planner.createdAt ?? new Date().toISOString(),
    updatedAt: planner.updatedAt ?? new Date().toISOString(),
    days,
    estimatedTotalCost,
  };
}

export function reorderPlannerItem(
  planner: Planner,
  dayNumber: number,
  activeId: string,
  overId: string
): Planner {
  const dayIndex = planner.days.findIndex((d) => d.day === dayNumber);
  if (dayIndex === -1) {
    return normalizePlanner(planner);
  }

  const day = planner.days[dayIndex];
  const oldIndex = day.items.findIndex((i) => i.id === activeId);
  const newIndex = day.items.findIndex((i) => i.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return normalizePlanner(planner);
  }

  const newItems = arrayMove(day.items, oldIndex, newIndex);
  const newDays = [...planner.days];
  newDays[dayIndex] = {
    ...day,
    items: newItems,
  };

  return normalizePlanner({
    ...planner,
    days: newDays,
  });
}

export function movePlannerItem(
  planner: Planner,
  activeId: string,
  targetDayNumber: number,
  overId?: string
): Planner {
  let sourceDayNumber: number | null = null;
  let targetItem: PlannerItem | null = null;

  for (const day of planner.days) {
    const found = day.items.find((i) => i.id === activeId);
    if (found) {
      sourceDayNumber = day.day;
      targetItem = found;
      break;
    }
  }

  if (sourceDayNumber === null || !targetItem) {
    return normalizePlanner(planner);
  }

  if (sourceDayNumber === targetDayNumber) {
    if (overId && overId !== activeId) {
      return reorderPlannerItem(planner, targetDayNumber, activeId, overId);
    }
    return normalizePlanner(planner);
  }

  const targetDay = planner.days.find((d) => d.day === targetDayNumber);
  if (!targetDay) {
    return normalizePlanner(planner);
  }

  const newDays = planner.days.map((day) => {
    if (day.day === sourceDayNumber) {
      return {
        ...day,
        items: day.items.filter((i) => i.id !== activeId),
      };
    }
    if (day.day === targetDayNumber) {
      const items = [...day.items];
      if (overId) {
        const overIndex = items.findIndex((i) => i.id === overId);
        if (overIndex !== -1) {
          items.splice(overIndex, 0, targetItem!);
        } else {
          items.push(targetItem!);
        }
      } else {
        items.push(targetItem!);
      }
      return {
        ...day,
        items,
      };
    }
    return day;
  });

  return normalizePlanner({
    ...planner,
    days: newDays,
  });
}

export function upsertPlannerItem(
  planner: Planner,
  dayNumber: number,
  item: PlannerItem
): Planner {
  const targetDayExists = planner.days.some((d) => d.day === dayNumber);
  if (!targetDayExists) {
    return normalizePlanner(planner);
  }

  // Remove item from any other day first
  const strippedDays = planner.days.map((day) => {
    if (day.day !== dayNumber) {
      return {
        ...day,
        items: day.items.filter((i) => i.id !== item.id),
      };
    }
    return day;
  });

  const newDays = strippedDays.map((day) => {
    if (day.day === dayNumber) {
      const existingIndex = day.items.findIndex((i) => i.id === item.id);
      if (existingIndex !== -1) {
        const nextItems = [...day.items];
        nextItems[existingIndex] = item;
        return {
          ...day,
          items: nextItems,
        };
      } else {
        return {
          ...day,
          items: [...day.items, item],
        };
      }
    }
    return day;
  });

  return normalizePlanner({
    ...planner,
    days: newDays,
  });
}

export function removePlannerItem(planner: Planner, itemId: string): Planner {
  const newDays = planner.days.map((day) => ({
    ...day,
    items: day.items.filter((i) => i.id !== itemId),
  }));

  return normalizePlanner({
    ...planner,
    days: newDays,
  });
}

export function getInviteConflict(
  planner: Planner,
  currentUserId: string,
  candidateUserId: string
): "self" | "member" | "pending" | null {
  if (candidateUserId === currentUserId) {
    return "self";
  }

  const isMember = (planner.members || []).some(
    (m) => m.userId === candidateUserId
  );
  if (isMember) {
    return "member";
  }

  const isPending = (planner.invitations || []).some(
    (inv) => inv.invitee.userId === candidateUserId && inv.status === "pending"
  );
  if (isPending) {
    return "pending";
  }

  return null;
}
