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
